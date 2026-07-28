# SAOME Backend (Worker)

SAOME 平台的 Cloudflare Worker 後端,單一 Worker 多模組架構。

對應規格:`SAOME-REBUILD/.specify/memory/specs/spec/002-tenant-auth/`

## Stack

| Layer | Tech |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| Database | Supabase Postgres (via Hyperdrive) |
| Auth | JWT (HS256, jose) |
| Password hashing | Argon2id or PBKDF2 (decided per `verify-this` skill) |
| Validation | Zod |
| Test | Vitest + @cloudflare/vitest-pool-workers |

## Quick Start

```bash
npm install
npm run dev          # http://localhost:8787

# Run tests
npm test

# Type check
npm run typecheck

# Deploy
npm run deploy
```

## Architecture

詳見 [`docs/architecture.md`](./docs/architecture.md) 與 [`AGENTS.md`](./AGENTS.md)。

```
HTTP → src/index.ts → src/modules/auth/ → src/shared/{db,lib,middleware}
                                                  ↑
                                            Hyperdrive binding
                                                  ↓
                                            Supabase Postgres
```

## Endpoints (MVP:auth)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | public | 店家註冊(回傳 access token + Set-Cookie refresh) |
| `POST` | `/api/auth/login` | public | Email/password 登入(3 次失敗鎖 10 分) |
| `POST` | `/api/auth/refresh` | cookie | 用 refresh token 換新 access token(rotation) |
| `GET` | `/api/auth/me` | bearer | 取目前登入者公開資訊 |
| `GET` | `/health` | public | 健康檢查 |

## Database Migrations

Migrations 存於 `migrations/`,透過 Supabase MCP `apply_migration` 套用:

| File | Description |
|---|---|
| `001_init_users_tenants.sql` | users / tenants 表 + index + constraints |
| `002_init_login_attempts.sql` | login_attempts 表 + rate-limit query 用 index |
| `003_seed_admin.sql` | 手動 seed 一個 admin 帳號 |

## Environment Variables

| Var | Required | Description |
|---|---|---|
| `HYPERDRIVE` | yes | Cloudflare binding,Postgres connection pool |
| `JWT_SECRET` | yes | HS256 signing key(min 32 chars) |
| `ACCESS_TOKEN_TTL` | optional | seconds;default 900 (15 min) |
| `REFRESH_TOKEN_TTL` | optional | seconds;default 2592000 (30 day) |
| `ALLOWED_ORIGINS` | optional | CORS allowlist;comma-separated origins;default `localhost:5173` |

Local dev 用 `.dev.vars`(git ignored);production 用 `wrangler secret put`.

### JWT_SECRET 在 production 的注入方式(Bug-4)

```bash
# Generate a random 32-byte hex secret locally
openssl rand -hex 32

# Inject into the deployed Worker
cd apps/backend
npx wrangler secret put JWT_SECRET --name saome-backend
# paste the secret at the prompt

# Verify it's set
npx wrangler secret list --name saome-backend
```

If `JWT_SECRET` is not set in the Worker env, `loginService` and `refreshService`
fall back to `dev-insecure-secret`. This is **not safe for production** — anyone
can forge tokens with the public fallback. Always inject the secret before going live.

### Cookie Domain(Bug-4)

The refresh cookie's `Domain=` attribute is derived per-request from the
`Origin` header by [`src/shared/lib/cookieDomain.ts`](./src/shared/lib/cookieDomain.ts):

| Request Origin | Set-Cookie Domain |
|----------------|-------------------|
| `https://app.saome.org` / `https://admin.saome.org` | `Domain=.saome.org` |
| `https://saome-frontend.pages.dev` / `*.workers.dev` / `http://localhost:5173` | omitted (browser scopes to exact host) |
| missing | omitted |

This lets a single deployment serve both the Cloudflare Pages preview origins
and the future `*.saome.org` production origins without manual config flips.

## Wrangler

`wrangler.jsonc` 含:

```jsonc
{
  "name": "saome-backend",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-27",
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<to-fill-in>" }]
}
```

`HYPERDRIVE_ID` 由 SAOME-11 階段:apply migrations 後,使用 Cloudflare dashboard 建立 Hyperdrive → 取得 ID → 填入此處。

## Path Note

> 此 backend **位於 SAOME-REBUILD monorepo 內**(`apps/backend/`),不是獨立的 sibling repo。
> 這是有意決定(基於 2026-07-28 的協作討論),簡化 schema 同步、unified version control。

## License

UNLICENSED — internal SAOME platform.