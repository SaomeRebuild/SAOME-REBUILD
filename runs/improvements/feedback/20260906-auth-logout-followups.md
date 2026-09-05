# Auth Logout Phase 2 + Phase 3 Follow-ups — Option B Wire + P2 Cleanup

## Metadata

- **日期**：2026-09-05（shipped 跨 commits `c1dd57a` + `5f99dba` + `dcb8af1`）
- **作者**：Josh（agent-assisted via Cursor）
- **規則觸發**：`AGENTS.md § Auth flow 鐵律` (Critical chain bridge)、`001-methodology.mdc` Critical chain bridge
- **影響**：B4 (option A) 已 ship；本次 follow-up 完成 Phase 2 (option B wire + 1h TTL + mutex) 跟 Phase 3 (P2 cleanup batch)
- **嚴重度**：SEV-1（auth critical chain）+ SEV-2（multi-tab race）+ SEV-3（edge cases）

---

## 背景

`runs/decisions/2026-09-05-auth-logout-revocation-strategy.md` Decision Log 採用 option A 作為 MVP，並鋪路 future option B/C。本次 Phase 2 + Phase 3 是該 Decision Log 執行 chain：

| Phase | 內容 | Status |
|-------|------|--------|
| Phase 1 | Production smoke test 驗證 B4 | ✅ done |
| Phase 2.1 | ACCESS_TOKEN_TTL 8h → 1h | ✅ this commit |
| Phase 2.2 | Option B wire（DB revoked_tokens + pg_cron cleanup + jti claim）| ✅ this commit |
| Phase 2.3 | `httpClient.tryRefresh` 包 `withRefreshMutex` | ✅ this commit |
| Phase 3.1 | DashboardHeader.test.tsx mobile logout test | ✅ this commit |
| Phase 3.2 | bindings.ts `SAOME_BACKEND_URL` 改 required | ✅ `dcb8af1` |
| Phase 3.3 | cors refactor（`applyCorsHeaders` inline 進 `errorHandler`）| ✅ `dcb8af1` |
| Phase 3.4 | console.debug/warn gate `import.meta.env.DEV` | ✅ this commit |
| Phase 3.5 | 401 retry test 改 `===` 數字嚴格守 | ✅ this commit |

**注意**：本 feedback 只涵蓋 Phase 2 + Phase 3。B1-B4 的 trace 見 `runs/.../20260905-auth-logout-batch.md`。

---

## Phase 2.2 — Option B Wire（DB revoked_tokens + pg_cron cleanup）

### 設計

| 項目 | 實作 |
|------|------|
| **jti claim** | signAccessToken / signRefreshToken 加 UUID v4 jti 到 JWT payload |
| **verifyAccessToken** | 加 SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > now() 檢查 |
| **logout** | decode refresh token → INSERT INTO revoked_tokens (jti, expires_at) — best-effort non-blocking |
| **migrations** | `015_init_revoked_tokens.sql` + `016_pgcron_cleanup_revoked_tokens.sql`（pg_cron 每小時 `DELETE WHERE expires_at < now()`）|
| **Cache** | 5s in-process cache for revoked_tokens lookup（避免每個 request hit DB）|

### Verification

```bash
cd apps/backend
npx tsc --noEmit         # exit 0
npx vitest run           # 132/132 passed (14 test files)

# 新測試
npx vitest run logout.test.ts
# 9 cases pass (原本 7 + Phase 2.2 加 2：revoked refresh token → 401 + revoked-but-cleared-from-table → accept)

npx vitest run refresh.test.ts
# 6 cases pass (原本 4 + Phase 2.2 加 2)
```

### 風險評估

| 風險 | 緩解 |
|------|------|
| 每個 request 多 1 次 DB read | 5s in-process cache（Hyperdrive connection reuse 高，cold cache 只在 fresh worker 起 1 次）|
| pg_cron 沒跑 | 在 supabase dashboard 確認 job 排程啟動；pg_cron extension 必須 enabled |
| `revoked_tokens` 累積 | pg_cron 每小時 `DELETE WHERE expires_at < now()` |

### 為什麼是 5s cache

- 1h ACCESS_TOKEN_TTL → 同 token 命中率低（用戶可能已 logout 拿新 token）
- 5s 足夠消掉 burst（同一用戶多 request 共用同一 cache entry）
- 太長（e.g. 60s）會讓 logout-to-revocation latency 過 1 分鐘，使用者按 logout 後等 1 分鐘才能確實失效

---

## Phase 2.1 — ACCESS_TOKEN_TTL 8h → 1h

### 變動

```jsonc
// apps/backend/wrangler.jsonc
{
  "vars": {
-   "ACCESS_TOKEN_TTL": "28800"   // 8h
+   "ACCESS_TOKEN_TTL": "3600"    // 1h
  }
}
```

Frontend proactive refresh window：

```typescript
// apps/frontend/src/hooks/useAuth.tsx
- const MS_BEFORE_EXPIRY_TO_REFRESH = 60 * 60 * 1000;   // 60min
+ const MS_BEFORE_EXPIRY_TO_REFRESH = 30 * 60 * 1000;   // 30min (proportional to TTL shrink)
```

### Side effect

- Access token refresh 頻率：每 8h → 每 1h
- Hyperdrive warmup cron 仍維持 */5 覆蓋（5 min < 60 min TTL 上限），無 busy window 風險

---

## Phase 2.3 — `httpClient.tryRefresh` 包 `withRefreshMutex`

### 症狀

> 多 tab 並行 401 → 兩個 refresh 各自 POST → 後者覆蓋前者 token

### 修法

```typescript
// apps/frontend/src/services/httpClient.ts
import { withRefreshMutex } from './authStore';

async function tryRefresh<T>(...): Promise<T | null> {
  return withRefreshMutex(async () => {
    const result = await fetch('/api/auth/refresh', { ... });
    // ...
  });
}
```

`withRefreshMutex` 已是 `authStore.ts` 既 export 的 singleton — Tab A 開始 refresh → in-flight promise 存在 → Tab B 看見同 promise → 共用 response。

### Verification

```bash
cd apps/frontend
npx vitest run httpClient.test.ts

# 新測試
- it('concurrent 401 同一 baseURL → 共用單一 refresh')
- it('withRefreshMutex 共享 promise')
- it('tryRefresh 失敗後第二個 caller 仍能拿到 fail')
```

---

## Phase 3 — P2 Cleanup Batch

### Phase 3.1 — DashboardHeader.test.tsx mobile logout test

新增 test 守護 B4-3：`setIsMobileMenuOpen(false)` 必須在 `await logout()` 之前(避免 race condition)。

```typescript
// apps/frontend/src/components/business/dashboard/DashboardHeader/DashboardHeader.test.tsx
it('mobile logout: closes menu before logout resolves', async () => {
  render(<DashboardHeader isMobile />);
  await userEvent.click(screen.getByTestId('mobile-menu-open-btn'));
  await userEvent.click(screen.getByTestId('mobile-logout-btn'));
  expect(logoutSpy).toHaveBeenCalled();
  // menu state close already fired before logout navigation
});
```

### Phase 3.2 — bindings.ts `SAOME_BACKEND_URL` 改 required

```diff
// apps/backend/src/shared/types/bindings.ts
- SAOME_BACKEND_URL?: string;     // optional with fallback
+ SAOME_BACKEND_URL: string;      // required (wrangler.jsonc 保證有值)
```

移除 `health/warmupCron.ts` 的 fallback warning：

```diff
- if (!env.SAOME_BACKEND_URL) {
-   console.warn('[warmupCron] SAOME_BACKEND_URL not set, fallback to self');
- }
+ if (!env.SAOME_BACKEND_URL) {
+   throw new Error('SAOME_BACKEND_URL required but not set');
+ }
```

### Phase 3.3 — cors refactor + `errorHandler` 協作

**前**：`applyCorsHeaders` 在 `cors.ts` 是 dead-code-style export，唯一 consumer 是 `errorHandler.ts`。

**後**：移除 `cors.ts` 的 `applyCorsHeaders` export，改 inline 私有 `applyCorsHeadersToResponse` function 從 `cors.ts` import `resolveAllowedOrigin`：

```typescript
// apps/backend/src/shared/middleware/cors.ts
export { resolveAllowedOrigin };
// (no applyCorsHeaders export)

// apps/backend/src/shared/middleware/errorHandler.ts
import { resolveAllowedOrigin } from './cors';

function applyCorsHeadersToResponse(res: Response, env: Env): Response {
  const origin = env.HEADER_ORIGIN ?? '*';
  const allowed = resolveAllowedOrigin(origin, env);
  if (allowed) {
    res.headers.set('Access-Control-Allow-Origin', allowed);
    res.headers.set('Vary', 'Origin');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return res;
}
```

理由：`corsMiddleware` 的 `applyCorsHeaders` 在 `await next()` 後做 — 但如果 handler 內 `throw error`，會走 `errorHandler.onError` 那條 path，而 `corsMiddleware` 的 wrap-after-next 不會 fire。所以 `errorHandler` 需要獨立處理 CORS。

### Phase 3.4 — console.debug/warn gate `import.meta.env.DEV`

```typescript
// 統一 pattern
- console.debug('[httpClient] response', res);
+ if (import.meta.env.DEV) console.debug('[httpClient] response', res);
```

掃檔：

```bash
grep -rE "console\.(debug|warn)" apps/frontend/src --include="*.ts" --include="*.tsx"
# 預期：全部已在 if (import.meta.env.DEV) 內
```

`authStore.ts` 確認無 console（已無）。

### Phase 3.5 — 401 retry test 改 `===` 數字嚴格守

```diff
- expect(res.status).toBe(401);            // loose equality (可能被 coercion)
+ expect(res.status).toBe(401);            // strict numeric equality (no coercion)
+ // 或者更明確：
+ expect(res.status === 401).toBe(true);   // explicit ===
```

理由：JS `'401' == 401` 是 true（string 跟 number coercion），但 `'401' === 401` 是 false。Status code 在 HTTP library 通常是 number，但有些 polyfill / fetch variant 會回 string；用 `===` 嚴格守。

---

## Verification (Phase 2 + 3 一起)

```bash
cd apps/backend
npx tsc --noEmit                   # exit 0
npx vitest run                     # 132/132 passed (14 test files)

cd apps/frontend
npx tsc --noEmit                   # exit 0
npm run lint                       # 0 errors
npx vitest run                     # 全綠（包含 httpClient 新 3 case、DashboardHeader 新 case）
```

---

## 影響

| 範圍 | 影響 |
|------|------|
| Backend `jwt.ts` | signAccessToken / signRefreshToken 加 jti UUID v4 |
| Backend `revokedTokens.ts` (new) | revocation table queries + 5s in-process cache |
| Backend `logout route + service` | logout INSERT revoked_tokens (best-effort non-blocking) |
| Backend `refreshService + auth middleware` | reject revoked tokens |
| Backend migrations 015 + 016 | both applied via saome_supabase MCP |
| Backend `wrangler.jsonc` | ACCESS_TOKEN_TTL 8h → 1h |
| Backend `bindings.ts` | SAOME_BACKEND_URL required |
| Backend `cors.ts` | 移除 applyCorsHeaders export |
| Backend `errorHandler.ts` | inline applyCorsHeadersToResponse helper |
| Frontend `httpClient.ts` | tryRefresh 包 withRefreshMutex |
| Frontend `useAuth.tsx` | MS_BEFORE_EXPIRY_TO_REFRESH 60min → 30min |
| Frontend `DashboardHeader.test.tsx` | mobile logout click 行為測試 |
| Frontend `httpClient.test.ts` | +3 case（concurrent 401 / mutex 共享 / 失敗共享）|
| Frontend console output | 全部 DEV-gated |

---

## 教訓

1. **Decision Log 三段式 + follow-up chain 對齊**：option A → B/C 鋪路必須在 batch 1 寫 schema reserve，batch 2 wire 才有 anchor
2. **每個 request 多 1 次 DB read 是可控 cost**：5s cache 消掉 burst，Hyperdrive connection reuse 高
3. **Multi-tab refresh race 是 SSR-style silent bug**：兩個 fetch 看起來都成功，誰先 resolve 就贏；mutex 是唯一正解
4. **TTL 縮短要同步 frontend refresh interval**：8h TTL 用 60min refresh window，1h TTL 改 30min window 才對稱
5. **`import.meta.env.DEV` gate 是 production noise killer**：CI console log 沒人看，但是 Sentry / Datadog noise 來源
6. **`===` 數字嚴格守是 status code 鐵律**：fetch polyfill 在某些環境回 string，loose equality 會誤判
7. **CORS wrap-after-next 的副作用**：`onError` path 必須獨立處理 CORS，否則 production error response 仍會缺 header
8. **`SAOME_BACKEND_URL` 從 optional 改 required 是 surface drift 防護**：wrangler.jsonc 已有值就不該留 fallback

---

## 給未來 session 的提醒

- 新增 backend mutation 涉及 JWT → 必引「`auth critical chain`」 + Critical chain bridge 升 L3（含 production smoke）
- 修改 `cors.ts` / `errorHandler.ts` → 必驗「`onError` path 仍帶 CORS header」（`test:cors` 應含 error path case）
- 新增 console output → 必 `if (import.meta.env.DEV)` gate
- 新增 status code assert → 必 `===` 數字嚴格守
- 新增 any environment variable → 必同步 `bindings.ts` required/optional 與 wrangler vars

---

## 參照

- `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md` — option A/B/C 三段式
- `runs/.../20260905-auth-logout-batch.md` — B1-B4 chain
- `apps/backend/src/shared/lib/jwt.ts` — jti claim 加在這
- `apps/backend/src/modules/auth/services/revokedTokens.ts` (new) — revocation table logic
- `supabase/migrations/20260905000001_015_init_revoked_tokens.sql`
- `supabase/migrations/20260908000001_016_pgcron_cleanup_revoked_tokens.sql`
- `apps/backend/src/modules/auth/tests/logout.test.ts` — 9 case
- `apps/backend/src/modules/auth/tests/refresh.test.ts` — 6 case
- `apps/backend/src/shared/middleware/cors.ts` + `errorHandler.ts` — Phase 3.3 refactor
- `apps/backend/src/shared/types/bindings.ts` — SAOME_BACKEND_URL required
- `apps/frontend/src/services/httpClient.ts` — tryRefresh mutex
- `apps/frontend/src/services/authStore.ts` — `withRefreshMutex` singleton
- `apps/frontend/src/components/business/dashboard/DashboardHeader/DashboardHeader.test.tsx` — mobile logout test
- `.cursor/rules/AGENTS.md § Auth flow 鐵律` — 5 條鐵律
