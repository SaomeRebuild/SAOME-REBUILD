# spec: Legal Pages Full i18n Refactor

> 為三個法律頁面（GDPR / Privacy / Terms）補完繁中＋英文 i18n 雙語化。
> 當前 B1 完成的版本切換英文時仍顯示中文硬編碼。本 feature 修正此一違規。

---

## 0. Metadata

| 欄位 | 值 |
|---|---|
| Feature | legal-pages-i18n |
| Owner | `@agent` |
| Status | Implementing |
| Created | 2026-07-26 |
| Tracking | `.cursor/rules/000-modular-design.mdc`、`.cursor/rules/003-i18n.mdc` |

---

## 1. 設計原則檢查

- 模組化：GDPRPage、PrivacyPage 重構後 ≤ 200 行（TermsPage 已 ≤ 200 行）
- 動態化：所有 UI 文字走 `t(...)` ＋ zh-TW / en JSON locale，無寫死
- 依賴方向：純前端，不動 backend / shared

---

## 2. 問題陳述

`frontend/src/pages/legal/{GDPRPage,PrivacyPage,TermsPage}.tsx` 目前只有 section 標題（如 `legal.gdpr.sA`）走 `t()`，但表格內容、條列項目、段落文字幾乎全部以中文寫死。這違反 `.cursor/rules/003-i18n.mdc` 第 5 條「不接受 hard-coded 中文 / 英文」鐵律。

當使用者切換語言至 en 時，表格、條列、段落仍顯示中文，導致「半中半英」成果。

---

## 3. EARS 需求

- **UBIQUITOUS**：所有 UI 文字（包含表格行內文、條列、段落、strong label）皆由 `useTranslation()` 取得，不得在 component 內以字串字面值出現
- **EVENT-DRIVEN**：當 `i18n.changeLanguage('en' | 'zh-TW')` 被呼叫時，所有頁面 UI 文字即時切換，無字串殘留
- **STATE-DRIVEN**：預設語言為 zh-TW（與 `frontend/src/i18n/index.ts` 的 `lng: 'zh-TW'` 一致）
- **UNWANTED**：當 en 或 zh-TW 任一版本缺 key 時，UI 顯示 fallback 字串（會破壞雙語完整性的可觀察性）— 所以 CI 必須驗證兩版 keys 完全對應

---

## 4. 商業邏輯來源 / Source of Truth

- **無 mu-plugins 對應**：本 feature 為純前端 i18n 重構，不涉及商業邏輯
- 內容來源：當前 component 內已寫死的中文字串 → 翻譯為英文後搬到 i18n JSON
- 此 feature 不沿用任何 mu-plugins 程式碼、UI 風格、欄位命名

---

## 5. i18n 影響

| Sub-tree | zh-TW | en |
|---|---|---|
| `legal.terms.*` | ✅ 已完整 | ✅ 已完整 |
| `legal.privacy.*` | ❌ 缺表格/條列/段落 keys（補 30+ 個） | ❌ 缺對應英文 |
| `legal.gdpr.*` | ❌ 缺表格/條列/段落 keys（補 30+ 個） | ❌ 缺對應英文 |

###   預估新增的 i18n keys

**`legal.gdpr.*`**（27 個）：
- `parties.controller.label` / `.address`
- `parties.processor.label` / `.address`
- `scope.tableHeader.item` / `.desc`
- `scope.purpose` / `.dataSubjects` / `.dataCategories` / `.sensitivity` / `.nature` / `.duration`
- `obligations.processingOnly.title` / `.body`
- `obligations.confidentiality.title` / `.body`
- `obligations.toms.title` / `.body`
- `obligations.subProcessors.title` / `.existing` / `.new`
- `obligations.assistance.title` / `.dsr` / `.dpia` / `.breach`
- `termination.deletion` / `.audit`

**`legal.privacy.*`**（30 個）：
- `controller.table.controller` / `.address` / `.contact` / `.email` / `.effectiveDate` / `.effectiveValue`
- `collection.tableHeader.type` / `.purpose` / `.basis`
- `collection.row1.type` / `.purpose` / `.basis`
- `collection.row2.type` / `.purpose` / `.basis`
- `collection.row3.type` / `.purpose` / `.basis`
- `processor.body`
- `sharing.subProcessors` / `.intlTransfer`
- `rights.title` / `.intro` / `.access.*` / `.rectification.*` / `.erasure.*` / `.restriction.*` / `.portability.*` / `.objection.*`
- `retention.dataRetention` / `.security`

合計約 57 個新 keys。

---

## 6. 影響範圍

| 檔案 | 動作 |
|---|---|
| [frontend/src/pages/legal/GDPRPage.tsx](frontend/src/pages/legal/GDPRPage.tsx) | 重寫：所有 hardcoded 中文字串 → `t(...)` |
| [frontend/src/pages/legal/PrivacyPage.tsx](frontend/src/pages/legal/PrivacyPage.tsx) | 重寫：所有 hardcoded 中文字串 → `t(...)` |
| [frontend/src/pages/legal/TermsPage.tsx](frontend/src/pages/legal/TermsPage.tsx) | 不動（已 100% i18n） |
| [frontend/src/i18n/locales/zh-TW.json](frontend/src/i18n/locales/zh-TW.json) | 補 `legal.privacy.*` 與 `legal.gdpr.*` 表格/條列/段落 keys |
| [frontend/src/i18n/locales/en.json](frontend/src/i18n/locales/en.json) | 補對應英文 |
| [frontend/src/pages/legal/GDPRPage.test.tsx](frontend/src/pages/legal/GDPRPage.test.tsx) | 新建：雙語斷言 |
| [frontend/src/pages/legal/PrivacyPage.test.tsx](frontend/src/pages/legal/PrivacyPage.test.tsx) | 新建：雙語斷言 |
| [specs/features/legal-pages-i18n.feature](specs/features/legal-pages-i18n.feature) | 新建 Gherkin 場景 |
| [specs/spec/legal-pages-i18n/tasks.md](specs/spec/legal-pages-i18n/tasks.md) | 新建 tasks |

---

## 7. BDD 場景對應

對應 [specs/features/legal-pages-i18n.feature](specs/features/legal-pages-i18n.feature)：

| 場景 ID | 場景名稱 | 對應 vitest |
|---|---|---|
| 1 | 預設繁中 → GDPR 頁面標題正確 | GDPRPage.test.tsx |
| 2 | 預設繁中 → Privacy 頁面標題正確 | PrivacyPage.test.tsx |
| 3 | 預設繁中 → Terms 頁面標題正確 | DetailedPricingPage.test.tsx（已存在 sc16） |
| 4 | 切英文 → GDPR 頁面標題翻成英文 | GDPRPage.test.tsx |
| 5 | 切英文 → Privacy 頁面標題翻成英文 | PrivacyPage.test.tsx |
| 6 | 切英文 → GDPR 表格內容（controller / processor）顯示英文 | GDPRPage.test.tsx |
| 7 | 切英文 → Privacy 表格內容（data types）顯示英文 | PrivacyPage.test.tsx |
| 8 | 切英文 → GDPR 段落標題（processingOnly / confidentiality / TOMS）顯示英文 | GDPRPage.test.tsx |
| 9 | 切英文 → Privacy DSR 條列（Access / Rectification / Erasure...）顯示英文 | PrivacyPage.test.tsx |
| 10 | 切英文 → 沒有任何中文字串殘留（regex 檢查） | 透過 vitest 兩版斷言覆蓋 |

---

## 8. 驗證

- `tsc --noEmit` 0 error
- `vitest run` 全綠
- vite dev 啟動成功（HTTP 200）
- 瀏覽器手動切換 z h-TW / en，確認三頁皆無字串殘留
- en.json 與 zh-TW.json 的 `legal.privacy` 與 `legal.gdpr` 子樹，每個 leaf key 數量必須完全一致

---

## 9. 風險與防呆

| 風險 | 防呆 |
|---|---|
| en.json 漏 key 導致 fallback 顯示中文 | 平行比對兩版 keys 數量（Script 驗證） |
| 重寫時檔案超過 200 行上限 | 拆 sub-component（必要時） |
| 改動影響既有 sc16/i18n 測試 | 既有的 DetailedPricingPage 等測試不動 |
| 法律術語翻譯不準確 | 對照 GDPR Article 6 / 32 / Standard Contractual Clauses 標準英文 |

---

## 13. 變更紀錄

| 日期 | 作者 | 變更 |
|---|---|---|
| 2026-07-26 | @agent | 初版建立 |
