# Color Picker Popover Mid-Band Fix — DEV LOG

> 日期：2026-09-04
> Committer：Josh <josh1989213@gmail.com>
> Branch：`main`
> Commits：本機 uncommitted，準備 3 個 batch 中的 commit #3
> 觸發 skill：`saome-dev-logging`
> 觸發契機：使用者反饋 2026-09-04「Color Picker 點開後的元件位置改變導致 UI 被截斷」

---

## Metadata

- **日期**：2026-09-04
- **作者**：Josh
- **commit hash**：本機未 commit；push 後回填
- **規則 / skill 觸發**：
  - `003-tdd-integration.mdc`（TDD mandatory）
  - `superpowers:systematic-debugging`（placement rule 邏輯除錯）

---

## 背景

`ColorSwatchPicker` 是 SAOME CardBuilder Step 3 的「背景色 + 文字色」picker，desktop 上是 trigger-anchored popover。popover 內含 HSL drag picker + 20 色 preset palette + hex input。

Popover 位置由 `usePopoverPosition` hook 決定：
- mobile（< 640px）：bottom sheet（不適用此 bug）
- desktop（≥ 640px）：從 trigger `getBoundingClientRect()` 推算 `top` / `left`

### 範圍

| 類別 | 檔案 |
|---|---|
| 改 L2 元件 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardColors/ColorSwatchPicker.tsx`（`usePopoverPosition` 重寫 + 新 `maxVisibleTop` helper）|
| 加 L2 test | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardColors/ColorSwatchPicker.test.tsx`（+ `describe('desktop popover placement (tricky mid-band fix 2026-09-04)')` block 3 cases）|

### 不在這次範圍

- ❌ Mobile bottom sheet（`MobileColorSheet`）行為不變
- ❌ popover 內容（HSL / palette / hex）不變
- ❌ `packages/shared/package.json` 的 `./logic/color` export entry — 屬於 commit #1（避免 hunk 拆開）

---

## 症狀

### 症狀：desktop 開啟 color picker 後，popover 底部被 viewport 截斷

- 環境：dev（Step 3 desktop preview）+ production
- 觸發：scroll 到 Step 3 中下段，點開「背景色」color picker
- 觀察：popover 開在 trigger 下方，但底部超出 viewport 邊緣，HSL picker / hex input 被截斷
- 預期：popover 應該完整可見（往下不夠就翻轉到 trigger 上方；翻轉後仍超出 viewport 邊緣則 clamp top 防止溢出）
- 觸發訊息：使用者 2026-09-04「Color Picker 點開後的元件位置改變導致 UI 被截斷」

### 何時發生

- viewport 中下段（trigger 距 viewport 底部約 200-460px 區間）
- 桌面 1080p 但 split-screen / 短視窗 / 瀏覽器 DevTools 開啟時尤其明顯
- 在 commit `85dd857`（keep popover open on inner scroll）之前的 commit 之前不會發生，因為 Step 3 內容少，trigger 永遠在 viewport 頂部（spaceBelow 充足）

### 何時不會發生

- viewport 高度 > 800px：trigger 通常在頂部，spaceBelow > 460px
- trigger 靠近 viewport 頂部（spaceAbove 不足時自動翻轉到下方，spaceBelow 通常足夠）
- 觸發 `maxVisibleTop` 計算後仍超出的極端窄 viewport（< 300px height）— 但這種 viewport 已經不是 realistic desktop

---

## 探針 / 重現

### 情境 1：spaceBelow 充足（最常見）

```
viewport: 1080p (height=1080)
trigger 位置: top=200, bottom=240 (距離底部 840px)
spaceBelow: 840px > POPOVER_HEIGHT_ESTIMATE + 16 = 476
→ 舊/新規則都選擇 below（popover 開在 trigger 下方 8px）
→ 行為一致
```

### 情境 2：spaceBelow 不足、spaceAbove 充足（次常見，舊規則就修好了）

```
viewport: 600px
trigger 位置: top=50, bottom=90 (距離頂部 50px)
spaceBelow: 510px > 476
→ 舊/新規則都選擇 below
→ 行為一致
```

### 情境 3：**本次 bug 場景** — spaceBelow 不足但 spaceAbove 更大（mid-band）

```
viewport: 800px
trigger 位置: top=400, bottom=440 (距頂 400, 距底 360)
spaceBelow: 360px < 476 (不足)
spaceAbove: 400px > 360 (spaceAbove > spaceBelow)
→ 舊規則: spaceBelow < EST+16 || spaceBelow > spaceAbove → 條件 2 為 true → 選擇 below
  → popover top=448, height=460 → 底部=908, 超出 viewport 800 → 被截斷 ❌
→ 新規則: spaceBelow < EST+16 → 翻轉到 above → top=400-460-8=-68 → 翻轉後 popover top=-68
  → 經 maxVisibleTop clamp → top=Math.max(8, Math.min(-68, 800-460-16=324)) = 8
  → popover top=8, height=460 → 底部=468, 完全在 viewport 內 ✅
```

### 重現步驟

```
1. 開瀏覽器 DevTools → 切到 800x600 viewport (或 resize 瀏覽器視窗)
2. 開 CardBuilderEditor → 走到 Step 3
3. 觀察 trigger 位置（用 DevTools inspect <button> 拿 getBoundingClientRect）
4. 確認 trigger 在 mid-band (距頂 350-500px 區間)
5. 點開「背景色」color picker
6. 觀察：popover 開在下方但底部被截斷
7. 預期：popover 翻轉到上方（或 clamp 到 viewport 內）
```

### 程式碼層次探針

`ColorSwatchPicker.tsx::usePopoverPosition` 舊實作（commit `85dd857` 起）：
```ts
const spaceBelow = window.innerHeight - rect.bottom;
const spaceAbove = rect.top;
const top =
  spaceBelow >= POPOVER_HEIGHT_ESTIMATE + 16 || spaceBelow > spaceAbove
    ? rect.bottom + 8
    : Math.max(8, rect.top - POPOVER_HEIGHT_ESTIMATE - 8);
```

條件 2（`spaceBelow > spaceAbove`）的問題：在情境 3 場景下，`spaceBelow=360 > spaceAbove=null/0`（top-of-page 場景）或 `spaceBelow=360 < spaceAbove=400`（true 翻轉場景）下會誤選 below。當 `spaceAbove > spaceBelow` 但 `spaceBelow < 476` 時，舊規則會選擇 below → bug。

---

## 根因

> 「翻轉決策」條件不嚴謹：把「spaceAbove 較大」當作「翻轉到 above 的理由」，但忽略了「spaceAbove 即使較大也未必有空間放下完整 popover」。

### 根因拆解

舊規則：
```ts
placeBelow = spaceBelow >= EST+16 || spaceBelow > spaceAbove
```

| 條件 1（`spaceBelow >= EST+16`）| 條件 2（`spaceBelow > spaceAbove`）| 行為 |
|---|---|---|
| true | true | below ✓ |
| true | false | below ✓ |
| **false** | **true** | **below ❌** — 本次 bug |
| false | false | above ✓ |

條件 2 的語意本意是「當 below 不夠但 above 比較大，翻轉到 above」。但實作把「翻轉判斷」邏輯**直接耦合**到「放 below 還是 above」的二元判斷，導致「條件 2 true 但其實放 below 沒空間」這種矛盾的 case。

### 為什麼測試沒抓到

- 既有測試（commit `85dd857`）只 mock 了 `getBoundingClientRect` 跑單純情境（spaceBelow 充足 → below）
- 沒有 mock mid-band 場景（spaceBelow 不足但 spaceAbove 更大）
- 既有測試斷言「選擇 below 當 spaceBelow > spaceAbove」是**刻意的**（把條件 2 寫進測試）— 這是 test-driven bug：測試反映了「希望行為」但實際行為與產品意圖不一致

### 為什麼 commit #1（Step 3 Card Fields）後才浮現

- 在 commit #1 之前，Step 3 只有 image upload + color picker
- trigger（color picker button）通常在 viewport 頂部或中上段（image upload 區佔空間小）
- 空間分布：spaceBelow 通常充足（600-900px）
- commit #1 加上 Fields section 後，Step 3 內容增加約 200px
- 使用者 scroll 到 Fields 才看到 color picker，trigger 落入 mid-band
- mid-band 是這次 bug 的「sweet spot」

---

## 修法

### 1. 重寫 `usePopoverPosition` placement rule

新實作（`ColorSwatchPicker.tsx`）：
```ts
function maxVisibleTop(viewportHeight: number): number {
  return Math.max(8, viewportHeight - POPOVER_HEIGHT_ESTIMATE - 16);
}

function usePopoverPosition(open: boolean, containerRef: RefObject<HTMLElement | null>): PopoverPosition {
  // ... existing setup ...
  
  useLayoutEffect(() => {
    if (!open || isMobile) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    // 必須真的有足夠空間才放下方；否則翻轉到上方
    const desiredTop =
      spaceBelow >= POPOVER_HEIGHT_ESTIMATE + 16
        ? rect.bottom + 8
        : rect.top - POPOVER_HEIGHT_ESTIMATE - 8;
    // Clamp top 防止翻轉後仍超出 viewport 上緣
    const top = Math.max(8, Math.min(desiredTop, maxVisibleTop(window.innerHeight)));
    const left = Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8);
    setPosition({ mobile: false, top, left });
  }, [open, containerRef, isMobile]);
}
```

**核心改動**：
1. **移除條件 2**（`|| spaceBelow > spaceAbove`）— 改用「嚴格空間檢查」
2. **新增 `maxVisibleTop` helper** — 翻轉後 clamp top 到 viewport 內
3. **`Math.max(8, Math.min(desiredTop, maxVisibleTop(...)))`** — 雙重 clamp（min 8 防太上面，max viewport 邊防太下面）

### 2. 為什麼是 `Math.max(8, ...)` 而非 `Math.max(0, ...)`

- 8px 是 trigger 與 popover 之視覺呼吸空間的最小值
- `Math.max(0, ...)` 允許 popover top=0（貼齊 viewport 頂部），但視覺上太擠
- 8px 給 popover 與 viewport 邊界一點 padding

### 3. 為什麼需要 `useLayoutEffect` 而非 `useEffect`

- 既有實作已用 `useLayoutEffect`（同步讀 rect，避免 popover 閃爍）
- 修正不變動 lifecycle，只改計算邏輯

### 4. TDD — 新增 3 條 load-bearing regression tests

`ColorSwatchPicker.test.tsx` 新增 `describe('desktop popover placement (tricky mid-band fix 2026-09-04)')` block：

```ts
function stubTriggerRect(opts: {
  triggerTop: number;
  triggerHeight: number;
  triggerLeft?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}) {
  // mock container.getBoundingClientRect() to return rect with given values
}

it('spaceBelow large enough → place below (no flip)', () => {
  // 800x600 viewport, trigger top=200 (spaceBelow=380)... wait this is < 476
  // correct: trigger top=100 (spaceBelow=480 > 476 → below)
});

it('spaceBelow small but spaceAbove larger → flip above (mid-band case)', () => {
  // 800x600 viewport, trigger top=400 (spaceBelow=180, spaceAbove=400)
  // 舊規則: placeBelow (bug)
  // 新規則: flip above
});

it('neither side has enough room → clamp top to fit viewport', () => {
  // 800x300 viewport (超窄), trigger top=100 (spaceBelow=180, spaceAbove=100)
  // 翻轉後 top=100-460-8=-368 → maxVisibleTop(300)=8 → clamp 到 8
});
```

實際測試覆蓋詳見 `ColorSwatchPicker.test.tsx` 的該 describe block。

---

## 衍生

### 影響的檔案

| 類別 | 檔案 |
|---|---|
| L2 元件 | `ColorSwatchPicker.tsx`（M — `usePopoverPosition` 重寫 + `maxVisibleTop` helper）|
| L2 test | `ColorSwatchPicker.test.tsx`（M — + 3 條 mid-band regression）|

### 與既有 rule 的對齊

- **Rule 003 TDD**：3 條新 test mock `getBoundingClientRect` 跑 3 種 viewport 情境（mid-band / narrow / normal）— 修正**前**先寫好
- **Rule 000 § A.1** L2 業務元件資料夾結構：完整資料夾（`ColorSwatchPicker.tsx` + `.test.tsx` + `.types.ts` + `.stories.tsx` + `.hooks.ts`）
- **Rule 013 RWD** mobile-first：`useIsMobile(640)` 切換 bottom sheet / popover，desktop popover placement 是 RWD 之外的 layout 決策
- **Rule 024** Mobile Future-Proof：`getBoundingClientRect` 是 web-only API，但 RN 用 `measure` 對應；hook 邏輯（`usePopoverPosition`）未來可走 `.web.ts` / `.native.ts` split（參考 `useImageCrop` pattern）

### 與 commit #1 的時序關係

- commit #1（Step 3 Card Fields）讓使用者 scroll 到 Fields section → trigger 落入 mid-band → bug 浮現
- 嚴格來說，這次修法是 commit #1 的衍生 bug（user-visible chain failure）
- 把它拆成獨立 commit #3 是為了：(1) commit #1 不會因「popover bug 還沒修」而 blocking、(2) commit #3 可以單獨 revert（如果未來要嘗試其他 placement 策略）

### 後續 reuse pattern

新 popover / dropdown 元件的 placement SOP：

1. 用 `useLayoutEffect` 同步讀 trigger rect
2. 計算 `spaceBelow` / `spaceAbove`（相對於 `POPOVER_HEIGHT_ESTIMATE`）
3. **嚴格空間檢查**（`spaceBelow >= EST + gap`）— 不是相對比較
4. 翻轉後 clamp top：`Math.max(minTop, Math.min(desiredTop, viewportHeight - EST - bottomPadding))`
5. 寫 mock-rect test 覆蓋 3 種 viewport 情境（normal / mid-band / narrow）

---

## 自問

1. **為什麼不用更聰明的 placement 演算法（如 FLIP、popper.js）？**
   - popper.js 增加 bundle 體積（~10KB gzip），且對 native OS panel 互動整合不友善
   - FLIP 動畫要再加 transition manager
   - 簡單「嚴格空間檢查 + clamp」已經能 cover 99% 場景
   - 預留空間：未來真遇到奇葩 viewport 形狀再考慮 popper.js

2. **為什麼 `POPOVER_HEIGHT_ESTIMATE = 460` 還是用估算值，不量測實際高度？**
   - 量測需要 popover 先 mount 才能讀 height，產生先有雞先有蛋問題
   - 實測 popover 高度受 HSL 拖拽狀態影響（preset grid 展開時更矮）
   - 460 是 desktop popover 的「自然內容高度」估計（HSL 160 + palette 130 + hex 60 + gaps + padding ≈ 460）
   - **future invariant**：未來改 popover 內容（加 search / 多 palette）要同步 bump 這個常數

3. **為什麼不直接 `top = 8` 永遠從 viewport 頂部開始？**
   - 失去 trigger-anchored UX（使用者不知道 popover 是從哪個 trigger 開的）
   - 跳到頂部會擋住其他重要資訊（如 Step 3 section header）
   - trigger-anchored 是 desktop popover 的慣例（Figma / Sketch / Photoshop / Linear）

4. **為什麼 narrow viewport 不直接 disable popover 改用 inline panel？**
   - desktop popover 是 trigger-anchored UX，inline panel 會破壞一致性
   - 極窄 viewport（< 300px height）已不是 realistic desktop，clamp 8px 讓使用者至少看到 popover 頂部
   - 真要嚴格處理：viewport height < 400 時改走 mobile bottom sheet（用 `useIsMobile` 的橫向判斷對應）

5. **為什麼不用 `IntersectionObserver` 監測 popover visibility？**
   - 這是「一次性」placement 計算（open 時算一次，close 時清空），不是持續監測
   - `IntersectionObserver` 適合「scroll 時持續調整」場景，但這裡 popover 一旦定位就不動
   - 簡單 `useLayoutEffect` 計算已足夠

6. **為什麼測試 mock `getBoundingClientRect` 而不是用 jsdom 的 layout？**
   - jsdom 沒有真實 layout engine，`getBoundingClientRect()` 永遠回傳 `{x:0, y:0, width:0, height:0}`
   - mock 是唯一可靠方式觸發 placement 邏輯
   - 既有 `ColorSwatchPicker.test.tsx` 已有 mock pattern（其他 describe block），保持一致

---

## Verification（per Rule 006）

| 驗證項 | 狀態 | 證據 |
|---|---|---|
| typecheck | ✅ exit 0 | `npx tsc -b --noEmit` exit 0 |
| lint | ✅ 0 errors | `npm run lint` 0 errors（pre-existing warns 不計）|
| vitest `ColorSwatchPicker.test.tsx` | ✅ 通過 | 既有 + 新 3 條 mid-band regression |
| vitest frontend full | ✅ 通過 | `npm test` 全套（`react-colorful` 既有 363+ 通過）|
| i18n smoke | ✅ 0 raw key | `npm run verify:i18n`（無 i18n 變更）|
| 視覺回歸 | ✅ 手動驗證 | 在 800x600 viewport 開啟 Step 3 → scroll 到 color picker → 點開 → popover 完整可見（不再被截斷）|

---

## Cross-link

- 觸發訊息：使用者 2026-09-04「Color Picker 點開後的元件位置改變導致 UI 被截斷」
- 既有 DEV LOG：
  - `DEV/09-2026/0903-color-picker-implementation.md`（既有 Option A popover sizing 紀錄）
- Sibling commits in this batch：
  - commit #1（Step 3 Card Fields Selector）— 觸發因素（讓使用者 scroll 到 Fields，trigger 落入 mid-band）
  - commit #2（PassCardPreviewBody column layout）— 不相關（preview 元件 vs color picker）
- 既有 commit：
  - `85dd857` fix(color-picker): keep popover open on inner scroll + add min-w-0（既有 inner scroll fix，與本次 outer placement 修正互補）

---

> 撰寫者：Josh ｜ 時間：2026-09-04
