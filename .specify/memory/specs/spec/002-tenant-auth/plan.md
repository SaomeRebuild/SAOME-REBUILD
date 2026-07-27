# Implementation Plan: 002 - Tenant Authentication

**Branch**: `002-tenant-auth` | **Date**: 2026-07-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-tenant-auth/spec.md`
**Upstream design**: `C:\Users\user\.cursor\plans\002-tenant-auth_a40159ef.plan.md`(使用者已核准)
**Note**: 這份 plan.md 是「tech stack + 模組邊界」的聚焦版;模組化與共用的細節請回查上游 plan §3(後端)、§4(base URL)、§5(前端)。

---

## Summary

建立「店家註冊/登入/角色分流」閉環。分兩個 repo:`SAOME-REBUILD` 是前端 SPA(React 19 + Vite + Tailwind + react-i18next),負責 UI / 表單 / i18n;`saome-backend`(新 repo)是單一 Cloudflare Worker(Hono + Hyperdrive + Supabase Postgres),單一入口 `/api/<feature>`,首個模組 `auth` 簽發 JWT(access 15min + refresh 30d rotation)、管理 lockout(3 次失敗 / 10 分鐘)、處理註冊 / 登入 / refresh / me。Admin 透過 Supabase migration seed 注入。前後端所有的 zod schema 透過 `packages/shared` 集中管理,後端另外維護一份 cp 副本(SAOME-25 在 `runs/improvements/feedback/` 記錄同步流程)。

## Technical Context

**Language/Version**: TypeScript 7.x strict(Node 20+),with `@types/node` for tooling / shared.
**Frontend Stack**: React 19.2 + Vite 8 + Tailwind 4 + react-i18next 17 + react-router 7 + react-hook-form + zod.
**Backend Stack**: Hono 4.x on Cloudflare Workers(`@cloudflare/vitest-pool-workers`),postgres.js(client),jose(JWT),Password hashing 待決定(`@node-rs/argon2` WASM **或** Web Crypto `pbkdf2` — SAOME-13 用 `verify-this` 跑實測 benchmark 決定)。
**Storage**: Supabase Postgres(透過 Hyperdrive binding 連線)。
**Testing**: Vitest + React Testing Library + Cucumber.js(BDD) + Playwright(smoke)。
**Target Platform**: Serverless(Cloudflare Workers);Browsers(Chrome/Safari/Firefox 2026 LTS-equivalent)Mobile-first RWD。
**Project Type**: monorepo npm workspaces(`SAOME-REBUILD`)+ 獨立 `saome-backend` repo(無 workspaces 耦合)。
**Performance Goals**:
- 後端 `/api/auth/login` p95 < 200ms(Workers cold start < 100ms)
- 前端 First Contentful Paint < 1.5s、登入按鈕到 dashboard 切換 < 2s
- Hyperdrive 連線 pool 共用,單 Worker 撐住 5k RPS 預期
**Constraints**:
- Workers CPU-time limit 30s(註冊含 hash 建議 < 5s)
- 跨 origin 子域(`app.` / `api.`)需要 CORS middleware + 設定 `Domain=.saome.org` cookie
- 不得在 component 內寫業務邏輯(必須抽到 `packages/shared/logic/`)
- 不得使用 Web-only API(`localStorage` 透過 hook 封裝,並注意 SSR/RN 化)
**Scale/Scope**: 1 個 Worker + 1 個前端 SPA + 1 個 Postgres instance + 5 個 user story + 5 個 .feature feature + 11 個 L1 共用元件 + 4 個 L2 業務元件。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 滿足? | 證據 |
|---|---|---|
| I. SDD-First | ✅ | spec.md 已通過 14 條 checklist |
| II. BDD-Validated | ✅ | SAOME-6 抽 5 個 .feature、SAOME-7 跑 `npm run test:bdd` |
| III. TDD-Mandatory | ✅ | SAOME-12 後端 RED → SAOME-13 GREEN;SAOME-14~19 前端 RED→GREEN 全部 stage |
| IV. Superpowers-Integrated | ✅ | Plan §12 列出 12 個必觸發 skill |
| V. Mobile-Future-Proof | ✅ | 業務邏輯全在 `packages/shared/logic/`、Web-only API 透過 hook/service 封裝、UIUX 走設計 token |

> **所有 Gate 通過**;進入 Phase 1 設計。

## Project Structure

### Documentation (this feature)

```text
.specify/memory/specs/spec/002-tenant-auth/
├── spec.md            # SAOME-1 完成
├── plan.md            # 本檔
├── data-model.md      # 同層輸出,DB schema + entity 細節
├── tasks.md           # SAOME-5 從 speckit-tasks 產出
├── checklists/
│   └── requirements.md  # SAOME-1 同時完成
└── features/
    ├── tenant-registration.feature
    ├── tenant-login.feature
    ├── login-rate-limit.feature
    ├── role-based-redirect.feature
    └── bilingual-auth.feature
```

### Source Code (repository root: SAOME-REBUILD)

```text
SAOME-REBUILD/
├── apps/frontend/                       # React 19 SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── form/                # Field, FieldError, PasswordField, SubmitButton
│   │   │   │   ├── layout/              # AuthShell, Stepper
│   │   │   │   └── feedback/            # ErrorBanner, LoadingOverlay, CountdownText, ComingSoonCard, AuthGuard
│   │   │   └── business/auth/           # LoginForm, RegisterFormStep1StoreInfo,
│   │   │                                # RegisterFormStep2Account, AuthLanguageSwitcher
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useLoginLockout.ts
│   │   │   ├── useFormSchema.ts
│   │   │   ├── useCountdown.ts
│   │   │   └── useAuthRedirect.ts
│   │   ├── providers/
│   │   │   ├── AuthProvider.tsx
│   │   │   └── I18nProvider.tsx         # 加強版,auth-aware labels
│   │   ├── services/
│   │   │   ├── httpClient.ts            # 統一 fetch + 401 retry + SaomeApiError
│   │   │   └── authService.ts           # auth-specific
│   │   ├── config/
│   │   │   ├── env.ts                   # zod validate import.meta.env
│   │   │   ├── api.ts                   # apiBaseUrl + api(path)
│   │   │   ├── routes.ts                # /login, /register, /app/dashboard, /admin/dashboard
│   │   │   ├── features.ts              # feature flags
│   │   │   ├── limits.ts                # LOCKOUT_THRESHOLD=3, LOCKOUT_DURATION_MIN=10
│   │   │   └── constants.ts             # 角色、狀態、事件
│   │   ├── pages/
│   │   │   ├── auth/LoginPage.tsx
│   │   │   ├── auth/RegisterPage.tsx
│   │   │   └── dashboard/
│   │   │       ├── ComingSoonAppPage.tsx
│   │   │       └── ComingSoonAdminPage.tsx
│   │   └── i18n/locales/{zh-TW,en}/auth.json   # 拆分 JSON(方案 C)
│   └── tests/smoke/auth-flow.spec.ts    # Playwright
└── packages/shared/
    ├── types/auth.ts                    # User, Tenant, AuthSession, JwtPayload, Role
    ├── schemas/auth.ts                  # zod: LoginCredentials, RegisterStep1/2, taxId, RateLimit
    ├── logic/auth.ts                    # 純函式: getRoleHomePath, isAccountLocked, ...
    ├── constants/role.ts                # ROLE_TENANT, ROLE_ADMIN, ROLE_HOME_PATH map
    ├── i18n/zh-TW.ts                    # 加 auth.* / validation.* 群組
    ├── i18n/en.ts                       # 同上
    ├── bdd/steps/auth.ts                # 共用 step defs
    └── bdd/steps/index.ts               # export 新增
```

### Source Code (new repo: saome-backend)

```text
saome-backend/
├── wrangler.jsonc                       # 單一 Hyperdrive binding
├── migrations/
│   ├── 001_init_users_tenants.sql
│   ├── 002_init_login_attempts.sql
│   └── 003_seed_admin.sql
├── docs/architecture.md                 # 三層分層圖 + 新模組 SOP
├── AGENTS.md                            # 單一 Worker 多模組聲明 + 新增 SOP
├── README.md
├── .gitignore                           # defensive
├── package.json
└── src/
    ├── index.ts                         # Hono app,掛 cors + errorHandler + authModule
    ├── shared/
    │   ├── middleware/
    │   │   ├── cors.ts                  # 3 origin allowlist
    │   │   ├── requestId.ts
    │   │   ├── errorHandler.ts
    │   │   └── auth.ts                  # JWT verify(JWT cookie 必要)
    │   ├── db/
    │   │   ├── client.ts                # postgres.js + Hyperdrive
    │   │   └── transaction.ts
    │   ├── lib/
    │   │   ├── jwt.ts                   # signAccessToken / signRefreshToken / verify
    │   │   ├── password.ts              # argon2 或 PBKDF2
    │   │   ├── errors.ts                # SaomeError 分類
    │   │   └── http.ts                  # 統一 JSON response
    │   └── types.ts                     # 共用 DTO(cp 自 packages/shared)
    ├── contracts/
    │   └── auth.ts                      # 模組對外契約 type + zod,不放實作
    └── modules/auth/                    # 第一個模組(template)
        ├── index.ts                     # authModule Hono sub-app
        ├── routes/
        │   ├── register.ts              # POST /api/auth/register
        │   ├── login.ts                 # POST /api/auth/login
        │   ├── refresh.ts               # POST /api/auth/refresh
        │   └── me.ts                    # GET /api/auth/me(需 JWT)
        ├── middleware/rateLimit.ts
        ├── db/
        │   ├── users.ts
        │   ├── tenants.ts
        │   └── loginAttempts.ts
        ├── schemas/db.ts                # row schema(Worker 內部)
        └── tests/
            ├── auth.test.ts
            ├── login.test.ts
            └── rateLimit.test.ts
```

### Base URL 架構(commit-able 規則)

| 環境 | 前端 | 後端 | 通訊 |
|---|---|---|---|
| Production | `https://app.saome.org`(Cloudflare Pages) | `https://api.saome.org`(Worker Custom Domain → saome-backend) | fetch(`/api/auth/...`)同 origin 走 cookie(`Domain=.saome.org`) |
| Staging | `https://staging.saome.org`(Pages) | `https://api-staging.saome.org`(Worker) | 同上 |
| Local dev | `http://localhost:5173`(Vite) | `http://localhost:8787`(wrangler dev) | Vite `server.proxy` 把 `/api/*` → `localhost:8787`;CORS allow `http://localhost:5173` |

## Complexity Tracking

> **沒有任何 Constitution Violation**;本表留空。
