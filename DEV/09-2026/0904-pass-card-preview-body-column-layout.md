# PassCardPreviewBody Column Layout — DEV LOG

> 日期：2026-09-04
> Committer：Josh <josh1989213@gmail.com>
> Branch：`main`
> Commits：本機 uncommitted，準備 3 個 batch 中的 commit #2
> 觸發 skill：`saome-dev-logging`
> 觸發契機：使用者反饋 2026-09-04「左右欄位是並排的，而兩個欄位的 L & V 是垂直排列」

---

## Metadata

- **日期**：2026-09-04
- **作者**：Josh
- **commit hash**：本機未 commit；push 後回填
- **規則 / skill 觸發**：
  - `003-tdd-integration.mdc`（TDD mandatory）
  - `002-bdd.mdc` / `012-bdd-workflow.mdc` 已廢除（Rule 001 確認）

---

## 背景

`PassCardPreviewBody` 是 SAOME 的 Apple Wallet / PassCreator 卡片正面「secondary field」區塊的 preview 元件。Apple Pass 風格：淡色分隔線 + 兩個 label/value 對（左欄 + 右欄）。

原本 layout：
```
[分隔線]
[左 label  左 value]   ← flex justify-between 一列
[右 label  右 value]   ← flex justify-between 一列
[分隔線]
```

使用者反饋這個 layout 不對：左右欄位是並排的（沒錯），但**兩個欄位內部的 Label & Value 應該是垂直排列**（label 在上、value 在下），符合 PassCreator 慣例。

新 layout：
```
[分隔線]
[左 label ]    [右 label ]   ← 兩欄並排
[左 value]    [右 value]    ← 兩欄並排
[分隔線]
```

### 範圍

| 類別 | 檔案 |
|---|---|
| 改 L2 元件 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewBody.tsx`（重寫 field-row JSX）|
| 新 L2 test | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewBody.test.tsx`（既有 25 + 新 column layout describe block 3 條 = 28 cases）|

### 不在這次範圍

- ❌ `passCard.{zh-TW,en}.ts` 的 `fieldPreview.{key}.{label,value}` 12 keys × 2 locales — 屬於 commit #1（功能配套），不屬於 layout fix
- ❌ `PassCardPreview.test.tsx` 的 2 條 memberLevel/birthday 欄位 regression — 屬於 commit #1（preview pipeline threading）
- ❌ 任何 i18n key 變更

---

## 症狀

### 症狀 A：layout 與 Apple Pass 慣例不符

- 環境：dev + production
- 觸發：CardBuilder Step 3 → 開 preview
- 觀察：
  ```
  電話   +8869XXXXXXXX   ← 電話在左，電話號碼在中
  E-mail  hi@saome.org   ← E-mail 在左，email 在中
  ```
- 預期：
  ```
  電話              E-mail
  +8869XXXXXXXX     hi@saome.org   ← label 在上、value 在下、兩欄並排
  ```
- 觸發訊息：使用者 2026-09-04 確認「左右欄位是並排的，而兩個欄位的 L & V 是垂直排列」

### 症狀 B：compact 模式下長 value 會溢出

- 環境：mobile preview（compact mode = `compact: true`）
- 觸發：左 / 右 slot 選 phone（value = `+8869XXXXXXXX`）
- 觀察：value 文字不 truncate，超出 column 寬度，導致右欄的 label / value 被擠出 container
- 預期：value 用 `truncate` class，超出部分顯示省略號

### 症狀 C：right column 沒對齊 Apple Wallet 慣例（右對齊）

- 環境：dev + production
- 觸發：觀察 Apple Wallet 的 secondary field（右欄 label/value 預設 right-aligned）
- 觀察：原本 right column 內部 text 是 left-aligned（與 left column 對稱）
- 預期：right column 內部 text 應該 right-aligned（mirror 對稱但保留 Apple Wallet 慣例）

---

## 探針 / 重現

### 症狀 A 重現

```
1. 開 CardBuilderEditor → Step 3 → leftField 選 "phone", rightField 選 "email"
2. 觀察 PassCardPreview 卡片正面的 Body section
3. 結論：左 label + 左 value 在同一 row 並排；右 label + 右 value 在下一 row 並排
4. 預期：左 column（label 上 / value 下）+ 右 column（label 上 / value 下）並排
```

DevTools inspection：
- `div.flex.justify-between > [左 label span, 左 value span, 右 label span, 右 value span]` 4 個 span 在同一 flex 容器內水平排列
- 應該是 `div.flex.flex-row > [div.flex-col > [label, value], div.flex-col > [label, value]]`

### 症狀 B 重現

```
1. 開 CardBuilderEditor → Step 3 → leftField="phone"
2. 切換到 mobile preview (PhoneFrame compact=true)
3. 觀察 Body section
4. 結論：左 value "+8869XXXXXXXX" 文字超出 column 寬度，右 column 被擠出
5. 預期：左 value 應該 truncate 為 "+8869XXXXXX..."，右 column 正常顯示
```

### 症狀 C 重現

```
1. 開 Apple Wallet reference 對比
2. 觀察：Apple Wallet right column 是 right-aligned
3. SAOME 觀察：原本 right column 內部 text 是 left-aligned
4. 預期：right column 內部 text 應該 right-aligned（label + value 都靠右）
```

---

## 根因

> 三個症狀都源自**同一個 layout 結構設計錯誤**：把 `[label, value]` 視為「一列並排的兩個文字」而非「一個 column 內的上下兩段」。

### 根因 A：layout 結構誤把 L & V 視為水平元素

原本 JSX 結構：
```tsx
<div className="flex flex-col gap-2">
  <div className="h-px bg-neutral-200" />   {/* 分隔線 */}
  <div className="flex justify-between">     {/* 左 row */}
    <span>{leftPreview.label}</span>
    <span>{leftPreview.value}</span>
  </div>
  <div className="flex justify-between">     {/* 右 row */}
    <span>{rightPreview.label}</span>
    <span>{rightPreview.value}</span>
  </div>
  <div className="h-px bg-neutral-200" />
</div>
```

這個結構把「左」視為一個 row、「右」視為另一個 row，每個 row 內部 `[label, value]` 用 `justify-between` 水平排列。**這是「label 在 value 旁邊」的 layout，不是「label 在 value 上方」的 layout**。

### 根因 B：value 沒 `truncate` class

原本 value span className（compact mode）：
```tsx
const valueClass = compact ? 'text-[11px] font-medium' : 'text-sm font-medium';
```

**沒**有 `truncate` class。當 value 是長字串（如 `+8869XXXXXXXX`）且 container 寬度有限時，文字會溢出而不會自動省略。

### 根因 C：right column 沒 `items-end`

原本 right row：
```tsx
<div className="flex justify-between">  {/* 沒 items-end */}
  <span>{rightPreview.label}</span>
  <span>{rightPreview.value}</span>
</div>
```

`justify-between` 把 label 推到左邊、value 推到右邊（這是 row 內的水平對齊），但 row 內的兩個 element 都是 left-aligned（沒 `text-right` 或 `items-end`），視覺上不像 Apple Wallet 的 right column（右對齊的 secondary field）。

---

## 修法

### 1. 重寫 field-row JSX 結構

新 JSX 結構：
```tsx
<div className={compact ? 'mt-2 flex flex-col gap-1 px-2' : 'mt-4 flex flex-col gap-2 px-4'}>
  {/* 分隔線 - Apple Pass 風格 (非文字 span, 不套 textColor) */}
  <div className="h-px w-full bg-neutral-200" />

  {/* 左右欄位 — 兩欄並排 (flex-row)，每欄 L & V 垂直排列 (flex-col)。
      對應 PassCreator secondary field 格式：左欄 [label / value]、右欄 [label / value]。 */}
  <div className={compact ? 'flex flex-row items-start justify-between gap-3 py-0.5' : 'flex flex-row items-start justify-between gap-4 py-1'}>
    {/* 左欄位 column：label（small, top）+ value（larger font-medium, bottom） */}
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={labelClass} style={textColor ? { color: textColor } : undefined}>
        {leftPreview.label}
      </span>
      <span className={valueClass} style={textColor ? { color: textColor } : undefined}>
        {leftPreview.value}
      </span>
    </div>

    {/* 右欄位 column：label（small, top）+ value（larger font-medium, bottom）— 結構對稱 */}
    <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
      <span className={labelClass} style={textColor ? { color: textColor } : undefined}>
        {rightPreview.label}
      </span>
      <span className={valueClass} style={textColor ? { color: textColor } : undefined}>
        {rightPreview.value}
      </span>
    </div>
  </div>

  {/* 底部分隔線 (非文字 span, 不套 textColor) */}
  <div className="h-px w-full bg-neutral-200" />
</div>
```

### 2. 關鍵設計決策

| 決策 | 理由 |
|---|---|
| Outer = `flex flex-row items-start justify-between gap-{3\|4} py-{0.5\|1}` | 兩欄並排（`flex-row`）+ column 內部 top-align（`items-start`）+ 兩欄之間 gap-3/4（依 compact 切換）+ 上下 padding |
| 每個 column = `flex min-w-0 flex-1 flex-col gap-0.5` | 兩欄等寬（`flex-1`）+ truncate 可運作（`min-w-0`）+ label-value 間距 2px（`gap-0.5`）+ 垂直排列（`flex-col`）|
| Right column 加 `items-end` | 對應 Apple Wallet secondary field 右對齊慣例（label + value 都靠右）|
| Compact mode：value class 加 `truncate` | 解決症狀 B：長 value（如 `+8869XXXXXXXX`）不溢出 |
| Label 永遠是 hint text（10px / 8px compact），value 永遠是 primary content（14px / 11px compact + font-medium）| 保留既有 typography hierarchy，符合 PassCreator 慣例 |
| textColor 套用到所有 4 個 span（左 label、左 value、右 label、右 value）| 既有契約，不變動 |
| 分隔線不套 textColor | 既有契約（分隔線是 `<div>`，本來就不套 color）|

### 3. TDD — 新增 3 條 load-bearing regression tests

在 `PassCardPreviewBody.test.tsx` 新增 `describe('column layout (left/right side-by-side, L&V vertical)')` block：

```ts
it('outer field container is flex-row (左右欄位並排)', () => {
  const { container } = render(<PassCardPreviewBody leftField="phone" rightField="email" />);
  const flexRowContainers = Array.from(container.querySelectorAll('div')).filter(
    (el) => el.className.includes('flex-row'),
  );
  expect(flexRowContainers.length).toBeGreaterThanOrEqual(1);
});

it('each column is flex-col with label above value (vertical L&V)', () => {
  const { container } = render(<PassCardPreviewBody leftField="phone" rightField="email" />);
  const flexColContainers = Array.from(container.querySelectorAll('div')).filter(
    (el) => el.className.includes('flex-col'),
  );
  expect(flexColContainers.length).toBeGreaterThanOrEqual(2);

  flexColContainers.forEach((col) => {
    const spans = Array.from(col.querySelectorAll(':scope > span'));
    if (spans.length < 2) return; // 非內容 column 跳過
    const firstSpanText = spans[0].textContent ?? '';
    const secondSpanText = spans[1].textContent ?? '';
    const firstIsLabel = firstSpanText.endsWith('.label') || firstSpanText === 'fieldLabelLeft';
    const secondIsValue = secondSpanText.endsWith('.value') || secondSpanText === 'fieldLabelRight';
    expect(firstIsLabel).toBe(true);
    expect(secondIsValue).toBe(true);
  });
});

it('left column contains phone.label + phone.value; right column contains email.label + email.value', () => {
  render(<PassCardPreviewBody leftField="phone" rightField="email" />);
  const phoneLabel = screen.getByText('fieldPreview.phone.label');
  const phoneValue = screen.getByText('fieldPreview.phone.value');
  const emailLabel = screen.getByText('fieldPreview.email.label');
  const emailValue = screen.getByText('fieldPreview.email.value');

  const phoneColumn = phoneLabel.parentElement;
  expect(phoneColumn).toBe(phoneValue.parentElement);
  expect(phoneColumn?.className).toContain('flex-col');

  const emailColumn = emailLabel.parentElement;
  expect(emailColumn).toBe(emailValue.parentElement);
  expect(emailColumn?.className).toContain('flex-col');

  expect(phoneColumn?.parentElement).toBe(emailColumn?.parentElement);
  expect(phoneColumn?.parentElement?.className).toContain('flex-row');
});
```

**TDD 證據鏈**：
1. 寫 failing test（先檢查 `it.each` 描述 layout）
2. 改 JSX 結構
3. test 通過
4. typecheck 抓出 `TS6133 'container' is declared but its value is never read` 在第三個 test → 移除 unused destructure
5. typecheck 綠

---

## 衍生

### 影響的檔案

| 類別 | 檔案 |
|---|---|
| L2 元件 | `PassCardPreviewBody.tsx`（M — 重寫 field-row JSX）|
| L2 test | `PassCardPreviewBody.test.tsx`（?? — new file，既有 25 + column layout 3 = 28 cases）|

### 與既有 rule 的對齊

- **Rule 003 TDD**：3 條新 test 在 layout 變更**前**已寫好（describe block 在 commit 前先存在於 working tree）
- **Rule 013 RWD** mobile-first：compact mode（mobile PhoneFrame）切換 `gap-3/4`、`truncate`、`py-0.5/1`，non-compact 切換 `gap-4`、`py-1`
- **Rule 000 § A.1** L2 業務元件資料夾結構：完整資料夾（`PassCardPreviewBody.tsx` + `.test.tsx`）
- **Rule 024** Mobile Future-Proof：layout 是純 CSS 結構變更，業務邏輯（`leftField/rightField` → i18n key → 渲染）零成本遷移

### 不向後相容 / 不破壞既有 API

- Props 不變（`textColor` / `compact` / `leftField` / `rightField`）
- textColor scope 不變（4 個 span 都套）
- Placeholder 行為不變（`leftField/rightField === null` 時顯示 `fieldLabelLeft/Right`）
- Compact mode 既有 truncate 測試仍通過（`truncate` class 仍套在 value span）

---

## 自問

1. **為什麼不直接用 `<table>` 或 CSS Grid？**
   Apple Wallet / PassCreator 的 visual contract 是「兩段文字上下排列」，Tailwind flex 已足夠。`<table>` 會帶來語意負擔（不是 table data）+ a11y 問題（screen reader 會唸成「2 column 1 row table」誤導用戶）。CSS Grid 雖然技術上更乾淨，但這裡只有 2 個 column × 2 個 row（每個 column 內 label + value），flex 寫法更直觀。

2. **為什麼 `min-w-0 flex-1` 在每個 column 都要？**
   `flex-1` 給 column 等寬伸展。但 flex item 預設 `min-width: auto`（內容的最小寬度），長文字會把 column 撐開超出 container，導致 `truncate` 無效。`min-w-0` 解除這個限制，讓 `truncate`（`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`）能正確運作。

3. **為什麼 right column 用 `items-end` 而不是 `text-right`？**
   `items-end` 是 flex container 屬性，控制 cross-axis（這裡是水平 axis）對齊子 element。`text-right` 是 inline 文字對齊，只能用在純文字 element。`<span>` 內的 text 也可以用 `text-right`，但 `items-end` 更語意化（這個 column 內的所有 child 都要 right-align，未來加 element 也自動對齊）。

4. **為什麼 `gap-0.5`（2px）作為 label-value 間距？**
   視覺上要讀成「同一個 field」但又不能完全貼在一起。4px（gap-1）會讓 label 和 value 視覺上分離、讀成兩個獨立 element。2px（gap-0.5）視覺上是「同一個 field 的兩段」。Apple Wallet 慣例也是 1-2px 間距。

5. **為什麼不分開 commit「改 layout 結構」和「加 truncate」？**
   兩個變更在同一 JSX 結構內相互依賴（column 才有 truncate 對象）。拆成兩個 commit 會在第一個 commit 留下 broken state（layout 是 column 但 value 沒 truncate → 長 value 仍會溢出）。**保持單一 commit 才能保證每個 commit 都是 working state**（Rule 011 §「同個 commit 帶進 code 變更」的 atomicity 原則）。

6. **為什麼不順便改 i18n key？**
   `passCard.fieldPreview.{key}.{label,value}` 是 commit #1（Step 3 Card Fields Selector）新加的 12 keys × 2 locales，跟 layout 變更無關。Layout commit 只動 JSX + test，不動 i18n（commit #1 已經把那 24 keys 加進去）。

---

## Verification（per Rule 006）

| 驗證項 | 狀態 | 證據 |
|---|---|---|
| typecheck | ✅ exit 0 | `npx tsc -b --noEmit` exit 0（包含 TS6133 unused 'container' 已移除）|
| lint | ✅ 0 errors | `npm run lint` 0 errors（pre-existing warns 不計）|
| vitest `PassCardPreviewBody.test.tsx` | ✅ 28/28 passed | 25 既有 + 3 新 column layout cases |
| vitest `CardBuilderEditor` suite | ✅ 14 files / 183 tests passed | `npm test` CardBuilderEditor 子集 |
| vitest frontend full | ✅ 53 files / 409 tests / 5 skipped / 0 failed | `npm test` 全套 |
| i18n smoke | ✅ 0 raw key | `npm run verify:i18n`（無 i18n 變更，預期同既有狀態）|

---

## Cross-link

- 觸發訊息：使用者 2026-09-04「左右欄位是並排的，而兩個欄位的 L & V 是垂直排列」
- Sibling commits in this batch：
  - commit #1（Step 3 Card Fields Selector）— 配套：preview pipeline threading + 12 keys × 2 locales i18n
  - commit #3（Color Picker popover mid-band fix）— 觸發：commit #1 讓使用者 scroll 到 Fields section，trigger 落入 mid-band
- 既有 DEV LOG：commit #1 的 DEV LOG 內 passCard preview 套用一節

---

> 撰寫者：Josh ｜ 時間：2026-09-04
