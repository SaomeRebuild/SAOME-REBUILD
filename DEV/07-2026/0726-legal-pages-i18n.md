# 2026-07-26 Legal Pages Full i18n Refactor

## Session Summary

### 任務
回應使用者反饋：GDPRPage / PrivacyPage（TermsPage 已是 i18n）切換英文後仍顯示中文。原因是 component 內大量 hardcoded 中文字串未走 `t(...)`。本次任務把這三個法律頁面完整雙語化。

### 完成的 SDD/BDD/TDD 流程

#### 1. SDD
- `specs/spec/legal-pages-i18n/spec.md` — EARS 需求、Source of Truth 聲明（無 mu-plugins 對應）、i18n 影響表、BDD 對應、Verification 標準
- `specs/spec/legal-pages-i18n/tasks.md` — 11 個 phase 拆解

#### 2. BDD
- `specs/features/legal-pages-i18n.feature` — 10 個 Gherkin 場景（繁中預設 / 切英文 / 英文模式無中文殘留）

#### 3. TDD（Red → Green → Refactor）
- `frontend/src/pages/legal/GDPRPage.test.tsx` — 11 個測試（zh-TW 6 + en 5 + 1 chinese-char rejection）
- `frontend/src/pages/legal/PrivacyPage.test.tsx` — 11 個測試（zh-TW 5 + en 6 + 1 chinese-char rejection）

### 修改的檔案

#### 法律頁面重構（folder-per-feature 拆分）
- `frontend/src/pages/legal/GDPRPage.tsx`（120 行，原本 126 行）— orchestrator
- `frontend/src/pages/legal/GDPRPage/data.ts`（12 行）— 資料陣列
- `frontend/src/pages/legal/GDPRPage/tables.tsx`（83 行）— PartiesTable、ScopeTable
- `frontend/src/pages/legal/PrivacyPage.tsx`（118 行，原本 129 行）— orchestrator
- `frontend/src/pages/legal/PrivacyPage/data.ts`（43 行）— 資料陣列
- `frontend/src/pages/legal/PrivacyPage/tables.tsx`（85 行）— ControllerTable、CollectionTable
- `frontend/src/pages/legal/TermsPage.tsx` — 不動（已 100% i18n）

#### i18n 雙語補充
- `frontend/src/i18n/locales/zh-TW.json` — 補 85 個 leaf keys（`legal.gdpr.*` 35 + `legal.privacy.*` 50）
- `frontend/src/i18n/locales/en.json` — 補對應 85 個英文 keys

### 設計決策

1. **拆分策略**：原本單檔 225 / 239 行超出 200 行上限。採用 `<PageName>/data.ts` + `<PageName>/tables.tsx` pattern，把資料陣列與 table 元件抽出，page orchestrator 降到 120 行內。
2. **i18n 從 split 重構為 label/desc 對**：原本我嘗試用 `.split(/[：:]/)` 拆中文字串，但這對英文無 separator，後改為 `purposeLabel` + `purposeDesc` 兩個分離 keys。
3. **加 `collection.intro` 一段**：原 PrivacyPage B 段開頭有一句「我們僅基於明確、合法和特定的目的收集和處理您的個人資料。」，原本 hardcoded，補到 JSON。

### Verification 結果

```
Test Files  15 passed (15)
Tests       126 passed (126)
Duration    20.76s
```

- `tsc --noEmit` 0 error ✅
- `vitest run` 126/126 全綠 ✅
- `vite dev` 啟動 720ms，HTTP 200（/、/privacy、/gdpr、/terms）✅
- 兩版 `legal.privacy.*` 與 `legal.gdpr.*` 85 個 leaf keys 數完全對應 ✅
- Deslop 檢查：無 console.log、as any、narration 註解、defensive try/catch ✅

### 失敗記錄（附錄）

第一次跑測試時 `GDPRPage.test.tsx` 第 31 行失敗，原因是測試 hardcoded 了「資料處理**協定** (DPA)」（議 = 定），與 zh-TW.json 的「資料處理**協議** (DPA)」（議 = 議）差一字。修正後 11/11 通過。

這是個 input typo，**不是 code 邏輯問題**。但提醒我：未來測試若有 hardcoded 中文，應該用 `t(...)` 取得後比對，避免此類 typo。

### i18n 重要設計

- DSR 條列翻譯採用業界慣用：Access / Rectification / Erasure / Restriction / Data Portability / Objection
- 法律術語精確：GDPR Article 6(1)(b) / Article 32 / Standard Contractual Clauses (SCCs) / DSR / DPIA
- Sub-processors 結構：Cloudway（hosting） + DigitalOcean（cloud infrastructure）

### 下一步

- 啟動瀏覽器手動切換 zh-TW / en 確認實際 render（雖然測試已驗證，但建議人工 eyeball）
- 把這次的變更 commit 上去
- DetailedPricingPage.tsx 有 fragment 缺少 key 的 React 警告（既有問題），可在後續 PR 修
