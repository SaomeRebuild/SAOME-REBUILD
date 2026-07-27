# saome-backend Architecture

> 對應規格:`../../.specify/memory/specs/spec/002-tenant-auth/`
> 同步日期:2026-07-28

## 一句話總覽

**單一 Cloudflare Worker,內部以 Hono route 分多模組,共用一條 Hyperdrive → Supabase Postgres 連線。**

```
Browser ──HTTPS──▶ api.saome.org (Cloudflare Worker)
                       │
                       ▼
              ┌──────────────────────┐
              │  src/index.ts         │ ← Hono app,掛 cors/requestId/errorHandler
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  src/modules/auth/    │ ← Feature module (註冊/登入/refresh/me)
              │  ├── routes/          │ ← req → service 呼叫 + zod parse
              │  ├── middleware/      │ ← rateLimit (module 內專用)
              │  ├── db/              │ ← SQL queries (postgres.js)
              │  ├── schemas/         │ ← zod request/response
              │  ├── services/        │ ← 業務邏輯
              │  └── tests/           │ ← vitest
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  src/shared/          │ ← 全 Worker 共用
              │  ├── middleware/      │    (cors, requestId, errorHandler, auth/JWT)
              │  ├── db/client.ts     │ ← getDb(env) Hyperdrive → sql instance
              │  ├── lib/             │    (jwt, password, saomeError)
              │  └── types/           │    (Env bindings)
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Hyperdrive binding   │ ← Postgres connection pool
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Supabase Postgres    │ ← users / tenants / login_attempts
              └──────────────────────┘
```

## 三層分層圖

### Layer 1:`src/index.ts` — 應用入口

唯一對外暴露的檔案,負責:

1. 建立 Hono app
2. 掛全域 middleware:`cors`、`requestId`、`errorHandler`
3. 把 module 掛上:`app.route('/api/auth', authModule)`
4. `export default app`

**不會**做任何業務邏輯;route 定義完就結束。

### Layer 2:`src/modules/<feature>/` — 功能模組

每個 feature 一個資料夾。`auth` 是第一個 module。內部結構固定:

| 子目錄 | 角色 |
|---|---|
| `index.ts` | Hono sub-app,export `<feature>Module` |
| `routes/` | 每個 endpoint 一個檔案:`register.ts` / `login.ts` / `refresh.ts` / `me.ts` |
| `middleware/` | 該 module 專用的 middleware(如 rateLimit) |
| `db/` | 純 SQL 查詢函式;**不**含業務邏輯 |
| `schemas/` | request/response zod schemas;`db.ts` 是 row shape(內部) |
| `services/` | 業務邏輯(transaction / orchestration / 跨表操作) |
| `tests/` | vitest unit tests |

**鐵律**:
- routes → service → db(sql)
- routes 一定先過 zod
- 業務邏輯在 service,**不**在 route
- SQL 在 db,**不**在 service(除非 transaction 需要 inline SQL,須明確標註)

### Layer 3:`src/shared/` — 共用基礎

跨模組共用的部分。**任何** module 想用這層的東西,直接 import 即可。

| 子目錄 | 角色 |
|---|---|
| `middleware/auth.ts` | JWT verify 函式;`requireAuth(c)` 把 user 寫入 context |
| `db/client.ts` | `getDb(env)` 回傳 sql 實例(綁定 Hyperdrive) |
| `lib/jwt.ts` | `signAccessToken` / `signRefreshToken` / `verifyToken` |
| `lib/password.ts` | `hashPassword` / `verifyPassword`(演算法選定後**不**變動) |
| `lib/saomeError.ts` | `SaomeError` class,統一錯誤型別 + 對應 HTTP status |
| `types/bindings.ts` | `Env`、`HyperdriveBindings` 型別 |

**禁止** module 直接:
- `import { HYPERDRIVE } from 'cloudflare:workers'` — 一律走 `shared/db/client.ts`
- `import { SignJWT } from 'jose'` — 一律走 `shared/lib/jwt.ts`
- `bcrypt.hash(...)` — 一律走 `shared/lib/password.ts`

## 新模組 SOP(寫進 AGENTS.md 的同名段落)

```bash
# 1. 從 auth 模組複製樣板
cp -r src/modules/auth src/modules/<new-feature>

# 2. 改 routes/index.ts 對應新的 endpoint 邏輯

# 3. 換 db/* 對應新的 table 名稱

# 4. 寫對外 DTO 到 src/contracts/<new-feature>.ts
#    (前端會對這個檔 import 型別)

# 5. 在 src/index.ts 加 route 掛載
#    app.route('/api/<new-feature>', newFeatureModule)

# 6. 寫 migrations/<next>_init_<new-feature>.sql

# 7. Supabase MCP apply_migration 套用

# 8. vitest run 全綠確認
```

## 與 frontend 共享

| 項目 | 同步方式 |
|---|---|
| Zod schemas | 從 `../../packages/shared/schemas/auth.ts` `cp` 進 `src/shared/schemas/from-shared/auth.ts`,後端用 `import { ... } from '@/shared/schemas/from-shared/auth'` |
| JWT payload shape | 同上 |
| i18n 錯誤 key | 後端 throw `SaomeError` 時,i18n key 是字串常數(如 `'auth.error.emailTaken'`);由 frontend 透過 `t('auth.error.emailTaken')` 解析 |

**為什麼不直接 npm install `@saome/shared`?**

- `packages/shared` 是 SAOME-REBUILD monorepo 內 private workspace
- 跨 repo / 跨 package source-of-truth 容易漂移
- 採 `cp + git history` 同步,並由 `runs/improvements/feedback/20260728-shared-sync.md` 收尾

## 部署

```bash
# 一次性:Cloudflare dashboard 建立 Hyperdrive,取得 ID,填入 wrangler.jsonc

# Deploy
npm run deploy
# = wrangler deploy

# 設 secret
wrangler secret put JWT_SECRET
```

## 觀察性

- `wrangler tail` 即時看 log
- `wrangler observability`(dashboard)看 metrics
- 結構化 log(JSON):`{ level, requestId, module, action, status, duration }`

## Open Items(實作時填入)

| 項目 | 觸發 task | 來源 |
|---|---|---|
| `HYPERDRIVE_ID` | SAOME-11 | Cloudflare dashboard |
| `JWT_SECRET` 設定 | SAOME-11 後 | `wrangler secret put` |
| Password 演算法 | SAOME-13 | `verify-this` skill 結論 |
| Admin seed 密碼 | SAOME-11 | spec §15 暫定 `ChangeMe!2026-saome` |