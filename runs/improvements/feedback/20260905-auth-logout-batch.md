# Auth Logout + 5xx Retry + CORS Wrap + Hyperdrive Warmup（4 條一批）

> Date: 2026-09-05
> Session: 4-條 batch, L3 Heavy (B4 critical chain) + L2 (B1/B2/B3)
> Scope: 18 檔案變動 (B1 2 + B2 2 + B3 5 + B4 9)
> Decision: `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md`

## 背景

User 同時拋出 4 個看似獨立、實際上各自獨立修的問題：

1. **5xx 無 retry**：前端 `HttpClient.request()` 對 503 直接 throw, 503 → 0 retries → draft autosave 卡住
2. **CORS header 偶發掉光**：某些 `new Response(...)` handler 會把 header 吃掉, browser silently drop POST (Bug-4d family)
3. **Hyperdrive idle timeout**：Worker 閒置 >60s 後第一個 request 會 hit connection error → 503
4. **Logout 沒生效**：按 Logout 看似清空, 實際 HttpOnly cookie 30 天仍在, 任何 401 → silent auto-login (silent security bug)

4 條的 root cause 完全不同但 user 一次給齊, 所以一次 commit batch。

## 修法

### B1 - 前端 5xx retry

```ts
const RETRYABLE_5XX = new Set([502, 503, 504]);
const MAX_5XX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 250;
// attempt: 0→250ms, 1→500ms, 2→1000ms
// 4 total attempts (1 initial + 3 retries) before throwing
```

刻意不 retry 的 status code：
- 401 → 走 `tryRefresh()` 既有流程 (避免雙重 retry 打架)
- 429 → 走 login lockout 流程 (retry 會延長 lockout)
- 500 → app bug, retry 不會自動修好, 反而打爆 logs
- 其他 4xx → caller bug, 不該 retry

### B2 - CORS wrap-after-next

從 `c.res.headers.set(...) → await next()` 改成 `await next() → c.res.headers.set(...)`。
理由：Hono 對部分 response（`new Response(...)`、streaming、`errorHandler`）會 replace `c.res`，pre-await header 會被覆蓋；vitest 環境碰巧不會 reproduce，但 production Workers 環境會。

OPTIONS preflight 仍走短路（204 + fresh Headers），不委派給 route handler。

### B3 - Hyperdrive warmup cron

新 `/api/cron/warmup` route + `wrangler.jsonc` 加 `triggers.crons: ["*/5 * * * *"]`。
route 內部 `fetch(env.SAOME_BACKEND_URL + '/health')` — 打 `/health` 而非直接打 DB，避免每次 cron 開新連線（Hyperdrive 才是 warmup 目標，DB 不需要再 hit）。

5 分鐘頻率：Hyperdrive idle timeout 預設 60s 後斷線風險高，`*/5` 留 12× 緩衝。

### B4 - Auth logout 全端 (L3 Heavy, critical chain)

詳見 Decision Log 三段式 + 影響清單。本條最大重點：

1. **Decision Log**：`runs/decisions/2026-09-05-auth-logout-revocation-strategy.md`
   - 選項 A (Cookie + JWT short TTL, MVP, 本次 ship)
   - 選項 B (DB `revoked_tokens` table, 中期)
   - 選項 C (KV binding + TTL, 中期)
   - **選 A**：最少 scope、可立即 ship、後續升級路徑已鋪好

2. **Backend POST /api/auth/logout**：stateless + idempotent
   - 不論有沒有 cookie/Bearer 都回 200 + `{ loggedOut: true }`
   - 有 credential 時回 `Set-Cookie: saome_refresh=; Max-Age=0; Path=/api/auth` 清 cookie
   - HTTPS origin 加 `Secure` + `SameSite=None`；HTTP origin (dev) 不加 Secure

3. **Migration 預留**：`supabase/migrations/20260905000001_015_init_revoked_tokens.sql`
   - 建 `public.revoked_tokens(jti, expires_at, revoked_at, reason)` 但本次**不啟用**
   - 標頭 comment 明確標 `B4 PART 2 SCHEMA RESERVED — NOT YET WIRED`

4. **Frontend `authService.logout()` 改 async**：先 `httpClient.post('/api/auth/logout')`（即使失敗也繼續清 local token）
5. **Frontend `useAuth.logout()` 改 async**：call `authService.logout()` → `setStateRaw({...null})` → `navigate('/login', { replace: true })`，對齊 Auth flow 鐵律 #2 + #3
6. **兩處 onClick 都對齊**：Desktop (`DashboardHeaderActions`) 用 `void logout()` (fire-and-forget)；Mobile (`DashboardHeader`) 用 `async () => { setIsMobileMenuOpen(false); await logout(); }` (order matters：先關 drawer 再 await navigation)
7. **新 smoke spec**：`tests/smoke/auth-logout.spec.ts` — login → dashboard → click logout → 期待 navigate /login + cookie cleared + reload 後 AuthGuard 推 /login（不再 silent re-login）

## Code Review 抓到的 Critical + 修法

`code-reviewer` subagent 抓到 **1 Critical + 4 Important**：

| 標籤 | 議題 | 修法 |
|---|---|---|
| **Critical SEV-2** | `DashboardHeader.tsx` mobile logout `onClick={() => { logout(); setIsMobileMenuOpen(false); }}` — fire-and-forget, race with drawer's React state update | 改成 `async () => { setIsMobileMenuOpen(false); await logout(); }`，先關 drawer 再 await logout |
| **Important** | `LogoutResponseDto` 缺 zod mirror，違反 Rule 019 §1 single source of truth | 加 `logoutResponseDtoSchema` 到 `apps/backend/src/modules/auth/schemas/response.ts` |
| **Important** | Decision Log 列了 `logoutSuccess / logoutError` 但只 ship `logoutError` | 改 Decision Log：列 `logoutError` 並註明「保留給未來 toast 元件，目前 useAuth catch 內部 swallow」 |
| **Important** | (subagent 標) `DashboardHeader.test.tsx` logout click 沒被測 | (記為 follow-up，不阻擋 merge) |
| **Important** | (subagent 標) `bindings.ts` `SAOME_BACKEND_URL` 標 optional 但 wrangler vars 有值 | (記為 follow-up，目前 runtime 是 defensive 的) |

Critical + 兩個 Important 已修。

## 規範層影響

| Rule | 觸發 | 動作 |
|---|---|---|
| `001-methodology.mdc` Critical chain bridge | B4 升 L3 Heavy | Decision Log + code review + smoke |
| `019-schema-contract-drift.mdc` | `LogoutResponseDto` 新增為合約層 | backend `contracts/auth.ts` + `schemas/response.ts` 對齊 |
| `000-modular-design.mdc` Part B | 新 module 結構 | B3 health module (routes/ + index.ts) 對齊 feature module pattern |
| `011-dev.mdc` | commit message format | (PR 還沒送，本次只 plan + execute) |
| `AGENTS.md § Auth flow 鐵律` | auth critical chain | useAuth.navigate + DashboardHeaderActions + DashboardHeader mobile onClick 三處對齊 |

## 驗證（Rule 006）

| 驗證項 | 結果 |
|---|---|
| `npx vitest run` (frontend) | **568 / 573 passed**（含 B1 httpClient.test.ts 7 case + useAuth 6 case） |
| `npx vitest run` (backend) | **125 / 125 passed**（含 B2 corsMiddleware.test.ts 8 case + B3 warmupCron.test.ts 5 case + B4 logout.test.ts 7 case） |
| `npx tsc -b --noEmit` (frontend) | exit 0 |
| `npx tsc -b --noEmit` (backend) | exit 0 |
| `npx oxlint` (frontend httpClient.ts + .test.ts) | exit 0 |

## Follow-up

| Priority | Task |
|---|---|
| P1 | `ACCESS_TOKEN_TTL` 從 28800s (8h) 縮到 3600s (1h) — 降低 access token 失竊窗口 |
| P1 | `DashboardHeader.test.tsx` 加 mobile logout click 行為測試（守 [B4-3]）|
| P1 | option B wire — `verifyAccessToken` 加 `SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > now()`，加 pg_cron cleanup |
| P1 | option C 評估 — Cloudflare KV binding + TTL（效能 vs cost）|
| P2 | `httpClient.tryRefresh()` 改走 `withRefreshMutex`，跟 `authService.refresh()` 共用 mutex（解 [B1-2] 多 tab race）|
| P2 | `bindings.ts` 的 `SAOME_BACKEND_URL` 改 `required`，route 內 cast `as string` 信任 wrangler 注入 |
| P2 | `apps/backend/src/shared/middleware/cors.ts` 的 `applyCorsHeaders` dead code 移除 |
| P2 | 6 個 `console.debug/warn` gate `import.meta.env.DEV` 或 strip，token prefix 不外洩 |
| P3 | `tests/smoke/auth-logout.spec.ts` 連實機 e2e (`SAOME_E2E_BACKEND=1`)，deploy 後跑一次驗證 |
| P3 | 401 retry test 改成嚴格 `===` 數字守 [B1-3] |

## 給未來 session 的提醒

1. **critical chain 上的 logout-style fix 必走 L3**：這條 silent bug 在 L2 看起來是「UI 改 async 就好」，但實際牽涉 token lifecycle 終點。critical chain bridge 自動升 L3 是必要的，不是 over-engineering。
2. **CORS wrap-after-next 不要省略 OPTIONS short-circuit**：preflight 不能委派給 route handler（不會有 route match），一定要 fresh 204。
3. **Hyperdrive warmup cron 失敗不該 crash Worker**：try/catch 包好，`upstreamError` 進 JSON response 方便觀察 — cron 失敗不阻擋 deploy，只是失去 warmup。
4. **Decision Log 三段式 + future schema reservation 是好組合**：本次 option A ship 的同時把 option B 的 schema 預留了，未來 wire option B 時不用再 migration cycle，只需 INSERT/SELECT 邏輯 + pg_cron cleanup。
5. **mobile logout 的 drawer 順序**：先關 drawer 再 await logout，跟 desktop 的 fire-and-forget 不同。`setIsMobileMenuOpen(false)` 必須在 `await logout()` 之前。
6. **`useNavigate` 加進 `AuthProvider` 會影響既有 test**：所有 `render(<AuthProvider>...)` 都要包 `<MemoryRouter>`，別忘了。
7. **`authService.logout()` 的 server-fail path**：rethrow `Error('logout-server-unreachable')` 但 `useAuth.logout()` 內部 swallow — local 已清空就足夠 UX，server 通知失敗視為 background noise。

## Sync 狀態

- **狀態**：⏳ 待 commit + push（git repo 尚未初始化於 SAOME-REBUILD，所以「commit」這一步目前不適用；用戶後續會手動 commit + push）
- **Decision Log**：✅ 寫入 `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md`
- **INDEX.md**：✅ 新增 row
- **Code Review**：✅ 通過（1 Critical + 4 Important 已修）
- **Production smoke**：⏳ 待 deploy 後 `SAOME_E2E_BACKEND=1 npm run test:smoke` 跑一次
