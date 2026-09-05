# Auth Logout Revocation Strategy

## Metadata

- **日期**：2026-09-05
- **作者**：Josh（agent-assisted via Cursor）
- **觸發**：`DashboardHeaderActions` 的 `<LogOut>` 按鈕觸發後，視覺上看似登出，實際上 session 仍有效（HttpOnly cookie 30 天 persist、server 無感）
- **規則 / skill 觸發**：`001-methodology.mdc` L3 Heavy（含 Critical chain bridge）+ `AGENTS.md § Auth flow 鐵律`（auth 是 critical chain，bug fix 必走 production smoke）+ `019-schema-contract-drift.mdc`（後端 logout 介面 contract 同步）

---

## 背景

2026-08-22 user-observed symptom：

> 「按了 logout 也清乾淨畫面，但 reload 之後又自動登入回去」

追根究柢：

- [apps/frontend/src/services/authService.ts:73-76](apps/frontend/src/services/authService.ts#L73-L76) 的 `logout()` 只 call `setAccessToken(null)` + `setRefreshToken(null)`
- [apps/frontend/src/components/business/dashboard/DashboardHeader/DashboardHeaderActions.tsx:39](apps/frontend/src/components/business/dashboard/DashboardHeader/DashboardHeaderActions.tsx#L39) 的 `<button onClick={logout}>` 不 call 後端
- 後端 `apps/backend/src/modules/auth/index.ts` 沒有 mount `logout` route
- HttpOnly `saome_refresh` cookie 30 天仍有效（[apps/backend/src/modules/auth/routes/login.ts](apps/backend/src/modules/auth/routes/login.ts) 第 28 行 `Max-Age=2592000`）

連鎖反應：

1. 使用者按 Logout → 清掉 sessionStorage 的 access/refresh token
2. Cookie `saome_refresh` 仍活 30 天
3. 任何後續 401（如其他 tab 還在背景 polling）→ [apps/frontend/src/services/httpClient.ts:127-152](apps/frontend/src/services/httpClient.ts#L127-L152) `tryRefresh()` 用 cookie 拿新 token → 「自動登入」
4. F5 reload `/app/dashboard` → `AuthProvider` 對 cookie refresh → 自動登入
5. **使用者看到的「登出」實際完全沒生效**

這條是 silent security bug，沒有 error trace，只有使用者體感「我登出了嗎？」

---

## 選項

### 選項 A：Cookie + JWT Short TTL（MVP 推薦）

logout route 只處理兩件事：

1. 回傳 `Set-Cookie: saome_refresh=; Max-Age=0; Path=/api/auth` 清掉 HttpOnly cookie
2. （無 DB / 無 KV 查詢）即視為 revoke 完成

access token 走現有 8h TTL 自動到期；refresh token 在 cookie 清掉後即使外洩也無法經由 `/api/auth/refresh` 換新 access token。

**優點**：
- 最小 scope，無新 binding、無新 table
- `httpClient.tryRefresh()` 拿到 `null` 就會 throw，使用者下次操作直接走 AuthGuard 推 `/login`
- 既有的 R2 / DB schema 完全不動

**缺點**：
- 偷到的 access token（從 sessionStorage）仍可在 ≤8h 內使用（XSS 後 window 仍可繼續 call API）
- 若 access token 是被偷而非 logout，server 端沒辦法強制失效它

**緩解**：
- F1 評估把 ACCESS_TOKEN_TTL 從 28800s (8h) 縮短到 3600s (1h)，降低影響窗口
- sessionStorage 已經不是 HttpOnly，等於天然對 XSS 有 prevention（只 JS 拿到；不像 cookie 自動隨 request 帶出去）；真正 XSS 仍然有 8h 窗口洩漏，但概率極低

### 選項 B：DB `revoked_tokens` Table（中期完整 revocation）

新增 table：

```sql
CREATE TABLE public.revoked_tokens (
  jti uuid PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revoked_tokens_expires_at ON public.revoked_tokens (expires_at);
```

logout route：

1. decode refresh token → 拿 `jti`
2. INSERT INTO revoked_tokens (jti, expires_at = refresh token 原始 expiry)
3. Set-Cookie clear

`verifyAccessToken` / `verifyRefreshToken` 流程加一段：

```ts
const revoked = await sql`SELECT 1 FROM public.revoked_tokens WHERE jti = ${payload.jti} AND expires_at > now() LIMIT 1`;
if (revoked.length > 0) throw new AuthError('auth.error.tokenRevoked', ...);
```

每個 protected request 多一次 DB hit（但可 cache 在 process memory 上 5s）。

**優點**：
- 完整 revocation — 任何外洩 token 即使在 TTL 內也失效
- 與現有 login_attempts pattern 同型，後端開發熟悉度高

**缺點**：
- 每個 request 多一次 DB read（即使 cache 也是 cache miss 開始的 read storm）
- Hyperdrive connection 寶貴，連線被 deadlock 風險提高
- 需要 `pg_cron` 加 cleanup job（刪除 `expires_at < now()` 的 row 避免 table 無限漲）

### 選項 C：Cloudflare Workers KV Binding + TTL

新增 KV binding：

```jsonc
// wrangler.jsonc
"kv_namespaces": [
  { "binding": "REVOKED_TOKENS", "id": "..." }
]
```

logout route：

```ts
await c.env.REVOKED_TOKENS.put(`jti:${jti}`, '1', {
  expirationTtl: Math.ceil((tokenExpiresAt - Date.now()) / 1000),
});
```

`verifyAccessToken` / `verifyRefreshToken` 多一段：

```ts
const revoked = await c.env.REVOKED_TOKENS.get(`jti:${jti}`);
if (revoked) throw new AuthError('auth.error.tokenRevoked', ...);
```

**優點**：
- KV read < 5ms（Workers 同 region），不打 DB 連線池
- KV 內建 TTL — Row 自動清除，無需 cleanup job

**缺點**：
- 需新增 KV binding，部署後要 rebuild wrangler
- KV eventual consistency：剛寫入的 KV 可能在 ≤60s 內 跨 edge 看到不同結果（但同 edge 不會）
- KV writes 計費（雖然非常少）

---

## 決策

**選擇**：**A** — Cookie + JWT Short TTL（MVP）

**理由**：

1. **現在 ship、後續升級**：B4 的 scope 是「修 visible bug」不是「防 advanced attack」。silent bug 必須盡快修，但完整 revocation 不該擋 scope
2. **risk-graded**：SAOME 目前的威脅模型是「正常的 XSS 防護 + logout UX」，不是「對抗進階持續威脅」。XsS 防禦走 shadcn/Radix，sessionStorage token 不會被 cookie 自動外洩，符合 Zero Trust 對 threat model 的對應
3. **可立即 ship**：現有架構 + 1 route + 1 service + 1 test + 1 frontend 連線就是完整 fix。不需動 schema、不需動 wrangler、不需動 verifyToken（減少 surface regression 風險）
4. **未來升級路徑已鋪好**：這條 commit 會順手把 `revoked_tokens` table schema 用 migration 預留（含 comment `B4-part2-todo: future revocation`），未來做 B 時不用再重新設計

### Trade-offs（誠實列出）

| 取捨 | 影響 | 接受度 |
|---|---|---|
| Access token 失竊後最多 8h 可用 | XSS 攻擊窗口 | 中 — sessionStorage 已比 cookie 安全；同時間內仍能取的不只 access token，refresh token 更有價值，已被 logout 解決 |
| 不在 server side 主動 revoke | 不能「強制 user 立刻登出」需 admin | 接受 — 此需求等真的有再說 |
| 第一次 ship 不立即加 KV/DB binding | 後續要做就是 B 或 C 完整 PR | 接受 — bounce check 後再做 |

---

## 影響

### Backend

| 變動 | 影響 |
|---|---|
| 新 `apps/backend/src/modules/auth/routes/logout.ts` | POST `/api/auth/logout`；接受 cookie OR Authorization Bearer refresh token；無 token 視為 idempotent success；回傳 `Set-Cookie: saome_refresh=; Max-Age=0; Path=/api/auth` 給 cookie-based client；JSON-based client 拿 empty refreshToken |
| 新 `apps/backend/src/modules/auth/services/logoutService.ts` | 純 stateless：只負責把 refresh cookie + refresh token (Bearer) 都 log 一下「token about to expire after this logout」(JSON log); 不寫 DB。 |
| `apps/backend/src/modules/auth/index.ts` | mount `app.route('/logout', logoutRoute)` |
| `apps/backend/src/contracts/auth.ts` | 加 `LogoutResponseDto { loggedOut: true }` |
| `apps/backend/migrations/00X_init_revoked_tokens.sql`（NEW） | 建 table 預留但無應用邏輯 — 加 comment `B4-part2-todo: future revocation` |
| `apps/backend/src/modules/auth/tests/logout.test.ts`（NEW） | 6 vitest case |

### Frontend

| 變動 | 影響 |
|---|---|
| `apps/frontend/src/services/authService.ts` | `logout()` 改 async：先 `httpClient.post('/api/auth/logout')`（失敗也繼續），再清 store |
| `apps/frontend/src/hooks/useAuth.tsx` | `logout` 改 async；內部 call `useNavigate('/login', { replace: true })`；對稱 logout ↔ useAuthRedirect（Rule 022 §1） |
| `apps/frontend/src/config/api.ts` | 加 `paths.logout = '/api/auth/logout'` |
| `apps/frontend/src/components/business/dashboard/DashboardHeader/DashboardHeaderActions.tsx` | `<button onClick={async () => { await logout(); }}>` |
| `apps/frontend/src/hooks/useAuth.test.tsx` | +2 case：logout navigate `/login` + 401 後不該用舊 token silent refresh |
| `apps/frontend/src/i18n/locales/dashboard.{zh-TW,en}.ts` | `dashboardHeader.logoutError`（當 server 端 logout 失敗但 local 已清空時顯示的 toast key；保留給未來 toast 元件用，目前 useAuth.logout 內部 catch 會 swallow error 故暫不顯示，但 key 已備好）|

### 規範層

| Rule | 觸發 | 動作 |
|---|---|---|
| `019-schema-contract-drift.mdc` | `LogoutResponseDto` 新增為合約層 | backend `contracts/auth.ts` + frontend mirror 對齊；conformance test `schema-conformance.test.ts` 加 row |
| `000-modular-design.mdc` Part B | 新 module 結構 | logout route 一個動詞一個檔 + service 一個檔 + test 一個檔 |
| `001-methodology.mdc` L3 Heavy | auth critical chain | Decision Log + code review + production smoke |
| `011-dev.mdc` | commit message format | 必填 Refs / Sync / Verification |

---

## Follow-up (Post-MVP)

| Priority | Task | 評估 |
|---|---|---|
| P1 | 把 ACCESS_TOKEN_TTL 從 28800s 縮到 3600s（8h → 1h） | F1：對使用者體驗 impact（refresh 頻率變高）；分析從 lifetime refresh 次數看 |
| P1 | 加 option B（DB revoked_tokens + pg_cron cleanup） | F1：實際遇到 token 失竊事故時啟動 |
| P2 | 加 option C（KV binding + TTL） | F1：DB read 成為 hyperdrive bottleneck 時啟動 |
| P3 | Session 過期後不 silent refresh，改 pop-up 「session expired, please re-login」 | F2 UX 優化 |

---

## 自問

- **下次怎麼不犯？**
  - Auth-token lifecycle（access / refresh / logout）一起設計；不要 refresh 完成才發現 logout 是半成品
- **哪條 rule 該補？**
  - `015-cloudflare-pages-deploy.mdc` / `AGENTS.md`：加「Logout 必須 server-side cookie-clear + client-side store-clear」紀律
- **哪個 test 該加？**
  - `tests/smoke/auth-logout.spec.ts`：login → dashboard → click logout → expect navigate '/login' + cookie cleared + reload auto-logout
- **Production smoke test 涵蓋哪些**：
  - SEV-2 部分 user failure，但有 workaround（重新登入），所以不阻擋 deploy 但必跑 smoke

## Sync 狀態

- **狀態**：Decision Log 已寫
- **下一步**：B4-2 backend logout (TDD RED → GREEN) → B4-3 frontend logout → B4-4 review + smoke
- **本次 commit 範圍**：Decision Log + backend (route + service + test + contract) + migration 預留（不啟用邏輯）
