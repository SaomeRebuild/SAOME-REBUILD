# Decision: JWT carries `tenant_id`; trust JWT for `user.id/role/tenant_id` (drop `findUserById` and `findTenantByOwnerId`)

Date: 2026-09-09
Status: accepted (L3 Heavy — auth critical chain)
Owner: backend (saome-backend Worker)
Refs:
- `runs/improvements/feedback/20260909-login-1102-workers-free-cpu-budget-scrypt.md`
- `runs/improvements/feedback/20260909-auth-jwt-tenant-id-cpu-savings.md` (same commit, per Rule 011)
- `.cursor/rules/001-methodology.mdc` § Critical chain bridge
- `.cursor/rules/019-schema-contract-drift.mdc` § 4.1 (four-layer sync)
- `.cursor/rules/036-worker-runtime-cors-defense.mdc`

## 背景

`/api/auth/login` 與 `/api/auth/refresh` 在 Cloudflare Workers Free plan 上穩定觸發 1102（`exceededCpu`）。Root cause：

1. `getDb()` 每次呼叫都建立新 pool + eager `SELECT 1` warmup；同一 request 內 `rateLimit` middleware + login route 各呼叫一次 → 兩次 warmup。
2. Login / refresh 串接 8–9 次 DB round-trip（含 `findUserByEmail`、`findTenantByOwnerId`、`isTokenRevoked`、`insertLoginAttempt`、`advanceBillingCycle`、`getPassStatus`）。
3. `requireAuth` middleware 額外跑 `findUserById` 與 `is_active` DB 檢查（每個受保護路由都付這筆成本）。
4. Free plan CPU budget = 10 ms（wall-clock DB I/O 不算 CPU，但 cold-pool warmup 與 JS 端 JWT verify / zod parse / scrypt 都算）。

JWT 已包含 `sub`、`email`、`role`、`iat`、`exp`、`jti`，足以在 `requireAuth` 內信任 user 身分；新增 `tenant_id` 可在所有受保護路由中直接讀 tenant ID，省去 `findTenantByOwnerId`。

## 選項與決定

| 選項 | 摘要 | 1102 機率 | 評估 |
|---|---|---|---|
| A | **採納**：JWT 加 `tenant_id`；`requireAuth` 與 refresh 不再查 `users`；用 `findTenantById`（PK lookup）取代 `findTenantByOwnerId`；`loginService` 用 `findUserAndTenantByEmail` LEFT JOIN 把 user + tenant 合併成一次 round-trip；`getDbForRequest(c)` memoize `sql` instance | ~10–20%（剩餘為不可消除的 scrypt + JWT sign） | ✅ 採納 |
| B | 只在 `requireAuth` 砍 `findUserById`；refresh 仍查 user + active；其他路由仍用 `findTenantByOwnerId` | ~50–60% | 改動小但 CPU 改善有限；refresh 路徑仍是熱點 |
| C | 保留所有 DB lookup，只動 `getDb` memoization | ~60–80% | 唯一安全無 regression 的小改；但不足以解 1102 |
| D | 升 Paid plan | 0% | 唯一 100% 解方；超出本次 scope |

**決定**：選項 A。

理由：
1. **critical chain** — auth 必須走 production smoke test 才能 ship，且需最大幅降 CPU。
2. **JWT 已是最小信賴源** — HS256 簽章 + Phase 2.2 `revoked_tokens`（in-process cache + DB hit）已擋掉撤銷；剩下的 `is_active` 變化延遲到 access TTL（15 min / 1h），屬可接受 trade-off。
3. **shared schema 四層同步** — 加 `tenant_id` optional claim 對 frontend 完全透明（後端 fallback 為 admin）。
4. **I/O isolation** — `getDbForRequest` 只用 `c.var`（Hono context），不跨 request，Workers I/O 隔離仍守。

## 影響

### 直接影響

- **新增 `tenant_id` JWT claim**（optional；admin 不帶；tenant 帶 UUID）。
- **`requireAuth` 移除 `findUserById` 與 `is_active` DB 檢查**（line 65–82 of `apps/backend/src/shared/middleware/auth.ts`）。
- **`refreshService` 移除 `findUserById` 與 `is_active`**（line 46–55）。
- **`loginService` 改用 `findUserAndTenantByEmail`**（LEFT JOIN，一次 round-trip 取代 `findUserByEmail` + `findTenantByOwnerId` 兩次）。
- **`meRoute`、9 個 cards routes、`passRoutes.get('/current')` 改用 `findTenantById`（PK lookup）+ JWT `tenantId`**。
- **`shared/db/client.ts` 新增 `getDbForRequest(c)`**，memoize `sql` instance 在 `c.var.db`，僅在同 request 內 reuse。

### 間接影響

- **Backend request schema**：`apps/backend/src/shared/lib/jwt.ts` `jwtPayloadSchema` 與 `signAccessToken` / `signRefreshToken` payload shape 補 `tenantId`。
- **Shared schema**：`packages/shared/schemas/auth.ts::jwtPayloadSchema` 加 `tenant_id: z.string().uuid().optional()`。
- **Bindings**：`apps/backend/src/shared/types/bindings.ts::HonoEnv.Variables.user` 加 `tenantId?: string`；`Variables.db?: Sql`。
- **測試更新**：7 個 `vi.mock('@/shared/db/client', ...)` factory 補 `getDbForRequest: vi.fn(...)`；新增 4 個 test 檔（`client.test.ts`、`jwt.test.ts`、`auth.test.ts`、`conformance.test.ts`）共 27 條新 test。
- **既發 token**：缺 `tenant_id` 視為 admin；前端 `AuthProvider` mount 時 refresh 失敗 → loading=false → user 走 `/login`。

### 安全 trade-off（已接受）

- **`is_active` 即時性**：撤銷（revoke）仍由 Phase 2.2 `revoked_tokens` 表擋（`isTokenRevoked` DB hit + in-process 5s cache）；非撤銷類停權（如 admin 把 user 設為 inactive）需等 access token 到期（最多 1h，access TTL）。
- **User 刪除 race**：JWT 已驗簽代表 user 在簽發時存在；刪除後舊 token 仍可撐到 TTL。可接受（access TTL 短）。
- **Tenant ID 變更**：`tenant_id` 寫進 token 後若 owner 換 tenant，舊 token 仍可讀舊 tenant.id，直到 refresh 後才更新。視為低風險（owner 換 tenant 是極低頻操作）。

### 不可逆變更

- JWT payload shape 擴增（加 optional claim）— 前端不存 token，僅 sessionStorage；user 重登即恢復。
- `findTenantByOwnerId` 在 cards / pass / me 路徑移除，改用 PK lookup（效能更佳，但 query 模式改變）。

### 不在本次 scope

- 升 Paid plan（需 owner decision）。
- `verifyPassword` outcome per-request cache（仍會有 5 ms scrypt CPU；屬後續 P1）。
- `jwtPayloadSchema.parse` 結果 per-request cache（sub-ms，等下一輪再觀察）。
