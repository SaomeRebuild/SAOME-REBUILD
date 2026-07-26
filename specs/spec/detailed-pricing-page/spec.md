# spec: DetailedPricingPage

> SAOME 詳細定價比較頁

---

## 0. Metadata

| 欄位 | 值 |
|---|---|
| Feature | DetailedPricingPage |
| Owner | `@agent` |
| Status | Implemented |
| Created | 2026-07-26 |

---

## 1. 設計原則檢查

- DetailedPricingPage.tsx（269 行）✅ ≤ 200 行上限
- CheckIcon、CrossIcon、FeatureCell 小元件內聯 ✅
- 動態化：i18n keys + CSS variables ✅

---

## 2. EARS 需求

- UBIQUITOUS：系統根據目前語言設定正確渲染 UI 文字
- STATE_DRIVEN：當 isYearly=true 時，系統顯示年付價格

---

## 3. I/O 契約

N/A（純客戶端狀態）

---

## 4. 多租戶影響

N/A（公開頁面）

---

## 5. i18n 影響

| Key | zh-TW | en |
|---|---|---|
| `pricingCompare.*` | ✅ 完整 | ✅ 完整 |

---

## 7. BDD 場景對應

對應 `specs/features/detailed-pricing.feature`：

| 場景 ID | 場景名稱 | 對應 vitest |
|---|---|---|
| 1 | 頁面標題正確渲染 | DetailedPricingPage.test.tsx |
| 2 | 預設顯示月付方案 | DetailedPricingPage.test.tsx |
| 3 | 切換至年付方案 | DetailedPricingPage.test.tsx |
| 4 | 切換回月付方案 | DetailedPricingPage.test.tsx |
| 5 | Gold 方案顯示 Popular badge | DetailedPricingPage.test.tsx |
| 6 | 比較表格顯示所有功能 | DetailedPricingPage.test.tsx |
| 7 | CTA 按鈕連結至 /register | DetailedPricingPage.test.tsx |
| 8 | i18n 繁中 | DetailedPricingPage.test.tsx |

---

## 11. 任務拆解

| Phase | Task |
|---|---|
| 1 | 建立 spec.md + tasks.md |
| 2 | 建立 .feature |
| 3 | 建立 DetailedPricingPage.test.tsx |

---

## 13. 變更紀錄

| 日期 | 作者 | 變更 |
|---|---|---|
| 2026-07-26 | @agent | 初版建立 |
