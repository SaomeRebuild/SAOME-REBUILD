# SAOME-REBUILD — i18n Namespace Migration: Fix Remaining Test Failures

## 背景

2026-08-12 完成了 i18n namespace split：
- 所有翻譯 key 從 `translation` namespace（479 行）拆分到 feature namespace（auth, dashboard, nav, landing, legal, pricing, member, passNotification, theme）
- 所有 locale 檔案從 `.json` 轉為 `.ts`（Node 24 ESM 兼容）
- `apps/frontend/src/i18n/index.ts` 和 `apps/frontend/src/test/i18n.ts` 已同步更新

### 主要修復已完成 ✅

- `RegisterForm.test.tsx` 的 5 個 mobile 欄位測試全部通過
- `DashboardFooter.test.tsx` privacy link 測試已修復
- `Footer.tsx` 已加入 `useTranslation(['landing', 'nav'])`

### 現況

目前 38 個測試失敗，分佈如下：

| 失敗群組 | 數量 | 根因 |
|---|---|---|
| `DetailedPricingPage` | 5 | `pricingCompare.*` key 缺失於 `pricing.zh-TW.ts` |
| `PricingSection` | 3 | `pricing.monthly` / `pricing.yearly` / `pricing.popular` 缺失 |
| `Header` + `Footer` + `homepage.test.tsx` | 8 | `nav.*` key 無法被解析（raw key 如 `nav.features` 出現） |
| `GDPRPage` + `PrivacyPage` i18n tests | 22 | `legal.zh-TW.ts` 結構與元件使用的 key 不一致 |
| `LoginPage` + `App routing` | 3 | login placeholder 或 `auth.*` key 問題 |

## Root Cause Analysis

### 1. PowerShell encoding 腐化問題（根本原因）

在 JSON → `.ts` 轉換過程中，PowerShell 腳本將 UTF-8 中文字元破壞。症狀：
- `...` 被替換成 `??`
- 中文字元變成 `?X?` 等乱码

目前 `landing.zh-TW.ts`、`legal.zh-TW.ts`、`auth.zh-TW.ts` 等檔案可能仍包含腐化的內容。

**驗證方法**：`node -e "require('./src/i18n/locales/landing.zh-TW.ts')"` 看是否成功；或用 VS Code 打開看是否看到乱码。

### 2. pricing.zh-TW.ts 缺少 `pricingCompare` nested key

元件使用：
```
t('pricingCompare.title')       // DetailedPricingPage.tsx line 97
t('pricingCompare.subtitle')    // line 103
t('pricingCompare.monthly')    // monthly toggle
t('pricingCompare.yearly')     // yearly toggle
t('pricingCompare.popular')     // badge
t('pricingCompare.category.card')  // table headers
```

但 `pricing.zh-TW.ts` 目前只有：
```
pricing: { periodMonth, periodYear, green, gold, platinum, cta, ... }
```

缺少 `pricingCompare` section。

### 3. `nav.*` key 無法解析

症狀：DOM 輸出 raw key 如 `nav.features`、`nav.product`。

可能原因：
- `test/i18n.ts` 的 `resources` 物件中 `nav` namespace 的 import/assign 有問題
- `landing.zh-TW.ts` 的 `nav.*` keys（如 `nav.product`、`nav.demo`）在 `footer` section 內，而不是獨立的 `nav` top-level key

### 4. `legal.zh-TW.ts` 結構問題

元件使用 deep key（如 `t('legal.gdpr.title')`），但 locale 檔案結構可能不匹配。

## 修復步驟

### Step 1: 驗證 locale 檔案 encoding

用 Node.js 驗證所有 zh-TW locale 是否正常：
```bash
cd apps/frontend
node -e "
const files = ['auth','dashboard','landing','legal','member','nav','passNotification','pricing','theme','zh-TW'];
for (const f of files) {
  try {
    require('./src/i18n/locales/' + f + '.zh-TW.ts');
    console.log('OK:', f);
  } catch(e) {
    console.error('FAIL:', f, e.message);
  }
}
"
```

任何 FAIL 的檔案都需要重寫。

### Step 2: 修補 `pricing.zh-TW.ts`

加入 `pricingCompare` section：

```typescript
// 參考 DetailedPricingPage.tsx 中的 t('pricingCompare.xxx') 呼叫
// 確認所有用到的 key 都有對應的 value
```

### Step 3: 修補 `landing.zh-TW.ts` 的 `footer.*` keys

確認 `footer` section 包含：
- `footer.slogan`, `footer.about`, `footer.features`, `footer.pricing`
- `footer.blog`, `footer.contact`, `footer.copyright`
- `footer.privacy`, `footer.terms`, `footer.gdpr`, `footer.securePayments`

### Step 4: 驗證 `test/i18n.ts` 的 nav namespace

確認 `nav.zh-TW.ts` 和 `nav.en.ts` 正確 import 且 resources 正確 assign。

### Step 5: 修補 `legal.zh-TW.ts` 和 `legal.en.ts`

檢查元件使用的 key 與 locale 結構是否一致（用 grep 搜 `t('legal.`）。

### Step 6: 跑完整測試確認

```bash
cd apps/frontend
npx vitest run 2>&1
```

目標：0 個測試失敗。

## 技術約束

- **Node 24 ESM**：所有 locale 檔案必須是 `.ts`（不能用 `.json`）
- **UTF-8 編碼**：寫入中文時用 `node -e "..."` 或 `.mjs` 腳本，**不要**用 Write tool 直接寫中文（會腐化）
- **Namespace 命名**：camelCase（`passNotification` 不是 `pass-notification`）
- **Feature namespace vs translation namespace**：`Footer` 等跨多個 namespace 的元件要用 `useTranslation(['landing', 'nav'])`

## 禁止事項

- ❌ 用 Write tool 直接寫入大量中文（會腐化）
- ❌ 修改 `vitest.config.ts` 的 alias（除非確認 vitest 和 vite 需要不同的 alias）
- ❌ 把 shared package 的 i18n 邏輯刪除
- ❌ 修改 `apps/frontend/src/i18n/index.ts` 的初始化結構（除非明確知道為什麼要改）

## 驗證清單（完成後必跑）

1. `node -e "require('./src/i18n/locales/landing.zh-TW.ts')"` → 無錯誤
2. `node -e "require('./src/i18n/locales/legal.zh-TW.ts')"` → 無錯誤
3. `cd apps/frontend && npx vitest run src/test/i18n.ts` → 如果有測試的話要綠
4. `cd apps/frontend && npx vitest run` → 0 失敗

## 參照

- `runs/decisions/2026-08-12-i18n-namespace-split.md` — namespace split 決策記錄
- `runs/improvements/feedback/20260812-renewal-reminder-i18n-schema-feedback.md` — 相關 feedback
- `apps/frontend/src/test/i18n.ts` — 測試環境的 i18n 設定（當前狀態）
- `apps/frontend/src/i18n/locales/` — 所有 locale 檔案
- `apps/frontend/src/pages/pricing/DetailedPricingPage.tsx` — 找到所有 `t('pricingCompare.*')` 用法
