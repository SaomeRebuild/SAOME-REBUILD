# Feedback: CSS Tailwind Classes 被全域 CSS 覆蓋

**日期**: 2026-07-26
**嚴重性**: 🟠 important（浪費時間 debug）
**影響範圍**: 前端元件

## 問題描述

當在 JSX 元素上使用 Tailwind utility class 設定 margin（`mb-24`、`mb-28` 等），但該元素的全域 CSS（`index.css`）同時設定了 `margin: 0`，Tailwind 的 margin class 會被覆蓋不生效。

### 具體案例

**案例 1（本次）**：
- 檔案：`frontend/src/components/home/HowItWorks.tsx`
- 元素：`<h2>` 標題
- Tailwind class：`mb-24 lg:mb-28`
- 全域 CSS：`h1, h2, h3, h4, h5, h6 { margin: 0; }`（`index.css` L:101-104）
- 結果：`margin-bottom` 仍然是 `0`，沒有變化

**案例 2（待補）**：
- [ ] 請補充第二個案例

## 共同模式

1. 使用 `margin` 類 Tailwind class（`mb-*`、`mt-*`、`ml-*`、`mr-*`）
2. 目標元素在全域 CSS 中有覆蓋 `margin` 的 selector（如 `h1-h6`、`p`、`*`）
3. 沒想到要先查 `index.css` 確認是否有衝突

## 根因分析（5 Whys）

1. **Why**: Tailwind class 沒生效
2. **Why**: 全域 CSS 的 `margin: 0` 優先權高於 Tailwind class
3. **Why**: 沒先檢查 `index.css` 是否有覆蓋
4. **Why**: 不知道哪些全域 CSS 會影響 Tailwind（`margin: 0`、`line-height` 等）
5. **Why**: 沒有「修改 component 前先檢查全域名」的 checklist / 規則

## 建議改進

### 方案 A：在 `index.css` 加上註解提醒（最簡單）
```css
/* 注意：全域重設 margin，可能與 Tailwind mb-*/mt-* 衝突
   如遇衝突，改用 inline style 或在 component 局部覆蓋 */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-family-heading);
  color: var(--color-foreground);
  margin: 0;
}
```

### 方案 B：建立 CSS specificity 檢查清單
在 修改任何 component 前，快速確認：
- [ ] 該 element 的 tag 在 `index.css` 是否有重設樣式
- [ ] 衝突時優先用 inline style（優先權最高）

### 方案 C：修改 `001-methodology.mdc` 或 `011-dev.mdc`
加入「修改 UI component 前先確認無全域樣式衝突」步驟。

## 影響評估

| 面向 | 影響 |
|------|------|
| 生產力 | 每次遇到要浪費 5-10 min debug |
| 規範 | 無相關 warning/rule |
| 預防 | 無 checklist |

## 對應規則

- `.cursor/rules/000-modular-design.mdc`（無相關）
- `.cursor/rules/frontend/023-shared-package.mdc`（無相關）
- `.cursor/rules/011-dev.mdc`（可能需加入 UI 修改 checklist）
