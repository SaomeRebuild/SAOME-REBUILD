# SAOME Self-Improvement Index

> 索引每次 session 在 `runs/improvements/feedback/` 寫下的「教訓」。
> 新 session 開啟時第一件事：讀本 INDEX 了解最近發生過什麼。

## 索引

| 日期 | 主題 | 路徑 | 影響 / 後續 |
|------|------|------|------|
| 2026-08-16 | Vibe Coding 工作流優化：i18n 沒有元件化規則、三次 namespace drift 迴圈 | runs/improvements/feedback/20260816-vibe-coding-workflow-optimization.md | 新增 rule `025` (L2 checklist)、`023` (i18n 元件化原則)；新增 `scripts/verify-i18n-keys.mjs` |
| 2026-08-17 | CI npm cache drift：`cache: 'npm'` 未綁定 `package-lock.json`，workspace 新增 dep 後 cache restore 舊 lockfile | runs/improvements/feedback/20260817-ci-npm-cache-lockfile-drift.md | workflow 補 `cache-dependency-path`；rule `016` 需補第 8 surface |
| 2026-08-17 | CardBuilder Step 5 + Browser Language Detection | DEV/08-2026/0817-card-builder-step5-and-lang-detection.md | Step 5 客製化桌牌；`detectDeviceLanguage` 偵測瀏覽器語言 |
| 2026-08-16 | Vibe Coding 工作流優化：i18n 沒有元件化規則、三次 namespace drift 迴圈 | runs/improvements/feedback/20260816-vibe-coding-workflow-optimization.md | 新增 rule `025` (L2 checklist)、`023` (i18n 元件化原則)；新增 `scripts/verify-i18n-keys.mjs` |
| 2026-08-15 | Nested Routes Decision：`AppDashboardPage` + `<Outlet />` 架構確認 | runs/decisions/2026-08-15-nested-routes-dashboard.md | Dashboard 6 個子頁面的 routing 架構；影響 `AppDashboardPage`、`DashboardShell` wrapper 移除 |
| 2026-08-15 | PassTier Schema Drift：`basic/premium/enterprise` → `green/gold/platinum` 與 DB 對齊 | DEV/08-2026/0815-pass-tier-schema-drift.md | `schemas/pass.ts`、`types/pass.ts`、`logic/pass.ts`、i18n 同步；`passTierSchema` 從未被 runtime 引用所以 typecheck 一直過 |
| 2026-08-12 | i18n namespace split：`translation` → 9 feature namespaces | runs/improvements/feedback/20260812-i18n-namespace-split-dev-log.md | 38 個測試失敗待修；`.json` → `.ts` 為不必要複雜化；根因：PowerShell UTF-8 腐化 + 錯誤解讀 Node.js 24 ESM JSON import 限制 |
| 2026-08-12 | i18n namespace split feedback（`.json` → `.ts` 根因分析）| runs/improvements/feedback/20260812-i18n-namespace-split-feedback.md | 技術債：P1（38 tests）、P2（locale 格式）、P2（PowerShell encoding）；下個 agent 提示詞：`runs/decisions/2026-08-12-i18n-test-fix-prompt.md` |
| 2026-08-12 | Dashboard renewalReminder i18n + schema drift + TS6198 三連環 | DEV/08-2026/0812-renewal-reminder-i18n-schema-chain.md | `passNotification` namespace load fail；`authSessionSchema.pass` 缺 3 欄位 strip；`TenantToolbar` TS6198 CI block |
| 2026-08-08 | Bug-7 TrialBanner：useAuth.refresh() 漏寫 pass + plan filter 商業邏輯錯誤 | runs/improvements/feedback/20260808-bug7-trial-banner-pass-state.md | `useAuth.refresh()` 加 `pass`；`visible` 接受全部 plan（commits `c76d992` + `a39a379`）；新增三層排除法：CI → 本地 → DB |
| 2026-08-08 | Bug-7 TrialBanner i18n namespace + layout overlay | DEV/08-2026/0808-trial-banner-i18n-layout.md | 建 `dashboard.{zh-TW,en}.json` namespace；`AppDashboardPage` 加 `pt-16`（commits `3bdb313` + `e851e6a`）|
| 2026-08-07 | Bug-7 refresh route 沒回 user/tenant（deploy gap）| runs/improvements/feedback/20260807-bug7-refresh-deploy-gap.md | `routes/refresh.ts` 改 `c.json(result)`；加 user/tenant assertion；commit `52b23aa` |
| 2026-07-31 | Register 表單 autofill + schema drift 三連環 | runs/improvements/feedback/20260731-register-autofill-schema-drift.md | 新增 rule `018` (form autofill + multi-step state) + `019` (schema contract drift)；新增 skill `saome-form-integrity`；commit + push（規範層） |
| 2026-07-27 | spec-kit-demo merge 誤刪 12 rules | runs/improvements/feedback/20260727-rules-overwritten-by-speckit-merge.md | 規範層修復已 push（commit `652e0a2` + `704af2a`） |
| 2026-07-27 | MemberBadge verification 漏跑 | runs/improvements/feedback/20260727-member-badge-verification-missed.md | 補強 `.cursor/rules/006-verification.mdc` commit message 驗證輸出欄位 |
| 2026-07-27 | SDD / BDD / TDD 三層流程試跑 | runs/improvements/feedback/20260727-sdd-bdd-tdd-flow-test.md | 觀察用，無規範變更 |
| 2026-07-27 | Cloudflare Pages 部署 + lockfile 跨平台 binding | runs/improvements/feedback/20260727-cloudflare-pages-deploy.md | 補強 rule `015` + `016` + deploy skill；commit `80a97b7` 修 lockfile；新增 `apps/frontend/scripts/audit-lockfile-bindings.cjs` |
| 2026-07-27 | Dependabot 5 漏洞 deferred | runs/improvements/feedback/20260727-dependabot-deferred.md | 等 SPEC-002 `dependabot-triage` 開工復工 |

## Pending Action Items

| 日期 | 動作 | 狀態 |
|------|------|------|
| 2026-08-16 | `023-shared-package.mdc` 加 i18n 元件化原則 + namespace checklist | ✅ done |
| 2026-08-16 | 加 `scripts/verify-i18n-keys.mjs` i18n smoke test | ✅ done |
| 2026-08-16 | 普查 `cardBuilder`、`cardEditor` namespace（確認無需拆分） | ✅ done |
| 2026-08-16 | 加 `025-vibe-coding-l2-checklist.mdc` rule | ✅ done |
| 2026-08-16 | 普查 `auth`、`landing`、`legal`、`passNotification`、`theme` 的 cross-locale drift | ⏳ pending |
| 2026-08-17 | `016-config-and-tsconfig-discipline.mdc` 補第 8 surface：CI cache `cache-dependency-path` 綁定 `package-lock.json` | ⏳ pending |
| 2026-08-17 | `025-vibe-coding-l2-checklist.mdc` 或新建 `026-ci-workflow-checklist.mdc`：加 CI workflow 修改 checklist（新增 dep 前確認 cache key） | ⏳ pending |

## 使用方式

1. **新 session 開啟** — 第一件事讀本 INDEX 了解最近教訓。
2. **找特定主題** — 依日期與主題欄定位。
3. **寫新 feedback** — `runs/improvements/feedback/YYYYMMDD-<topic>.md`，至少含「背景/根因/修法/學習」四段。
4. **新增 feedback 後** — 回頭在本 INDEX 加一行（依日期倒序排）。

## 觸發條件

引用 `.cursor/skills/saome-self-improvement/SKILL.md` trigger #5：同日多於 1 個 feedback 時必須觸發更新此 INDEX。
