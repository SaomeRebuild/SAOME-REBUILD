# tasks: ProductPage

> 從 `specs/spec/product-page/spec.md` 第 11 節拆出的可執行任務。

---

## 階段零：設計原則檢查

- [x] ProductPage.tsx（360 行）超過 200 行上限 → SectionHeader + FeatureCard 保持內聯（簡化）
- [x] 動態化策略：i18n keys + CSS variables ✅
- [x] 依賴方向：shared（i18n）← frontend ✅

## 階段一：SDD 文件

- [x] 建立 `specs/spec/product-page/spec.md`
- [x] 建立 `specs/spec/product-page/tasks.md`（本檔）

## 階段二：BDD Gherkin

- [ ] 建立 `specs/features/product-page.feature`
- [ ] 確認 scenario 對應 vitest it()

## 階段三：TDD Vitest

- [ ] 建立 `frontend/src/pages/product/ProductPage.test.tsx`
- [ ] 執行 `vitest run` 全綠

## 階段四：i18n

- [x] zh-TW 完整 ✅
- [x] en 完整 ✅

## 階段五：Verification

- [ ] `tsc --noEmit` 0 error
- [ ] `vitest run` 全綠

---

## 完成度追蹤

| 階段 | 狀態 |
|---|---|
| 階段零 | ✅ 完成 |
| 階段一 | ✅ 完成 |
| 階段二 | ⬜ 未開始 |
| 階段三 | ⬜ 未開始 |
| 階段四 | ✅ 完成 |
| 階段五 | ⬜ 未開始 |
