# SAOME Self-Improvement Index

> 索引每次 session 在 `runs/improvements/feedback/` 寫下的「教訓」。
> 新 session 開啟時第一件事：讀本 INDEX 了解最近發生過什麼。

## 索引

| 日期 | 主題 | 路徑 | 影響 / 後續 |
|------|------|------|------|
| 2026-09-01 | **Dev Server 啟動流程自動化**:6-phase orchestrator (`scripts/dev-restart.ps1`),surgical kill via WMI `ParentProcessId` parent walk(避開 IDE helper),PID tracking `.dev-restart.pids.tmp`,結構化 exit code 0/1/2/3/64/65,PowerShell UTF-8 top-of-file 紀律(避免 zh-TW CP950 console 切中文壞掉)。Tmp cleanup B-policy:PID-dead + mtime > 24h only(保留 wrangler 剛掛掉的 debug window) | runs/improvements/feedback/20260901-dev-server-cleanup-pain.md | SKILL `saome-dev-servers` rewrite 為 6-phase + PowerShell UTF-8 callout;5 flag (`-Force` / `-SkipCleanup` / `-SkipTmp` / `-HealthOnly` / `-Status`);`.cmd` shim 繞 PowerShell Execution Policy;以後每次 restart = 1 指令 + 結構化 exit |
| 2026-08-31 | **CardBuilder ICON 上傳 500 — workerd `JSON.stringify` + `::jsonb` pitfall**：workerd runtime（wrangler dev / Cloudflare Workers）的 `JSON.stringify` 對 non-ASCII 字串破壞成 `\uFFFD\uFFFD`；`${JSON.stringify(...)}::jsonb` cast 在 DB trigger 端 raise "got array" → 500。修法用 `sql.json(input.settings)` 取代。Node.js / Vite dev `JSON.stringify` 正常，所以 vitest + typecheck 都沒抓到；只有「前端 → wrangler dev → Supabase」完整鏈才重現 | runs/improvements/feedback/20260831-workerd-json-stringify-jsonb-pitfall.md | 觸發 Rule 027 新章節「workerd JSON.stringify pitfall」、Rule 028 § 2 cross-ref、SKILL image-upload Step 7 改 `sql.json()` 範例；insertTemplate 一直用 `sql.json()`，是 updateTemplate 從 Bug A 開始從未對齊 INSERT 的累積 bug |
| 2026-08-31 | **CardBuilder Icon Upload Settings Chain master DEV LOG**：4 階段修復鏈 single source of truth narrative（Bug A REPLACE → Bug #8 防禦 unwrap → Bug #8.5 巢狀 unwrap → workerd JSON.stringify 500），交叉引用 4 份既有 doc，給未來追整條鏈的人 single entry point | DEV/08-2026/0831-cardbuilder-icon-upload-settings-chain.md | 不必交叉閱讀 4 份既有 DEV LOG/feedback；Rule/SKILL Sedimentation 段落列出這次新增的 3 處規範變更 |
| 2026-08-31 | **CardBuilder data-loss + icon-preview fix**：Phase 1 SQL REPLACE → MERGE（settings `=` → `settings \|\|`）+ Phase 3 defensive（Preview onError fallback,loadSettings version bump,R2 PUT response check）+ 3 個新 test file（merge/store/preview,12 cases pass）+ i18n `loadError` key（zh-TW + en × 2 namespace）。`updateTemplate` 從此 merge settings 避免 Step 3 logo/icon upload 洗掉 Step 2 欄位;icon 預覽破圖恢復靠 R2 PUT response check + onLoad bump version | DEV/08-2026/0831-cardbuilder-data-loss-icon-preview-fix.md | 92/92 backend test pass + 46/46 frontend test pass;SQL MERGE 是 Rule 019 § 4.1 鐵律的延伸;Phase 2 evidence（wrangler verify + icon-preview test）排除 R2 沒 object / URL 構造錯;PushNotificationMockup.test.tsx 5 errors 屬 IconUploader plan 殘留(獨立追) |
| 2026-08-31 | Icon preview Phase 2 investigation (wrangler + icon-preview test)：R2 確實有 icon object (Candidate #1 ELIMINATED),URL 構造正確 (Candidate #5 ELIMINATED),後端 field map 正確,store update 路徑正確。剩 root cause 為 runtime/browser-side (CORS / cache / token),需 DevTools 截圖才能收斂 | runs/improvements/feedback/20260830-icon-preview-investigation.md | 用戶已將本 fix 往前推到 Phase 3;若 preview 仍破圖需要 DevTools Network tab 截圖 |
| 2026-08-30 | **LogoUploader P0+P1 Refactor + Rule Sedimentation（master DEV LOG）**：從症狀層（圖預覽不更新）→ 結構層（時間戳記 cache busting + 7 個 sub-component 拆分 + useImageCrop 平台分流 + 純邏輯搬到 shared/）→ 規範層（4 個 rule + 1 個 SKILL 補完新規範）；27 個 production code 檔案變動 + 450 行 rule 新增；零 pure code fix 之外的 production code 變動 | DEV/08-2026/0830-logouploader-p0p1-refactor-rule-sedimentation.md | Rule 028 § 13 Image Cache Busting + § 14 Image Auth Strategy（NEW）；Rule 024 Hook Split Pattern（NEW）；Rule 000 A.3 Hook Extraction Strategy（NEW）；Rule 023 Shared Validation i18n Key（NEW）；LogoUploader.tsx 887 → 394 行（-56%）；純邏輯搬到 packages/shared/logic/imageCrop.ts；useImageCrop 拆三檔 `.ts` / `.web.ts` / `.native.ts` |
| 2026-08-30 | **LogoUploader Mobile Fix Cycle（master DEV LOG）**：4 輪 mobile UX 修正循環完整時間軸（stale closure → chain min-w-0 → iPhone 12 padding → drag stutter → landscape frame exceeds stage）；前 4 輪症狀層 try-and-error，第 5 輪才改變結構假設本身；cross-cutting pattern：≥3 輪症狀 fix 還沒清 = 結構假設錯 | DEV/08-2026/0830-logo-uploader-mobile-fix-cycle.md + runs/improvements/feedback/20260830-logo-uploader-portrait-stale-closure.md + 20260830-logo-uploader-chain-min-w-zero.md + 20260830-logo-uploader-iphone12promax-double-padding.md + 20260830-logo-uploader-mobile-drag-stutter.md + 20260830-logo-uploader-landscape-frame-exceeds-container.md + 20260830-logo-uploader-landscape-squash.md | 12 commits `db5711e` → `8d969e2`；Rule 028 § 12 Stage Height Invariant；SKILL § Stage Height Invariant；LogoUploader.test.tsx 從 9 → 15 個 test；BackgroundUploader / IconUploader 實作時必須滿足 § 11 + § 12 兩條 invariant |
| 2026-08-30 | LogoUploader Landscape White Frame Exceeds Container：stage 是 aspect-matched 但 outer 額外 padding 給 frame，landscape 時 frame 居中於 outer 而超出 stage；前四次 fix（stale closure / drag stutter / chain min-w-0 / iPhone 12 Pro Max double padding）都是症狀層修補，這次（round 4）才改變結構假設本身 | runs/improvements/feedback/20260830-logo-uploader-landscape-frame-exceeds-container.md | 新增 rule `028` § 12 Stage Height Invariant：`baseContainerH = max(aspectMatchedH, maskH + 2 × FRAME_PADDING)`，outer = stage；SKILL `saome-image-upload` § Stage Height Invariant；FRAME_PADDING 16 走 Tailwind md token |
| 2026-08-30 | LogoUploader Landscape Image Export Squash：`useImageCrop.cropImage()` 的 `srcSquareSize` 公式缺 `naturalHeight` cap，landscape 圖 export 會被縱向拉伸填滿 960×960；test 內 local duplicate 函式讓 conformance test 抓不到 bug | runs/improvements/feedback/20260830-logo-uploader-landscape-squash.md | `computeSrcSquareSize` 從 useImageCrop 抽出 export 為 pure function；新增 8 個 conformance case（portrait / square / mild landscape / wide landscape 10:3 / extreme 10:1 等） |
| 2026-08-30 | LogoUploader iPhone 12 Pro Max Horizontal Overflow：`VIEWPORT_PADDING=48` 只算一層 `p-6` 但實際有兩層（CardBuilderPage wrapper + Workspace aside），mobile viewport 觸發 48px 水平 overflow | runs/improvements/feedback/20260830-logo-uploader-iphone12promax-double-padding.md | `VIEWPORT_PADDING` 48 → 96；新增 iPhone 12 Pro Max (428px) regression guard；既有 320/375 期望值改對；建議在 `006-verification.mdc` 或 `013-rwd.mdc` 加「layout chain 透明度」紀律 |
| 2026-08-30 | LogoUploader Portrait Crop Stale Closure：`handlePointerUp` useCallback 空 deps 導致 portrait / landscape 圖垂直拖曳後 crop 位置偏移 ~250 source px | runs/improvements/feedback/20260830-logo-uploader-portrait-stale-closure.md | 加 3 個 conformance test 守住 portrait / landscape / square；handlePointerUp deps 加 baseContainerW/H；建議 `028` § 12 或 general rule 加 useCallback deps 紀律 |
| 2026-08-27 | LogoUploader Crop Zoom — Mask Invariant + Bug-C Fix：三層結構 + srcSquareSize 公式 + syncFocalFromOffset 修正 + 17 個 conformance tests + 小圖 corner case 修 | DEV/08-2026/27-logo-crop-zoom-invariant.md + runs/improvements/feedback/20260826-0827-logo-crop-zoom-full-trace.md + runs/decisions/2026-08-27-logo-crop-zoom-invariant-mask.md | 新增 rule `028` § 11；SKILL § Crop Window Invariant；design-system § 13 |
| 2026-08-22 | Migration Apply Pipeline：`expires_at` migration 放在 `supabase/migrations/` 但從未 apply 到 production；建議每個 migration 需 pipeline check 或 CI 驗證 | runs/improvements/feedback/20260822-migration-apply-pipeline.md | Migration apply pipeline 待建立；`apps/backend/src/modules/cards/db/templates.test.ts` 待建 |
| 2026-08-22 | CardBuilder 草稿完整實錄（Aug 21-22）：TTL + pg_cron + Abandon DELETE + schema drift 完整 trace | DEV/08-2026/0822-card-builder-draft-abandon-full-trace.md | 待 revert `expires_at` 繞過；待建 `templates.test.ts` |
| 2026-08-22 | CardBuilder Step 2 issuerName 預填失敗 + Membership Extension `isPaid` checkbox：`useAuth()` 回傳 `{ state }` 不是 `{ tenant }` 直接解構；後端 `templates.ts` 和 `request.ts` 的 `TemplateSettings` 漏 `isPaid` | DEV/08-2026/0822-card-builder-step2-issuer-fix-and-membership-extension.md | 下次新增 settings 欄位時，同步檢查 shared schema → backend request.ts → backend db interface 三層 |
| 2026-08-21 | Session/Cookie 跨域問題 + JWT_SECRET 未設定 | runs/improvements/feedback/20260821-session-cookie-cross-origin.md | `saome-github-deploy` skill 需補充 backend secrets checklist |
| 2026-08-21 | CardBuilder Step 2 PUT 500：`updateTemplate` 用 `$N` + tagged template 混合，postgres.js 把 `$1` 視為 dollar-quoted delimiter；四次嘗試後改用所有值 `${}` tagged injection | runs/improvements/feedback/20260821-card-builder-update-template-500.md | `000-modular-design.mdc` Part B 禁止清單應加 postgres.js antipattern |
| 2026-08-21 | CardBuilder 草稿 TTL 定時清理：`expires_at` + pg_cron 每小時清理 orphan draft；`card_type` 改 nullable 區分有意義草稿；`touchExpiresAt` keep-alive | DEV/08-2026/0821-card-builder-draft-ttl-cleanup.md | TTL 時長 / 頻率待優化；Production migration CI/CD 待建立 |
| 2026-08-21 | CardBuilder Extension Pattern：`templateSettingsSchema` flat + `cardTypeExtensions` map；Option B 勝過 Nested Schema，確保新增卡種不影響 base schema | runs/decisions/2026-08-21-card-type-extension-pattern.md | 待填入各卡種商業欄位 |
| 2026-08-21 | CardBuilder Step 2 Base Fields + Card Back UI | DEV/08-2026/0821-card-back-ui-and-extension-pattern.md | Extension pattern 決策見 decision log |
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

## 使用方式

| 日期 | 動作 | 狀態 |
|------|------|------|
| 2026-08-16 | `023-shared-package.mdc` 加 i18n 元件化原則 + namespace checklist | ✅ done |
| 2026-08-16 | 加 `scripts/verify-i18n-keys.mjs` i18n smoke test | ✅ done |
| 2026-08-16 | 普查 `cardBuilder`、`cardEditor` namespace（確認無需拆分） | ✅ done |
| 2026-08-16 | 加 `025-vibe-coding-l2-checklist.mdc` rule | ✅ done |
| 2026-08-16 | 普查 `auth`、`landing`、`legal`、`passNotification`、`theme` 的 cross-locale drift | ⏳ pending |
| 2026-08-17 | `016-config-and-tsconfig-discipline.mdc` 補第 8 surface：CI cache `cache-dependency-path` 綁定 `package-lock.json` | ⏳ pending |
| 2026-08-17 | `025-vibe-coding-l2-checklist.mdc` 或新建 `026-ci-workflow-checklist.mdc`：加 CI workflow 修改 checklist（新增 dep 前確認 cache key） | ⏳ pending |
| 2026-08-21 | `saome-github-deploy` skill 補充：部署後端前，確認 `wrangler secret list` 所有 secrets 已正確設定 | ⏳ pending |
| 2026-08-21 | `000-modular-design.mdc` Part B 禁止清單加：動態 UPDATE 不得用 `$N` + tagged template 混合（postgres.js antipattern）；加 `apps/backend/src/modules/cards/db/templates.test.ts` 覆蓋 `updateTemplate` | ⏳ pending |
| 2026-08-22 | 強化 `019` 觸發條件：5 種情境必跑四層同步 check | ✅ done |
| 2026-08-22 | 強化 `026` 門檻：從「5+ 檔案」改為「1 次 smoke fail」| ✅ done |
| 2026-08-22 | `saome-github-deploy` skill 加 migration apply blocking check | ✅ done |
| 2026-08-22 | 強化 `001` Decision Log：7 種架構改動必進 Decision Log | ✅ done |
| 2026-08-27 | `syncFocalFromOffset` + `srcSquareSize` 公式抽出到 `packages/shared/logic/cropGeometry.ts`（RN-friendly）| ⏳ pending |
| 2026-08-27 | BackgroundUploader（1860×738 crop）沿用 Crop Window Invariant pattern + MediaAssetUploader variant="background" — schema field `backgroundImage` 已預留 | ⏳ pending |
| 2026-08-27 | LogoUploader Crop Zoom — Mask Invariant + Bug-C Fix | ✅ done |
| 2026-08-30 | `028` § 12 或 general `000-modular-design.mdc` 加 useCallback deps 紀律：「closure 變數全列舉後逐一進 deps」 | ⏳ pending |
| 2026-08-30 | LogoUploader Portrait Crop Stale Closure Fix | ✅ done |
| 2026-08-30 | LogoUploader iPhone 12 Pro Max Horizontal Overflow Fix | ✅ done |
| 2026-08-30 | `028` § 12 Stage Height Invariant（landscape frame 不超出 stage）：`baseContainerH = max(aspectMatchedH, maskH + 2 × FRAME_PADDING)`，outer = stage；FRAME_PADDING 16 走 Tailwind md token；前 4 輪 fix 都是症狀層，第 5 輪才改變結構假設本身；SKILL `saome-image-upload` § Stage Height Invariant 同步 | ✅ done |
| 2026-08-30 | LogoUploader Mobile Fix Cycle master DEV LOG（4 輪 mobile UX 修正循環 + 結構 fix + rule 沉澱，cross-cutting pattern：≥3 輪症狀 fix 還沒清 = 結構假設錯） | ✅ done |
| 2026-08-30 | 在 `.cursor/rules/006-verification.mdc` 或 `.cursor/rules/uiux/013-rwd.mdc` 加「layout chain 透明度」紀律：component 用 `viewportW - X` 算寬度時，X 必須明列所有 wrapper 的 padding 來源；測試期望值必須對應真實 layout 事實，不是程式碼公式 | ⏳ pending |
| 2026-08-30 | Audit 其他用 `window.innerWidth` 計算 layout 的元件（CardBuilderEditorPreview `max-w-sm` 等）對 layout chain 的認知是否正確 | ⏳ pending |
| 2026-08-30 | Image cache busting 三層同時存在 pattern（`?v=${issuerLogoVersion}` query param）：Rule 028 § 13 Image Cache Busting；保留固定 R2 檔名 + 1 年 cache + 前端 URL versioning，零 UUID 浪費 | ✅ done |
| 2026-08-30 | Image auth strategy 保留 query token（Decision Log 引用待寫）：`<img src>` 跟 RN `<Image>` 都不送 Authorization header，query token 是唯一兩邊通用方案 | ✅ done |
| 2026-08-30 | `useImageCrop` 平台分流（`.ts` / `.web.ts` / `.native.ts`）：Rule 024 Hook Split Pattern + tsconfig `moduleSuffixes` 設定；`.native.ts` 必須 throw 而非 silent stub | ✅ done |
| 2026-08-30 | LogoUploader 主組件 887 → 394 行（-56%）：拆 7 個 sub-component（UploadPrompt / LogoPreview / CropStage / ScaleControl / CropActions / UploadError / UploadingIndicator）；先抽 hook 再拆 sub-component（Rule 000 A.3 Hook Extraction Strategy） | ✅ done |
| 2026-08-30 | 純邏輯搬到 `packages/shared/logic/imageCrop.ts`：`validateLogoFile` / `applyScaleChange` / `computeSrcSquareSize` 全部 RN-friendly；`validateLogoFile` error message 改 i18n key（Rule 023 Shared Validation i18n Key） | ✅ done |
| 2026-08-30 | LogoUploader P0+P1 Refactor + Rule Sedimentation master DEV LOG（症狀層 → 結構層 → 規範層三層遞進；5 個新 pattern 沉澱到 4 個 rule + 1 個 SKILL） | ✅ done |
| 2026-08-30 | 寫 `runs/improvements/feedback/20260830-logo-image-cache-busting.md` 事故紀錄（rule 028 § 13 引用待寫，目前 master DEV LOG 涵蓋） | ⏳ pending |
| 2026-08-30 | 寫 `runs/decisions/2026-08-30-image-auth-strategy-query-token.md` Decision Log（rule 028 § 14 引用待寫） | ⏳ pending |
| 2026-08-30 | 寫 `runs/improvements/feedback/20260830-use-image-crop-platform-split.md` 事故紀錄（rule 024 Hook Split 引用待寫） | ⏳ pending |
| 2026-08-30 | 寫 `runs/improvements/feedback/20260830-logouploader-887-line-refactor.md` 事故紀錄（rule 000 A.3 引用待寫） | ⏳ pending |
| 2026-08-22 | Migration apply pipeline：CI check 確保 migration 與 code 同步 | ⏳ pending |
| 2026-08-22 | Migration apply 後 revert `expires_at` 繞過 | ⏳ pending |
| 2026-08-31 | MediaAssetUploader 主組件 340 行 > Rule 000 § A.2 100 行門檻——下一輪拆 sub-component | ⏳ pending |
| 2026-08-31 | CropStage 內部 testid `logo-crop-outer`/`logo-crop-stage`/`logo-crop-frame-layer` 含 "logo" prefix——重命名為 variant-agnostic | ⏳ pending |
| 2026-08-31 | CropImageFn signature 含 `HTMLImageElement`（RN 化障礙）——獨立 RN-migration PR | ⏳ pending |
| 2026-08-31 | Rule 027 加新章節「§ workerd JSON.stringify pitfall（MANDATORY）」：workerd runtime 的 `JSON.stringify` 對 non-ASCII 字串破壞成 `\uFFFD`；任何 jsonb / non-ASCII 字串注入必須用 `sql.json()`，禁止 `${JSON.stringify(x)}::jsonb`。補觸發關鍵字 | ✅ done |
| 2026-08-31 | Rule 028 § 2 Settings merge 加 workerd pitfall 註腳（cross-ref Rule 027）+ 禁止清單補一條「❌ 用 `${JSON.stringify(settings)}::jsonb` 注入 jsonb」 | ✅ done |
| 2026-08-31 | SKILL saome-image-upload Step 7 改範例：`sql\`settings = settings \|\| ${sql.json(input.settings as any)}\`` 取代舊的 `sql\`settings = settings \|\| ${JSON.stringify(input.settings)}::jsonb\`` | ✅ done |
| 2026-08-31 | CardBuilder Icon Upload Settings Chain master DEV LOG（4 階段修復鏈 single source of truth narrative，Bug A → Bug #8 → Bug #8.5 → workerd JSON.stringify 500） | ✅ done |
| 2026-08-31 | `updateTemplate` 補 non-ASCII round-trip test（中文 / 日文 / emoji / mixed CJK+ASCII）——見 `runs/improvements/feedback/20260831-workerd-json-stringify-jsonb-pitfall.md` § Test Coverage Status | ⏳ pending |
| 2026-08-31 | `unwrapCardSettings` 從 `CardBuilderEditor.store.ts`（frontend）與 `cardService.ts`（backend）抽出到 `packages/shared/logic/cardSettings.ts`，backend + frontend + 未來 RN 共用一份 | ⏳ pending |
| 2026-09-01 | SKILL `saome-dev-servers` 改寫為 6-phase（Recon / Surgical kill / Tmp cleanup / Backend / Frontend / Health）+ PowerShell UTF-8 top-of-file callout;新增 wrapper (`scripts/dev-restart.ps1` + `.cmd` shim);保留所有常見錯誤排查 section 並更新「多個 node.exe 占用端口」指向 wrapper | ✅ done (this commit) |
| 2026-09-01 | 觀察 `-Force` / `-Status` 使用頻率 — 若 `-Force` 常用表示 surgical kill 太保守;若 `-Status` 常用表示 debug 「到底有沒有起來」痛點仍高頻 | ⏳ pending |

## 使用方式

1. **新 session 開啟** — 第一件事讀本 INDEX 了解最近教訓。
2. **找特定主題** — 依日期與主題欄定位。
3. **寫新 feedback** — `runs/improvements/feedback/YYYYMMDD-<topic>.md`，至少含「背景/根因/修法/學習」四段。
4. **新增 feedback 後** — 回頭在本 INDEX 加一行（依日期倒序排）。

## 觸發條件

引用 `.cursor/skills/saome-self-improvement/SKILL.md` trigger #5：同日多於 1 個 feedback 時必須觸發更新此 INDEX。
