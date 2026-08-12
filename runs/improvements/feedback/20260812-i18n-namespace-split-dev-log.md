# DEV LOG: i18n Namespace Split

**Date**: 2026-08-12
**Author**: Cursor Agent
**Task**: i18n namespace split — `translation` (479 lines) → feature namespaces
**Status**: ✅ Schema split done, ❌ 38 tests still failing

---

## 背景與動機

### 既有問題

- `translation` namespace 是一個 479 行的 monolith，涵蓋 auth、landing、pricing、nav、theme、legal、member 等完全不相關的 feature
- 新增任何 i18n key 都可能放錯位置
- React Native 化時無法拆分獨立的 feature module

### 目標

把 `translation` namespace 拆分為 9 個 feature namespace：

| namespace | 用途 |
|---|---|
| `auth` | 登入、註冊、表單驗證 |
| `dashboard` | Dashboard layout |
| `landing` | Landing Page、Hero、Features、定價說明 |
| `legal` | 服務條款、隱私權、DPA |
| `passNotification` | Pass 通知（trial、renewalReminder） |
| `pricing` | 定價頁 |
| `theme` | 主題切換 |
| `nav` | 導航連結 |
| `member` | 會員相關 |

---

## 執行過程

### Phase 1: 既有 locale 檔案分析

掃描 `src/i18n/locales/` 下所有 `.json` 檔案，理解既有結構：
- `en.json` — 英文翻譯（479 keys）
- `zh-TW.json` — 繁體中文翻譯（479 keys）

### Phase 2: namespace 拆分

從 `en.json` / `zh-TW.json` 抽取對應 key 寫入獨立的 namespace 檔案：
- `auth.en.json` / `auth.zh-TW.json`
- `dashboard.en.json` / `dashboard.zh-TW.json`
- `landing.en.json` / `landing.zh-TW.json`
- `legal.en.json` / `legal.zh-TW.json`
- `passNotification.en.json` / `passNotification.zh-TW.json`
- `pricing.en.json` / `pricing.zh-TW.json`
- `theme.en.json` / `theme.zh-TW.json`
- `nav.en.json` / `nav.zh-TW.json`
- `member.en.json` / `member.zh-TW.json`

### Phase 3: i18n init 同步

更新 `src/i18n/index.ts` 和 `src/test/i18n.ts`，讓所有 namespace 的 resources 正確 init。

### Phase 4: 元件更新

更新所有使用 i18n 的元件：
- `RegisterForm` → `useTranslation(['auth'])`
- `DashboardFooter` → `useTranslation(['landing', 'nav'])`
- `Footer` → `useTranslation(['landing', 'nav'])`
- `Header` → `useTranslation(['nav'])`
- `PricingSection` → `useTranslation(['pricing'])`
- `DetailedPricingPage` → `useTranslation(['pricing'])`

### Phase 5: 測試修復

修復 `RegisterForm.test.tsx` 中 5 個 mobile 欄位測試（✅ 通過）。
`DashboardFooter.test.tsx` privacy link 測試修復（✅ 通過）。

---

## 觸發的副作用鏈

### 副作用 1: PowerShell encoding 腐化

PowerShell 腳本在讀寫 JSON 時將 UTF-8 中文字元破壞：
- `...` 被替換成 `??`
- 中文字元變成 `?X?` 等乱码

### 副作用 2: `.json` → `.ts` 轉換

嘗試修復腐化的檔案時，使用 Node.js 腳本重新生成 locale 檔案，選擇 `.ts` 格式而非 `.json`。

### 副作用 3: 測試失敗累積

38 個測試失敗，分佈如下：

| 失敗群組 | 數量 | 主要根因 |
|---|---|---|
| `DetailedPricingPage` | 5 | `pricingCompare.*` key 缺失 |
| `PricingSection` | 3 | `pricing.monthly` / `pricing.yearly` / `pricing.popular` 缺失 |
| `Header` + `Footer` + `homepage.test.tsx` | 8 | `nav.*` key 無法解析 |
| `GDPRPage` + `PrivacyPage` i18n tests | 22 | `legal.zh-TW.ts` 結構與元件使用的 key 不一致 |
| `LoginPage` + `App routing` | 3 | login placeholder 或 `auth.*` key 問題 |

---

## 關鍵決策記錄

### Decision 1: 從 `.json` 轉到 `.ts`

**觸發**：PowerShell 腐化中文內容後，嘗試用 Node.js 腳本重新生成檔案。

**選擇**：生成 `.ts` 格式（`export default {}`）而非 `.json`。

**理由**：當時認為 `.ts` 可以避免 Node.js 24 ESM 的 JSON import 問題。

**事後檢討**：❌ 這是一個**被動繞路**，而不是必要決策。詳見 Feedback 文件的根因分析。

### Decision 2: 拆分策略

**選擇**：每個 namespace 維持獨立的 locale 檔案（`auth.en.json`, `auth.zh-TW.json` 等）。

**事後檢討**：✅ 正確。Feature-level 拆分有助於未來 React Native 化。

---

## 驗證結果

### 通過的測試

- `RegisterForm.test.tsx` — 5/5 mobile 欄位測試 ✅
- `DashboardFooter.test.tsx` — privacy link ✅

### 失敗的測試

- `DetailedPricingPage` — 5 個 `pricingCompare.*` key 缺失
- `PricingSection` — 3 個 pricing key 缺失
- `GDPRPage` / `PrivacyPage` — 22 個 legal key 結構不一致
- `Header` / `Footer` / `homepage.test.tsx` — 8 個 nav key 問題
- `LoginPage` / `App routing` — 3 個 auth key 問題

**Total: 38 failures** — 待下一個 agent 修復。

---

## 衍生觀察

1. **i18n 測試覆蓋不足**：大部分測試依賴 snapshot 或 DOM 檢查，而非明確的 i18n key 存在性斷言
2. **命名空間 boundary 測試缺失**：沒有 `expect(Object.keys(resources['zh-TW'])).toContain('auth')` 之類的測試
3. **PowerShell UTF-8 處理**：在 Windows 環境處理 i18n 中文 JSON 需要特別注意 encoding

---

## Self-improvement 追蹤

- `runs/improvements/INDEX.md` — pending: 修復 38 個測試失敗

## 參照

- `runs/decisions/2026-08-12-i18n-namespace-split.md` — namespace split 決策記錄
- `runs/improvements/feedback/20260812-renewal-reminder-i18n-schema-feedback.md` — 相關 feedback
- `apps/frontend/src/i18n/index.ts` — i18n 初始化設定
- `apps/frontend/src/test/i18n.ts` — 測試環境 i18n 設定
- `runs/decisions/2026-08-12-i18n-test-fix-prompt.md` — 下個 agent 的修復提示詞
