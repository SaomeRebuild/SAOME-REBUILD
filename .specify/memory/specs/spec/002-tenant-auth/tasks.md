# Tasks: 002 - Tenant Authentication

**Input**: Design documents from `/specs/002-tenant-auth/`
- [spec.md](spec.md)(WHAT/WHY)
- [plan.md](plan.md)(tech stack、模組邊界)
- [data-model.md](data-model.md)(users / tenants / login_attempts)

**Prerequisites**: plan.md ✅ spec.md ✅ data-model.md ✅
**Tests**: TDD-MANDATORY per `.specify/memory/constitution.md` principle III;tests always written FIRST
**Organization**: Tasks grouped by user story(P1 = US1 + US2 as MVP / P2 = US3 + US4 + US5)

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel(different files, no dependencies)
- **[Story]**: US1 = Tenant Registration / US2 = Tenant Login / US3 = Bi-lingual UI / US4 = Account Lockout / US5 = Role-based Landing
- All paths are absolute under repo root unless prefixed `saome-backend/`

---

## Phase 1: Setup(Shared Infrastructure)

**Purpose**: 跨 user story 共享的基礎建設。

- [ ] T001 Create `.specify/memory/specs/spec/002-tenant-auth/{features,checklists}` directories
- [ ] T002 [P] Verify `packages/shared/package.json` exports section includes `types`, `schemas`, `logic`, `constants`, `i18n`, `bdd`
- [ ] T003 [P] Add `"test:bdd": "cucumber-js"` npm script to root `package.json`
- [ ] T004 [P] Add `auth.json` to `apps/frontend/src/i18n/locales/{zh-TW,en}/` i18n config(seed empty namespaces first)

---

## Phase 2: Foundational(Blocking Prerequisites)

**Purpose**: 任何 user story 都依賴的共用基礎。**必須完成才能進 User Story**。

- [ ] T005 Extend `packages/shared/types/index.ts` to export `./auth`
- [ ] T006 Create `packages/shared/types/auth.ts` with `Role`, `User`, `Tenant`, `AuthSession`, `JwtPayload`, `LockoutState`
- [ ] T007 Extend `packages/shared/schemas/index.ts` to export `./auth`
- [ ] T008 Create `packages/shared/schemas/auth.ts` with `roleSchema`, `loginCredentialsSchema`, `registerStep1Schema`, `registerStep2Schema`, `tenantInfoSchema`, `taxIdSchema` (`"0" || 8 digits` refiner), `lockoutStateSchema`, `jwtPayloadSchema`
- [ ] T009 Extend `packages/shared/logic/index.ts` to export `./auth`
- [ ] T010 Create `packages/shared/logic/auth.ts` with `getRoleHomePath(role: Role): string`, `getLockedSecondsRemaining(attempts: number, nowMs: number): number`, `isAccountLocked(failuresInWindow: number, nowMs: number): boolean`
- [ ] T011 Extend `packages/shared/constants/index.ts` to export `./role`
- [ ] T012 Create `packages/shared/constants/role.ts` with `ROLE_TENANT = 'tenant'`, `ROLE_ADMIN = 'admin'`, `ROLE_HOME_PATH` map
- [ ] T013 [P] Extend `packages/shared/i18n/zh-TW.ts` with `auth.{login,register,lockout,comingSoon}` + `validation.{required,email,passwordTooShort,passwordMismatch,taxIdInvalid,lockedOut}` keys
- [ ] T014 [P] Extend `packages/shared/i18n/en.ts` with same keys in English
- [ ] T015 Extend `packages/shared/bdd/steps/index.ts` to export `./auth`
- [ ] T016 Create `packages/shared/bdd/steps/auth.ts` with reused step definitions (Given/When/Then for auth journeys — placeholder,SAOME-6 fills in)
- [ ] T017 [P] Create `apps/frontend/src/i18n/locales/zh-TW/auth.json` with the same keys (mirroring shared logic)
- [ ] T018 [P] Create `apps/frontend/src/i18n/locales/en/auth.json` with same keys in English
- [ ] T019 Update `apps/frontend/src/i18n/index.ts` to explicit import + spread merge(zh-TW.json + auth.json; en.json + en/auth.json)
- [ ] T020 Create `apps/frontend/src/config/env.ts` with `zod` schema validating `VITE_API_BASE_URL` / `VITE_APP_BASE_URL` / `VITE_ADMIN_BASE_URL`
- [ ] T021 Create `apps/frontend/src/config/api.ts` exporting `apiBaseUrl` + `api(path)` helper
- [ ] T022 Create `apps/frontend/src/config/routes.ts` with routes `/login`, `/register`, `/app/dashboard`, `/admin/dashboard`
- [ ] T023 [P] Create `apps/frontend/src/config/limits.ts` with `LOCKOUT_THRESHOLD = 3`, `LOCKOUT_DURATION_MIN = 10`
- [ ] T024 [P] Create `apps/frontend/src/config/constants.ts` with `AUTH_EVENTS` enum (signed-in / signed-out / locked)
- [ ] T025 Create `apps/frontend/src/config/features.ts` with feature flag stubs (registrationEnabled = true, ...)
- [ ] T026 Create `apps/frontend/src/services/httpClient.ts` with `SaomeApiError` + `httpClient.{get,post,put,delete}`(handles 401 refresh-retry internally)
- [ ] T027 Update `apps/frontend/vite.config.ts` to add `server.proxy` for `/api` → `http://localhost:8787`
- [ ] T028 Update `apps/frontend/vitest.config.ts` if alias needed (verify 016-config specific-first order)
- [ ] T029 [P] Update `apps/frontend/tsconfig.app.json` `paths` for any new aliases
- [ ] T030 [P] Update `apps/frontend/tsconfig.node.json` `include` for any new `*.config.ts`
- [ ] T031 [P] Update `apps/frontend/.env` to set `VITE_API_BASE_URL=/api`,`VITE_APP_BASE_URL=`,`VITE_ADMIN_BASE_URL=/admin`
- [ ] T032 [P] Update `apps/frontend/.gitignore` to add `.env.local` if not present
- [ ] T033 [P] Add `react-hook-form` to `apps/frontend/package.json` dependencies

**Checkpoint**: BDD feature files exist (SAOME-6 fills content);shared package compiled;frontend config + i18n loading green.

---

## Phase 3: User Story 1 - Tenant Registration(P1) 🎯 MVP

**Goal**: 店家負責人能完成兩步驟註冊,自動登入導向 `/app/dashboard`。

**Independent Test**: 填寫合法 Step 1 + Step 2 資料送出後,瀏覽器跳到 `/app/dashboard`,且 `users` / `tenants` 表各有一筆對應記錄。

### Tests for User Story 1 ⚠️ Write FIRST

- [ ] T034 [P] [US1] BDD feature for tenant-registration in `.specify/memory/specs/spec/002-tenant-auth/features/tenant-registration.feature` (Given-When-Then for Step1/Step2/redirect/Email 衝突/taxId 衝突)
- [ ] T035 [P] [US1] Failing vitest unit for `taxIdSchema` accepts `"0"` and `8-digit numeric`, rejects others (RED)
- [ ] T036 [P] [US1] Failing vitest unit for `registerStep1Schema` happy path + each invalid field (RED)
- [ ] T037 [P] [US1] Failing vitest unit for `registerStep2Schema` validates password match + email format (RED)
- [ ] T038 [US1] Failing vitest unit for `useAuth.signUp` success → session populated, redirect (RED)

### Implementation for User Story 1

- [ ] T039 [US1] Implement `taxIdSchema` refiner in `packages/shared/schemas/auth.ts` (GREEN T035)
- [ ] T040 [US1] Implement `registerStep1Schema` + `registerStep2Schema` in `packages/shared/schemas/auth.ts` (GREEN T036, T037)
- [ ] T041 [P] [US1] Create `apps/frontend/src/components/ui/feedback/ErrorBanner.tsx` + `ErrorBanner.test.tsx` + `ErrorBanner.stories.tsx`
- [ ] T042 [P] [US1] Create `apps/frontend/src/components/ui/form/Field.tsx` + `FieldError.tsx` + tests + stories
- [ ] T043 [P] [US1] Create `apps/frontend/src/components/ui/form/PasswordField.tsx` + test + story
- [ ] T044 [P] [US1] Create `apps/frontend/src/components/ui/form/SubmitButton.tsx` + test + story
- [ ] T045 [P] [US1] Create `apps/frontend/src/components/ui/layout/AuthShell.tsx` + test + story
- [ ] T046 [P] [US1] Create `apps/frontend/src/components/ui/layout/Stepper.tsx` + test + story
- [ ] T047 [US1] Create `apps/frontend/src/services/authService.ts` with `register` using `httpClient.post`
- [ ] T048 [US1] Implement `useAuth.ts` in `apps/frontend/src/hooks/useAuth.ts` covering `signUp` (GREEN T038)
- [ ] T049 [P] [US1] Create `apps/frontend/src/components/business/auth/RegisterFormStep1StoreInfo/` with main `RegisterFormStep1StoreInfo.tsx` (≤100 行,只組合) + sub-components + `RegisterFormStep1StoreInfo.types.ts` + `RegisterFormStep1StoreInfo.hooks.ts` + `RegisterFormStep1StoreInfo.test.tsx` + `RegisterFormStep1StoreInfo.stories.tsx` (uses L1 Field/FieldError/SubmitButton)
- [ ] T050 [P] [US1] Create `apps/frontend/src/components/business/auth/RegisterFormStep2Account/` mirror structure (uses L1 PasswordField)
- [ ] T051 [US1] Create `apps/frontend/src/pages/auth/RegisterPage.tsx` (L3 — wires up AuthShell + Stepper + Step1 + Step2 + useAuth)
- [ ] T052 [US1] Add `/register` route to `apps/frontend/src/App.tsx`
- [ ] T053 [US1] Add `<AuthProvider>` to `apps/frontend/src/main.tsx`

**Checkpoint**: User Story 1 fully functional — fill registration page → auto-login → land on `/app/dashboard`.

---

## Phase 4: User Story 2 - Tenant Login(P1) 🎯 MVP

**Goal**: 已註冊店家負責人登入後依角色導向對應 dashboard。

**Independent Test**: 在 `/login` 輸入已註冊 email + 密碼,送出後 tenant 進 `/app/dashboard`、admin 進 `/admin/dashboard`,錯誤密碼顯示通用訊息。

### Tests for User Story 2 ⚠️ Write FIRST

- [ ] T054 [P] [US2] BDD feature for tenant-login in `.specify/memory/specs/spec/002-tenant-auth/features/tenant-login.feature` (happy path + wrong creds + role-based redirect + sign out)
- [ ] T055 [P] [US2] Failing vitest unit for `loginCredentialsSchema` valid email + min 8-char password, otherwise reject (RED)
- [ ] T056 [P] [US2] Failing vitest unit for `isAccountLocked(failuresInWindow, nowMs)` returns boolean (RED)
- [ ] T057 [US2] Failing vitest unit for `useAuth.signIn` dispatch + error path (RED)
- [ ] T058 [US2] Failing vitest unit for `useLoginLockout` reactive state + countdown (RED)

### Implementation for User Story 2

- [ ] T059 [US2] Implement `loginCredentialsSchema` (GREEN T055)
- [ ] T060 [US2] Implement `isAccountLocked` + `getLockedSecondsRemaining` in `packages/shared/logic/auth.ts` (GREEN T056)
- [ ] T061 [US2] Augment `useAuth.ts` with `signIn` + `signOut` (GREEN T057)
- [ ] T062 [P] [US2] Create `apps/frontend/src/hooks/useLoginLockout.ts` + `useLoginLockout.test.ts` (localStorage wrapping with timestamps) (GREEN T058)
- [ ] T063 [P] [US2] Create `apps/frontend/src/hooks/useFormSchema.ts` (zod + RHF integration) + `useFormSchema.test.ts`
- [ ] T064 [P] [US2] Create `apps/frontend/src/hooks/useAuthRedirect.ts` + `useAuthRedirect.test.ts`
- [ ] T065 [P] [US2] Create `apps/frontend/src/hooks/useCountdown.ts` + `useCountdown.test.ts`
- [ ] T066 [P] [US2] Create `apps/frontend/src/providers/AuthProvider.tsx` + `AuthProvider.test.tsx` (Context + Reducer)
- [ ] T067 [P] [US2] Strengthen `apps/frontend/src/providers/I18nProvider.tsx` for auth-aware labels
- [ ] T068 [P] [US2] Create `apps/frontend/src/components/ui/feedback/LoadingOverlay.tsx` + tests + stories
- [ ] T069 [P] [US2] Create `apps/frontend/src/components/ui/feedback/CountdownText.tsx` + tests + stories
- [ ] T070 [P] [US2] Create `apps/frontend/src/components/business/auth/LoginForm/` (data-model driven: LoginForm.tsx ≤100 行 + LoginFormHeader/Fields/Actions/Feedback sub-components + types + hooks + tests + stories) (uses L1 Field / PasswordField / SubmitButton / ErrorBanner / LoadingOverlay / CountdownText)
- [ ] T071 [US2] Augment `authService.ts` with `login`, `refresh`, `me` (uses httpClient)
- [ ] T072 [US2] Create `apps/frontend/src/pages/auth/LoginPage.tsx` (wraps LoginForm in AuthShell)
- [ ] T073 [US2] Add `/login` route to `apps/frontend/src/App.tsx`
- [ ] T074 [P] [US2] Create `apps/frontend/src/components/ui/feedback/AuthGuard.tsx` + tests + stories (redirect logic for protected routes)
- [ ] T075 [P] [US2] Create `apps/frontend/src/components/ui/feedback/ComingSoonCard.tsx` + tests + stories
- [ ] T076 [P] [US2] Create `apps/frontend/src/pages/dashboard/ComingSoonAppPage.tsx` (wraps ComingSoonCard + AuthGuard)
- [ ] T077 [P] [US2] Create `apps/frontend/src/pages/dashboard/ComingSoonAdminPage.tsx` (wraps ComingSoonCard + AuthGuard)
- [ ] T078 [US2] Add `/app/dashboard` + `/admin/dashboard` routes to `apps/frontend/src/App.tsx`
- [ ] T079 [US2] Update `apps/frontend/src/components/layout/Header.tsx` to swap login ↔ logout with `useAuth()`

**Checkpoint**: US1 + US2 fully functional — register, login, role-based redirect, sign out all work.

---

## Phase 5: User Story 3 - Bi-lingual UI(P2)

**Goal**: 即時切換 zh-TW ↔ en,所有 UI 字串(含錯誤訊息)同步切換。

**Independent Test**: 在 `/login` 切到 English,所有表單 label / placeholder / 按鈕文字 / 錯誤訊息都變英文;重新整理後保留。

### Tests for User Story 3 ⚠️ Write FIRST

- [ ] T080 [P] [US3] BDD feature for bilingual-auth in `.specify/memory/specs/spec/002-tenant-auth/features/bilingual-auth.feature` (zh-TW default;切換 en;錯誤訊息也要 en;reload 保留)
- [ ] T081 [P] [US3] Failing vitest unit for `I18nProvider` switching locale (RED)
- [ ] T082 [P] [US3] Failing vitest unit for `AuthLanguageSwitcher` triggers locale change (RED)

### Implementation for User Story 3

- [ ] T083 [US3] Augment `apps/frontend/src/providers/I18nProvider.tsx` with locale state + localStorage persistence (GREEN T081)
- [ ] T084 [P] [US3] Create `apps/frontend/src/components/business/auth/AuthLanguageSwitcher/` + test (GREEN T082)

**Checkpoint**: All pages immediately responsive to language toggle.

---

## Phase 6: User Story 4 - Account Lockout Protection(P2)

**Goal**: 連續 3 次登入失敗 → 鎖定 10 分鐘,期間拒絕所有嘗試(含前端繞過)。

**Independent Test**: 同 email 連續 3 次失敗,第 4 次 (錯密或對密)都被拒絕並顯示倒數計時;10 分鐘後解除。

### Tests for User Story 4 ⚠️ Write FIRST

- [ ] T085 [P] [US4] BDD feature for login-rate-limit in `.specify/memory/specs/spec/002-tenant-auth/features/login-rate-limit.feature`(3 次失敗 → 鎖 → 倒數 → 10 分鐘後解除;前端繞過也被拒)
- [ ] T086 [P] [US4] Failing vitest unit for `countRecentFailures` helper (RED)
- [ ] T087 [US4] Integration vitest for `LoginForm` submitting 3-times with retry yielding lockout UI (RED)

### Implementation for User Story 4

- [ ] T088 [US4] Add `countRecentFailures(attempts: LoginAttempt[], windowMs: number): number` to `packages/shared/logic/auth.ts` (GREEN T086)
- [ ] T089 [US4] Wire `useLoginLockout` to reactively block form when locked (GREEN T087)

**Checkpoint**: Lockout protection works at both UX layer and (per backend tasks below) DB-enforced layer.

---

## Phase 7: User Story 5 - Role-based Landing(P2)

**Goal**: 登入後依 role 自動導向正確 dashboard;cross-role 存取被拒。

**Independent Test**: Tenant login → `/app/dashboard`;manual `/admin/dashboard` → 拒絕(403/redirect)。

### Tests for User Story 5 ⚠️ Write FIRST

- [ ] T090 [P] [US5] BDD feature for role-based-redirect in `.specify/memory/specs/spec/002-tenant-auth/features/role-based-redirect.feature`
- [ ] T091 [P] [US5] Failing vitest unit for `getRoleHomePath(role)` returns `'/app/dashboard'` for tenant, `'/admin/dashboard'` for admin (RED)

### Implementation for User Story 5

- [ ] T092 [US5] Implement `getRoleHomePath` in `packages/shared/logic/auth.ts` (GREEN T091)
- [ ] T093 [US5] `useAuthRedirect` reads session + role and navigates to `getRoleHomePath(role)` on mount

**Checkpoint**: Role-based routing fully enforced;tenant cannot see admin pages.

---

## Phase 8: Polish & Cross-Cutting Concerns(after FRONTEND done — moved to next session)

> 將在**下一輪 session**(Phase B + C)執行,在此僅預留不實作。

- [ ] T094 [P] [US-Backend] Create `saome-backend/` repo scaffolding(via `saome-new-repo` skill) — package.json / tsconfig.json / wrangler.jsonc / AGENTS.md / README.md / .gitignore / docs/architecture.md
- [ ] T095 [P] [US-Backend] Backend src tree: `shared/{middleware,db,lib,types}` + `contracts/` + `modules/auth/{routes,middleware,db,schemas,tests}` + `index.ts` Hono app + httpClient/shared module annotations
- [ ] T096 [P] [US-Backend] SQL migrations `001_init_users_tenants.sql` + `002_init_login_attempts.sql` + `003_seed_admin.sql` apply via Supabase MCP
- [ ] T097 [P] [US-Backend] Backend TDD RED — failing tests for register/login/refresh/me/rateLimit + SaomeError categories
- [ ] T098 [US-Backend] Backend TDD GREEN — implement routes/db/JWT/password via verify-this for hash choice
- [ ] T099 [P] [US-Integration] Run both `wrangler dev` (8787) and `vite dev` (5173); verify CORS + Vite proxy + cookie flow
- [ ] T100 [P] [US-QA] Add `tests/smoke/auth-flow.spec.ts` Playwright E2E; `npm run test:smoke` green
- [ ] T101 [US-QA] `requesting-code-review`;fix Critical/Important
- [ ] T102 [US-QA] `verification-before-completion` — typecheck / lint / test / test:bdd / build / coverage ≥ 80% / smoke all green
- [ ] T103 [US-QA] `finishing-a-development-branch` — both repos commit + push + (if public) PR
- [ ] T104 [US-QA] `saome-self-improvement` — write feedback to `runs/improvements/feedback/20260728-002-tenant-auth.md` capturing 踩坑與決策

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS** all User Stories
- **Phase 3+ (User Stories)**: Each depends on Phase 2 + prior user story phase if integrated tests require
- **Phase 8 (Polish / Backend / QA)**: Scheduled for next session;may overlap once Phase 3+ are green at frontend layer

### User Story Dependencies

- **US1 (Registration)**: Can start after Foundational — independent of US2
- **US2 (Login)**: Can start after Foundational — built on US1 types/schemas, but independently testable(login only)
- **US3 (Bi-lingual)**: Slotted into US2 phase(MVP logistics) because language switcher belongs in LoginForm
- **US4 (Lockout)**: Slotted into US2 phase — `useLoginLockout` already on LoginForm concern
- **US5 (Role landing)**: Slotted into US2 phase — `useAuthRedirect` already on Login page concern

> 完整 MVP(本 session 範圍)= Phase 3 (US1) + Phase 4 (US2) + Phase 5 (US3) + Phase 6 (US4) + Phase 7 (US5)。

### Within Each Phase

- Tests MUST be written and FAIL before implementation(per `.specify/memory/constitution.md`)
- Schemas/Logic before L2 components
- L1 components before L2 components
- Hooks/services before pages
- Service after provider (provider consumes service)
- Commit after each task or logical group

### Parallel Opportunities

- All Setup tasks marked [P] run in parallel
- All Foundational [P] tasks run in parallel(within Phase 2)
- Tests for any user story marked [P] run in parallel
- L1 components within a user story marked [P] run in parallel
- Sub-components within an L2 data folder marked [P] run in parallel

---

## Parallel Example: User Story 1

```bash
# Tests (must fail first)
T034 BDD feature
T035 taxIdSchema failing unit
T036 registerStep1Schema failing unit
T037 registerStep2Schema failing unit

# Implementation goes:
T039 taxIdSchema green (after T035)
T040 registerStep1+2 green (after T036, T037)
Then [P] T041–T046 L1 components, T047 service, T048 hook
Then [P] T049–T050 L2 components
Then T051–T053 pages + App + Provider
```

---

## Implementation Strategy

### MVP This Session (Phase A scope)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: US1 Registration
4. Phase 4: US2 Login
5. Phase 5: US3 Bi-lingual
6. Phase 6: US4 Lockout
7. Phase 7: US5 Role landing
8. STOP and VALIDATE — frontend `npm test` + `npm run test:bdd` green

### Next Session (Phase B + C + D)

- Phase 8: Polish + backend + integration + smoke + review + verify + ship

### Incremental Delivery

- After Phase 7: frontend is functionally complete with mocks(frontend can be deployed in **mock-only mode** if backend is unavailable)
- After Phase 8: full stack

---

## Notes

- [P] tasks: different files, no dependencies
- [Story] label: US1–US5;Phase 8 marked [US-Backend] / [US-Integration] / [US-QA] for grouping
- Each user story independently completable and testable
- Verify each test fails before implementing
- Commit after each task or logical group
- Stop at each Checkpoint to validate story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence

---

## Task Count Summary

| Phase | Tasks | Per-User-Story Tasks |
|---|---|---|
| Phase 1 Setup | T001-T004 (4) | — |
| Phase 2 Foundational | T005-T033 (29) | — |
| Phase 3 US1 | T034-T053 (20) | 4 tests + 16 impl |
| Phase 4 US2 | T054-T079 (26) | 5 tests + 21 impl |
| Phase 5 US3 | T080-T084 (5) | 3 tests + 2 impl |
| Phase 6 US4 | T085-T089 (5) | 3 tests + 2 impl |
| Phase 7 US5 | T090-T093 (4) | 2 tests + 2 impl |
| Phase 8 Polish (next session) | T094-T104 (11) | — |
| **TOTAL** | **104 tasks** | |

> 本輪 session(Phase A)範圍 = T001–T093 = **93 tasks**。
> 下輪 session(Phase B + C + D)範圍 = T094–T104 = **11 tasks**(後端 + 整合 + QA)。

## MVP Scope (This Session = Phase A)

最低可交付定義(滿足 spec.md MVP「兩步驟註冊 + 登入 + 角色導向 + i18n + lockout」):

- **Phase 1+2**: T001–T033 = 33 tasks
- **Phase 3 (US1 Registration)**: T034–T053 = 20 tasks
- **Phase 4 (US2 Login)**: T054–T079 = 26 tasks(包含 US3 / US4 / US5 因為 hooks/components 都是這個 session 一起做)
- **Phase 5/6/7 平行附掛**: T080–T093 = 14 tasks

> Phase A 結束時可驗收:**前端完整 auth 流程,後端用真 DB 或 mock 都能搭**。
