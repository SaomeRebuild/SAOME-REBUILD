# spec: ProductPage

> SAOME 商品細節頁（靜態行銷頁，無後端 API）

---

## 0. Metadata

| 欄位 | 值 |
|---|---|
| Feature | ProductPage |
| Owner | `@agent` |
| Status | Implemented |
| Created | 2026-07-26 |
| Spec-Kit Tag | - |
| Mu-Plugins 追溯 | N/A（純行銷頁） |

---

## 1. 設計原則檢查（Phase 0）

### 1.1 模組化
- ProductPage.tsx（360 行）≤ 200 行上限 ❌ 需要拆分
- SectionHeader（24 行）✅
- FeatureCard（36 行）✅
- 拆分後：SectionHeader + FeatureCard 各一個獨立 component 檔

### 1.2 動態化
- 所有 UI 文字走 i18n key，無 hardcode ✅
- 無店家可自訂常數（N/A，公開行銷頁）
- 無系統統一常數（N/A）

### 1.3 依賴方向
- frontend → shared（i18n）✅
- 无 backend 依賴 ✅

---

## 2. EARS 需求

### 2.1 Functional Requirements
- UBIQUITOUS：系統根據目前語言設定正確渲染所有 UI 文字
- UBIQUITOUS：系統依賴 design tokens 渲染視覺樣式
- UBIQUITOUS：所有 CTA 按鈕正確連結至對應頁面

### 2.2 Non-Functional Requirements
- i18n：zh-TW + en 雙語完整

---

## 3. I/O 契約

### 3.1 Input
| 欄位 | 型別 | 來源 | 必填 |
|---|---|---|---|
| 目前語言 | 'zh-TW' \| 'en' | i18n context | ✅ |

### 3.2 Output
N/A（純客戶端渲染）

---

## 4. 多租戶影響

N/A（公開行銷頁）

---

## 5. i18n 影響

| Key | zh-TW | en |
|---|---|---|
| `product.hero.*` | ✅ 完整 | ✅ 完整 |
| `product.intro.*` | ✅ 完整 | ✅ 完整 |
| `product.custom.*` | ✅ 完整 | ✅ 完整 |
| `product.engage.*` | ✅ 完整 | ✅ 完整 |
| `product.builder.*` | ✅ 完整 | ✅ 完整 |
| `product.campaign.*` | ✅ 完整 | ✅ 完整 |
| `product.share.*` | ✅ 完整 | ✅ 完整 |
| `product.email.*` | ✅ 完整 | ✅ 完整 |
| `product.offline.*` | ✅ 完整 | ✅ 完整 |
| `product.cta.*` | ✅ 完整 | ✅ 完整 |

---

## 6. 商業邏輯來源

N/A（純行銷頁）

---

## 7. BDD 場景對應

對應 `specs/features/product-page.feature`：

| 場景 ID | 場景名稱 | 對應 vitest file | 對應 it() |
|---|---|---|---|
| 1 | Hero section 標題正確渲染 | ProductPage.test.tsx | `renders hero section` |
| 2 | SectionHeader 正確渲染標題和副標題 | ProductPage.test.tsx | `renders section headers` |
| 3 | FeatureCard 正確渲染 icon、標題、說明 | ProductPage.test.tsx | `renders feature cards` |
| 4 | 8 個 section 內容正確 | ProductPage.test.tsx | `renders all 8 sections` |
| 5 | CTA 按鈕連結至 /register | ProductPage.test.tsx | `cta buttons link to register` |
| 6 | CTA 按鈕連結至 /pricing/compare | ProductPage.test.tsx | `cta buttons link to pricing` |

---

## 8. 模組化邊界

| 檔案類型 | 數量 | 位置 |
|---|---|---|
| React component | 2 | `pages/product/` |
| Vitest test | 1 | `pages/product/ProductPage.test.tsx` |
| i18n keys | 10 namespaces | `frontend/src/i18n/locales/` |

---

## 9. 動態化策略

| 寫死嫌疑 | 改為 |
|---|---|
| 所有 UI 文字 | `t('product.*')` ✅ 已實作 |
| 所有顏色/間距 | `var(--color-*)` ✅ 已實作 |
| 路由字串 | `to="/register"` ✅ 已實作 |

---

## 10. 安全影響

N/A

---

## 11. 任務拆解

| Phase | Task | 預估時間 |
|---|---|---|
| 1 | 建立 spec.md + tasks.md | 10 min |
| 2 | 建立 .feature | 10 min |
| 3 | 建立 ProductPage.test.tsx | 20 min |
| **總計** | | **~40 min** |

---

## 12. Verification 計畫

- [ ] `tsc --noEmit` 0 error
- [ ] `vitest run` 全綠
- [ ] i18n 雙語完整
- [ ] Deslop 檢查

---

## 13. 變更紀錄

| 日期 | 作者 | 變更 |
|---|---|---|
| 2026-07-26 | @agent | 初版建立 |
