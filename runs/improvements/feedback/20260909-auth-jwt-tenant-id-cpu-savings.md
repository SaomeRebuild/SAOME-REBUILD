# Feedback — 2026-09-09 Auth JWT `tenant_id` + Trust JWT (CPU savings on Free plan)

> Companion to `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`.
> Same commit per `.cursor/rules/011-dev.mdc` Feedback 同 commit 規則。

## 症狀

- `/api/auth/login` 在 Cloudflare Workers Free plan 觸發 1102（`exceededCpu`）機率 ~100%。
- `/api/auth/refresh` 同樣高機率 1102。
- 受保護路由（cards / pass / `/api/auth/me`）每個都付 `findUserById` + `is_active` DB cost。

## Root Cause

Free plan CPU budget = 10 ms。DB I/O 不算 CPU，但以下 JS-side 工作累積已逼近 10 ms：

| Item | 來源 | CPU 成本 |
|---|---|---|
| `getDb()` warmup `SELECT 1`（重複：rateLimit middleware 1 次 + login route 1 次）| `apps/backend/src/shared/db/client.ts:65-77` | 兩次 eager ping，~5–10 ms wall-clock（雖然 I/O 不算 CPU，但會增加 isolate 內 JS 處理時間） |
| `findUserByEmail` + `findTenantByOwnerId` 兩次 round-trip | loginService.ts:39 + :65 | 兩次 query 解析 + JS object mapping |
| `requireAuth` 每個受保護路由：`findUserById` + `is_active` check | `apps/backend/src/shared/middleware/auth.ts:60-82` | 額外 round-trip + row mapping |
| `verifyPassword` (scrypt N=1024) | `apps/backend/src/shared/lib/password.ts:113-130` | 3–5 ms（見先前 feedback） |
| `signAccessToken` + `signRefreshToken` (HS256 via jose) | `apps/backend/src/shared/lib/jwt.ts:56-81` | sub-ms each, 兩次 per login |
| `jwtPayloadSchema.parse` in `verifyToken` | `apps/backend/src/shared/lib/jwt.ts:117-127` | zod parse on every verify |

## 修法（本次 commit）

### 1. `getDb` per-request memoization

新增 `getDbForRequest(c)`，cache `sql` instance 在 `c.var.db`；同 request 內只建立一次 pool + warmup 一次。

```typescript
// apps/backend/src/shared/db/client.ts
export async function getDbForRequest(
  c: Pick<Context<HonoEnv>, 'get' | 'set'>
): Promise<Sql> {
  const cached = c.get('db') as Sql | undefined;
  if (cached) return cached;
  const sql = await getDb(c.env.HYPERDRIVE);
  c.set('db', sql as never);
  return sql;
}
```

- 14 個已有 `c` 的 route / middleware 改用 `getDbForRequest(c)`。
- `index.ts::scheduled` cron（無 `c`）維持原 `getDb(env.HYPERDRIVE)`。

### 2. JWT carries `tenant_id`

`packages/shared/schemas/auth.ts::jwtPayloadSchema` 加 `tenant_id: z.string().uuid().optional()`。
`apps/backend/src/shared/lib/jwt.ts::jwtPayloadSchema` 同步 mirror。

`signAccessToken` / `signRefreshToken` payload 形狀補 `tenantId?: string`；用 `SignJWT.setClaims` 把 `tenantId` 寫進 token。

### 3. Trust JWT for user identity

`requireAuth` middleware：

- 移除 `findUserById` 與 `is_active` DB check（line 65–82）。
- `c.set('user', { id: payload.sub, email: payload.email, role: payload.role, tenantId: payload.tenantId })`。
- 保留 `isTokenRevoked`（Phase 2.2 撤銷機制）。

`refreshService`：

- 移除 `findUserById` + `is_active` check（line 46–55）。
- 直接從 payload 拿 `tenantId` → `findTenantById(sql, tenantId)`。

`loginService`：

- 新 helper `findUserAndTenantByEmail(sql, email)`（LEFT JOIN `users` + `tenants`）。
- 一次 round-trip 取 user + tenant。

`meRoute` / 9 個 cards routes / `passRoutes.get('/current')`：

- 移除 `findTenantByOwnerId(sql, user.id)`。
- 用 `findTenantById(sql, user.tenantId)`（PK lookup）。

## 預期效果

| 指標 | Before | After |
|---|---|---|
| 1102 機率（Free plan） | ~100% | ~10–20% |
| Login 端 DB round-trip | 8–9 次 | 7 次（少 1 次 `findTenantByOwnerId`） |
| 每次 request `getDb` warmup | 2 次 | 1 次 |
| 受保護路由 DB hit | `isTokenRevoked` + `findUserById` + `findTenantByOwnerId` + business | `isTokenRevoked` + `findTenantById`（PK）+ business |
| JWT payload bytes | ~190 bytes | ~230 bytes（+40 bytes tenant_id） |

## Trade-offs（已寫進 Decision Log）

| 項目 | 影響 |
|---|---|
| `is_active` 即時性（非撤銷類停權） | 需等 access token 到期（最多 1h） |
| User 刪除後舊 token | 仍可撐到 TTL；可接受（access TTL 短） |
| Tenant owner 換 tenant | 舊 token 仍指舊 tenant.id，直到 refresh |

## Validation（Rule 006）

- `npx tsc -b --noEmit`：exit 0
- `npm test --workspace=apps/backend`：新增 27 條 test，全綠
- `npm run check:migrations --workspace=apps/backend`：exit 0（無 SQL migration）
- Production smoke：
  - OPTIONS preflight：204 + ACAO
  - POST login 401 / 200：ACAO 必有
  - evil origin POST：無 ACAO
  - wrangler tail：no `exceededCpu`、no 1102

## 參照

- `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`
- `apps/backend/src/shared/db/client.ts`（新增 `getDbForRequest`）
- `apps/backend/src/shared/middleware/auth.ts`（trust JWT）
- `apps/backend/src/shared/lib/jwt.ts`（payload shape）
- `packages/shared/schemas/auth.ts`（shared schema）
- `apps/backend/src/modules/auth/db/users.ts`（`findUserAndTenantByEmail`）
- `apps/backend/src/modules/auth/db/tenants.ts`（`findTenantById`）
- `apps/backend/src/modules/auth/services/loginService.ts`（LEFT JOIN）
- `apps/backend/src/modules/auth/services/refreshService.ts`（trust JWT）
