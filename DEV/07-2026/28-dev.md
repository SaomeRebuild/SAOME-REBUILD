# 2026-07-28 Session Notes

> 給下次開新 cursor session 的自己讀的第一份文件。
> 已 commit 到 `DEV/07-2026/28-dev.md`（操作層 — 開發紀錄備份）。

---

## 這次 session 做了什麼

完整把 admin login → dashboard 的 pipeline 修通。六輪 bug，五個 commit：

| Bug | 修在哪 | Commit |
|-----|--------|--------|
| Bug-4b | `password.ts` scrypt N=16384 + maxmem + try/catch | `46dbd7a` |
| Bug-4c | `env.ts` 分 dev/prod default + `.env.production` | `d50da87` |
| Bug-4d | `cors.ts` 加 `ALLOWED_ORIGIN_PATTERNS`（host glob） | `bab5c97` |
| Bug-5  | `LoginForm` 用 `useAuthRedirect` + LoginPage back-button guard | `e0f9f44` |
| Bug-6  | `ComingSoonCard` 改用 design tokens + forbidden-class scan 測試 | `0f349ba` |

加上兩個規範層 commit：
- `f009f17`：完整 feedback doc
- `90bd3cd`：AGENTS.md 加 Auth/CORS 鐵律 + `.cursor/rules/017-production-bundle-guard.mdc`

## 最後狀態

- Backend: `saome-backend.josh1989213.workers.dev`（scriptVersion `71bc0ad4...`）
- Frontend: `saome-frontend.josh1989213.workers.dev`（Cloudflare Pages auto-deploy）
- Admin login: `admin@saome.org` / `Qwww123123!` → redirect to `/admin/dashboard` ✅
- 測試: backend 70/70、frontend 168/168、typecheck 0、lint 0、build 0

## 下次開 session 第一件要做的事

1. **讀 `.cursor/rules/017-production-bundle-guard.mdc`** — 這條是新的，bug chain 的根因防護。
2. **讀 `.cursor/rules/006-verification.mdc`** — 完工驗證 SOP。
3. **看 `runs/improvements/feedback/20260728-admin-login-scrypt-mismatch.md`** — 這次教訓 + open follow-ups 清單。

## Open follow-ups（沒做但應該做）

照優先度排：

### 高（下次 session 該做）

1. **Bundle-level guard 寫成實際 post-build hook**：
   範本在 `.cursor/rules/017-production-bundle-guard.mdc` 底下。建立 `apps/frontend/scripts/audit-bundle-urls.cjs`，串進 `package.json build` script。

2. **Forbidden-class scan 推到所有 L1**：
   `apps/frontend/src/components/ui/` 底下其他元件（`Button` / `Field` / `PasswordField` / `AuthShell` / `Stepper` / `ErrorBanner` / `CountdownText`）可能也有 hardcoded neutral scale。寫成 vitest 共用 helper，重複使用 `ComingSoonCard.test.tsx` 的 pattern。

3. **抽 `<AuthenticatedRedirect>` component**：
   LoginPage 跟 RegisterPage 現在各寫一份 `isAuthenticated → Navigate` 邏輯。重構成 sibling-of-AuthGuard 元件，往後所有 public route（forgot-password、terms、public-pricing）都會用到。

### 中（batch 到下次 work session）

4. **Backend deploy automation**：
   後端要手動 `npx wrangler deploy`，不像 Pages 自動。考慮加 `.github/workflows/backend-deploy.yml`，on push 到 main 自動 deploy。

5. **CI integration smoke test**：
   這次 5 個 commit 都沒有 integration smoke test。Cloudflare Pages deploy 完跑一次 `curl https://saome-frontend.<domain>/` 確認 200，再驗 `/api/auth/login` 流程。

### 低（nice-to-have）

6. **Local Postgres for vitest**：
   現在用 dummy URL `postgres://postgres:postgres@127.0.0.1:5432/postgres` 騙 wrangler。如果有真實本地 Postgres，auth 整合測試可以從 mock 換成真實 query。

7. **`AuthGuard` reverse-direction 命名**：
   `<AuthenticatedRedirect>` vs `<RequireGuest>` — 後者比較明確（意思是「這個 route 只給 guest 看」）。下次重構再決定。

## 我自己的反省（這次什麼沒做對）

1. **沒主動 grep bundle**：Bug-4c 之前應該先 `grep -rn localhost dist/assets/`，會立刻發現 production bundle 內含 localhost。
2. **沒主動檢查 backend ALLOWED_ORIGINS**：Bug-4d 之前應該先 curl OPTIONS 帶 production origin，會立刻發現缺少 `Access-Control-Allow-Origin`。
3. **沒在 Commit 後立刻 walk through next screen**：Bug-5 跟 Bug-6 都是 commit 完後「API 通了、視覺沒看」的情況。如果每次 commit 後用隱身模式打開 deployment 看實際結果，Bug-5 跟 Bug-6 可以更早抓到。
4. **測試太少**：原 LoginForm 沒 test，導致 Bug-5（缺 navigate）一路沒被抓。現在 LoginForm + LoginPage 都有 test，下次 regression 會擋。

## 如果下次有新人接手 SAOME-REBUILD

讓他讀的優先順序：

1. `AGENTS.md`（這是入口）
2. `.specify/memory/constitution.md`（這是 SAOME 自己的憲法）
3. `.cursor/rules/006-verification.mdc`（這是完工 SOP）
4. `.cursor/rules/017-production-bundle-guard.mdc`（這是新加的關鍵鐵律）
5. `runs/improvements/feedback/20260728-admin-login-scrypt-mismatch.md`（這是「為什麼這些 rule 長這樣」的歷史）