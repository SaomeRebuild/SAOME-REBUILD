# 2026-08-08 — 7 個 Bug 是怎麼產生的：完整 trace

## Metadata

- **日期**：2026-08-08
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：
  - 規範 / 觀察：本檔（`DEV/08-2026/0808-bug-7-trace.md`）
  - Bug-7 refresh fix：`52b23aa` (origin/main, sync ✅)
  - Bug-7 UX fix：`d6be7aa` (origin/main, sync ✅)
- **規則 / skill 觸發**：`saome-self-improvement`、`saome-dev-logging`、`AGENTS.md § Auth flow 鐵律`、`rules/006-verification`、`rules/017-production-bundle-guard`

## 症狀

> 這篇是**事後追溯**的工程日誌。2026-07-27 ~ 2026-08-08 之間，
> auth → dashboard → session-recovery 這條 chain 上**連環引爆 7 個 bug**。
> 每一個都「修完看起來好了」，但下個又冒出來。
> 寫這篇是為了把這 7 個 bug 的真實 root cause 沉澱下來，
> 避免未來在新 chain 上重複同一條失敗路徑。

- 環境：production + dev (`http://localhost:5173` + `https://saome-frontend.josh1989213.workers.dev`)
- 觸發條件：登入流程 / refresh cookie recovery / 跨頁面 navigate
- 觀察到的錯誤（**user-visible，跨 7 個 bug 累積**）：
  - Round 0/1/2/3 (Bug-4 umbrella + 4b)：POST /api/auth/login 500 / 401 / 401 / 401
  - Bug-4c：登入「失敗」，但 request 從未到 backend（瀏覽器 silent drop mixed content）
  - Bug-4d：OPTIONS 回 204 但 response 無 `Access-Control-Allow-Origin`，POST 沒送出
  - Bug-5：POST 200 + Set-Cookie 但 URL 沒變（user 還停在 `/login`）
  - Bug-6：登入後看到 dashboard 但 text 不可讀（light palette 跟 dark background 對比）
  - Bug-7a：跨 site request cookie 不附帶；HTTP dev cookie 被 reject
  - Bug-7b：refresh 200 但 session 沒保住 → 下一個 request 401
  - Bug-7 follow-up：session 保住後，user 訪問任何公開頁都被踢回 dashboard

## 探針 / 重現

每一個 bug 都有對應的 probe 在 `tests/probe/`：

| Bug | Probe | 主要觀察 |
|---|---|---|
| Bug-4b | `tests/probe/curl-login-then-refresh.mjs`（執行後 401 因 admin seed hash mismatch）| Worker log: `Scrypt failed` |
| Bug-4c | `tests/probe/prod-verify.mjs` | 首次 `set-cookie: (MISSING)` + cookie 0 個 → mixed content |
| Bug-4d | `tests/probe/raw-headers.mjs` | OPTIONS 204 無 ACAO header |
| Bug-5 | Playwright `LoginForm.test.tsx` (login redirect 測試) | URL 不變 |
| Bug-6 | `ComingSoonCard.test.tsx` (forbidden-class scan) | `bg-white` `text-neutral-900` 命中 |
| Bug-7a | `tests/probe/cookie-debug.mjs` | cookie flag 與 origin mismatch |
| Bug-7b | `tests/probe/curl-refresh.mjs` (login 後再 refresh) | refresh body 只有 `{accessToken, expiresIn, refreshToken}`，**沒有 user/tenant** |
| Bug-7 follow-up | `tests/probe/ux-email-link.mjs` | 訪問 `/` 後被 redirect 到 `/admin/dashboard`，marketing page 看不到 |

每一條 probe 都跟對應的 fix commit 同時 push 進 `tests/probe/`。

## 7 個 Bug 的 root cause（事後追溯）

### ⚠️ 重要校正

`e0f9f44` (Bug-5 fix) 的 commit message 提到「Bug-1 through Bug-4d」，
那是**模糊敘述** — Bug-1/2/3 沒有獨立編號記錄。我把它們視為
「admin-login recovery chain 之前累積的 infra-level bugs」，
不為它們編獨立 root cause 章節（避免 speculation）。

### 可獨立追溯的 7 個 bug

| # | Round | 最早引入 commit | Root cause | 規則違反 / 缺失 | Fix commit |
|---|---|---|---|---|---|
| **Bug-4 umbrella** | 同時 3 defects | `385fc5d` `feat(auth): implement tenant auth backend + shared types/schemas/logic/i18n` | CORS 只列 dev origin + cookie `Domain=.saome.org` 寫死 + `JWT_SECRET` 有 `'dev-insecure-secret'` fallback | 當時沒有「production secrets 走 Wrangler secrets」鐵律；沒有瀏覽器層級 cookie integration test | `85f03a6`（部分修，後分裂成 4b/4c/4d）|
| **Bug-4b** | Round 1 | 同上 `385fc5d` | `password.ts` 用 `N=131072`，seed hash 用 Node default `N=16384`。OpenSSL `maxmem=32 MiB` 也 reject `N=131072` | `AGENTS.md` 說用 Argon2id/PBKDF2，實作選 scrypt 又沒同步；沒有 seed-hash compatibility test | `46dbd7a` |
| **Bug-4c** | Round 2 | `39557ae` `feat(frontend): implement L1+L2 components, hooks, services, routes for tenant auth` | `apps/frontend/src/config/env.ts` 的 `apiBaseUrl` default 寫死 `http://localhost:8787`，不論 build target | `rules/017-production-bundle-guard.mdc` 當時不存在；`rules/006-verification` 沒有 bundle grep 步驟 | `d50da87` |
| **Bug-4d** | Round 3 | `85f03a6`（Bug-4 fix 暴露了 production origin mismatch）| CORS 是 static exact-origin list，加 Pages/Workers origins 但**沒包含實際的 Workers preview subdomain `saome-frontend.josh1989213.workers.dev`** | 沒有 preview-origin testing 規則；CORS 設計假設 origin 可預先枚舉 | `bab5c97` |
| **Bug-5** | Round 4 | `39557ae` | `LoginForm.onSubmit` 沒 navigate；`/login` 跟 `/register` 沒有 reverse-direction guard（已登入訪問會 re-render form） | 「state update 必須 paired with navigation」鐵律當時不存在；`AuthGuard` 只有單向 | `e0f9f44` |
| **Bug-6** | Round 5 | `39557ae` | `ComingSoonCard` 跟 admin sign-out button 從 shadcn 範本 copy，帶 `bg-white` `text-neutral-900` 等硬編 light palette，跟 dark design token 不合 | `rules/010-uiux-pro-max` 禁 hardcoded color；`rules/005-smoke-test` 要求看實際 next screen | `0f349ba` |
| **Bug-7** | Refresh recovery chain | `385fc5d`（cookie 硬編）+ `39557ae`（frontend 兩步 refresh→`/me`）| 同時含 3 個子 bug（見下表） | — | 多個 commit |

### Bug-7 內部子 bug 拆解

| 子 bug | Root cause | Fix |
|---|---|---|
| **Bug-7a** cookie flags 不分環境 | login/refresh routes 寫死 `Secure; SameSite=Lax; Domain=.saome.org`。跟 HTTP dev / cross-site request / workers.dev origin 都不合 | 動態 derive `refreshCookieDomain/Secure/SameSite(origin)`，dev 用 Vite proxy same-origin（在 working tree 內，`cookieDomain.ts` 等）|
| **Bug-7b** refresh response 沒回 user/tenant | `refreshService` 已 hydrate，但 `refreshRoute` 只序列化 3 個欄位；frontend 想 call `/me` 但 `/me` 需要 `Authorization` header，導致 chicken-and-egg 401 | `c.json(result)` ✅ `52b23aa` |
| **Bug-7 follow-up** HomePage 把已登入用戶踢回 dashboard | reverse-direction AuthGuard 套太廣，任何 `/` 訪問都 redirect，UX 不佳 | 移除 redirect，Header email 變 dashboard link ✅ `d6be7aa` |

## 5 個共同 root cause patterns

把 7 個 bug 拆開看，浮現 5 個重複 pattern：

### Pattern 1：「deploy 後才算完工」鐵律缺失

Bug-4b / 4c / 4d 全部都是 **local 跑 OK，production 壞**。
**commit 時沒有 production smoke test**。後來的 `rules/005-smoke-test.mdc` +
`rules/017-production-bundle-guard.mdc` 就是針對這個寫的。

### Pattern 2：「200 OK ≠ 完工」鐵律缺失

Bug-5 跟 Bug-7b 都屬於這個 — backend 回 200 + cookie，但前端 user 沒看到
dashboard / session 沒保住。**只看 server-side response 不算通**。
AGENTS.md 後來的「Auth flow 鐵律 #1」就是為這個寫的：

> 成功的 200 response 加上正確的 `Set-Cookie` 不代表登入完成。
> 必須手動驗證 user 看到的下一個畫面（next screen）有可讀內容、
> token 正確帶到下一個 request、可關閉 tab 後重開仍持 session。

Feedback `20260728-admin-login-scrypt-mismatch.md` 最後那句是這個 pattern
的 fix 關鍵：

> **Key insight**: a server-side 200 with a `Set-Cookie` is **not** a working
> login. The user has to see a meaningful next screen with usable contrast
> before you can call the chain closed.

### Pattern 3：沒有「後設環境」的 config 設計

Bug-4b（scrypt params）/ Bug-4c（apiBaseUrl default）/ Bug-7a（cookie flags）
都是**程式碼不分 build target / 環境**。後來的
`rules/000-dynamic-config.mdc` + `rules/017-production-bundle-guard.mdc`
是補強。

### Pattern 4：API contract 沒 conformance test

Bug-7b 是經典範例 — frontend 期待 `{user, tenant, accessToken}`，
backend 回 `{accessToken, expiresIn, refreshToken}`，**沒有自動化 test
抓 schema drift**。後來的 `rules/019-schema-contract-drift.mdc` 是補強。

### Pattern 5：Auth 流程「全鏈條」思維缺失

Bug-4 / 4b / 4c / 4d / 5 / 6 是同一條 chain 的 6 個破口。
**每個單獨看都修完了，但整體沒有 closed-loop test**。
這條 pattern 是這份日誌最想 push 的 future guard：

> 寫任何「user 從 click 到 next screen」的 chain 之前，先把整條 path 畫下來。
> 然後寫 1 個 end-to-end probe 從最前面 trigger 跑到最後面 assertion。
> 修任何一個 round 都要重跑這個 probe。

## 修法（這次 session 補完的最後 2 個）

### Bug-7b: `52b23aa` `fix(auth): refresh route returns full session`

- 改 `apps/backend/src/modules/auth/routes/refresh.ts`：
  `c.json({accessToken, expiresIn, refreshToken})` → `c.json(result)`
- 加 Vitest assertion：`refresh.test.ts` 新增「response includes user + tenant」
- deployed：saome-backend version `8ceb5e48-1172-4f12-9a2d-38999d186ce7`
- E2E probe `tests/probe/curl-login-then-refresh.mjs`：
  refresh body 現含 `user.email`, `user.role`

### Bug-7 follow-up: `d6be7aa` `fix(homepage,ux): keep authed users on marketing`

- `apps/frontend/src/pages/HomePage.tsx`：移除 reverse-direction AuthGuard
- `apps/frontend/src/components/layout/Header.tsx`：desktop + mobile email
  `<span>` → `<Link to=ROLE_HOME_PATH[role]>`，aria-label = `nav.openDashboard`
- `apps/frontend/src/i18n/locales/{zh-TW,en}.json`：新增 `nav.openDashboard`
- `apps/frontend/src/hooks/useAuth.tsx`：補 `session.expiresIn ?? 28800` fallback
  以符合 `AuthSessionWithTenant.expiresIn?: number` optional 簽名
- tests：HomePage 翻 2 條 redirect→keep-on-home；Header 新 1 條 email-as-link
- deployed：saome-frontend version `36781a52-5e37-43a0-8e88-ca8c71241556`
- E2E probe `tests/probe/prod-smoke-ux.mjs`：login → /admin/dashboard，Logo → /,
  email link → /admin/dashboard ✅

## 衍生

### 影響的其他檔案

| 檔案 | 變更 |
|---|---|
| `apps/backend/src/modules/auth/tests/refresh.test.ts` | 新增 user/tenant assertion |
| `apps/frontend/src/pages/HomePage.test.tsx` | 翻 2 條 test 邏輯 |
| `apps/frontend/src/components/layout/Header.test.tsx` | 新 1 條 + 1 條 import |
| `apps/frontend/src/hooks/useAuth.tsx` | 3 處加 `?? 28800` fallback |
| `apps/frontend/src/hooks/useAuth.test.tsx` | 新檔（含 Bug-7 follow-up mock 修正）|
| `apps/frontend/src/pages/auth/LoginPage.test.tsx` | mock refresh 回傳 full session |
| `apps/frontend/src/services/authService.ts` | doc-comment updated |

### 連動的 feedback（這次補建）

- `runs/improvements/feedback/20260807-bug7-refresh-deploy-gap.md`
  → 對應 `52b23aa`
- `runs/improvements/feedback/20260808-homepage-no-redirect.md`
  → 對應 `d6be7aa`

### 還沒處理

- `apps/backend/src/modules/auth/routes/login.ts` /
  `register.ts` / `services/refreshService.ts` /
  `shared/lib/cookieDomain.ts` 全部是 modified 但**這次 session 沒動**
  — 它們是 Bug-7a 的 working-tree changes。留到下次 commit。
- `apps/frontend/src/config/env.ts` /
  `vite.config.ts` 還有 Bug-4c 後續的 dev/prod default 分流邏輯
  — 同上，modified 但未 commit。
- Dependabot 14 個 vulnerabilities（`git push` 觸發的提示），
  之後跑 `npm audit` + upgrade。

## 自問

### 下次怎麼不犯？

1. **任何「user-visible chain」必跑 E2E probe** — 寫 chain 的**第一個 commit**
   就要附 probe。後續 round 都重跑同一個 probe。
2. **server-side 200 不算 closed-loop** — 我們已經把這條放進
   AGENTS.md §Auth flow 鐵律 #1。要 push 進所有 commit message 模板。
3. **config default 必分 build target** — `rules/017` + `rules/000-dynamic-config`
   已經有鐵律，但**沒有自動化 test** enforce。下次應該加一個
   `apps/frontend/scripts/audit-config-defaults.cjs` 類似 bundle guard。
4. **API contract 必加 conformance test** — `rules/019` 有鐵律，
   但目前只覆蓋 auth module。register, tenant, member, pass modules
   都還沒建。
5. **寫新 chain 之前先畫 path** — 把「user 從 click 到 next screen」
   畫下來再寫 code。Pattern 5 是這次最痛的。

### 哪條 rule 該補？

| 缺 | 建議 rule |
|---|---|
| E2E probe 必跑（Pattern 1）| 強化 `rules/005-smoke-test` 或新 rule「020-e2e-chain-required」 |
| Config default 自動化 grep（Pattern 3）| 強化 `rules/017-production-bundle-guard` 加 config-default audit script |
| API contract conformance 全模組（Pattern 4）| 強化 `rules/019-schema-contract-drift` 要求每個新 module 加 conformance test |
| Chain-think 流程（Pattern 5）| 強化 `rules/000-modular-design` 或新 rule「020-write-chain-first」 |

### 哪個 test 該加？

1. **`apps/backend/src/modules/auth/tests/session-recovery.e2e.test.ts`** —
   從 login → close tab → reopen → access protected endpoint，
   整條 chain 不開瀏覽器也能跑（用 vitest + happy-dom + fetch cookie jar）。
2. **`apps/frontend/scripts/audit-config-defaults.cjs`** —
   build 後 grep `localhost:8787` / `127.0.0.1` 等 hardcoded URL，
   比現有 bundle guard 更精準。
3. **每個 module 一個 `schema-conformance.test.ts`** — 強制 backend request.ts
   跟 shared zod schema field set 一致。

---

> 撰寫者：Josh (via Cursor) ｜ 時間：2026-08-08 04:48 UTC+8