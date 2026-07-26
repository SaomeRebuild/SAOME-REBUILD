# spec: DemoPage

> SAOME 演示頁

---

## 0. Metadata

| 欄位 | 值 |
|---|---|
| Feature | DemoPage |
| Owner | `@agent` |
| Status | Implemented |
| Created | 2026-07-26 |

---

## 1. 設計原則檢查

- DemoPage.tsx（31 行）✅ ≤ 200 行上限
- 動態化：i18n keys + CSS variables ✅

---

## 2. EARS 需求

- UBIQUITOUS：系統根據目前語言設定正確渲染 UI 文字

---

## 5. i18n 影響

| Key | zh-TW | en |
|---|---|---|
| `demo.*` | ✅ 完整 | ✅ 完整 |

---

## 7. BDD 場景對應

對應 `specs/features/demo-page.feature`：

| 場景 ID | 場景名稱 | 對應 vitest |
|---|---|---|
| 1 | 頁面標題正確渲染 | DemoPage.test.tsx |
| 2 | i18n 繁中 | DemoPage.test.tsx |

---

## 13. 變更紀錄

| 日期 | 作者 | 變更 |
|---|---|---|
| 2026-07-26 | @agent | 初版建立 |
