# Color Picker Popover Sizing — Option A 「popover 跟內容高度走」vs Option B 「outer 限制 + inner scroll」

> 日期：2026-09-03
> 來源 commit：`85dd857` fix(color-picker): keep popover open on inner scroll + add min-w-0 — 本次 working tree 再加 Option A 重構
> 修法位置：`apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardColors/ColorSwatchPicker.tsx` L282–300
> 對齊 rule：（待辦 — 需在 Rule 013 RWD 或新開 Rule 029 Form Controls 補「Popover Sizing」章節）

## 背景

Color picker 的 desktop popover 在 Round 1 完成後（commit `85dd857`）有兩個 residual 問題：

1. **永遠有一條 vertical scrollbar**：即使內容（HSL picker + 20-swatch palette + hex input）只佔 ~460px，但 popover 因為 outer 有 `max-height: calc(100vh - 32px)` + inner 是 `flex-1 overflow-y-auto`，被撐成 ~700px（典型 1080p viewport）。多出 ~240px 空白被 `overflow-y-auto` 當 overflow 顯示 scrollbar。
2. **Horizontal scrollbar「外洩」**：內層容器（HSL 240px + hex row 220px）總寬 240+220+12 = 472px，但 outer 是 `width: 280`。內層的 implicit `min-width: auto` 等於 intrinsic content min-width，所以 inner 不能 shrink 到 268px（280 - 12 padding）。結果 inner overflow → 透過 outer `overflow-hidden` clip 是 OK，但 `overflow-y-auto` 行為在 flex 內失效，X scrollbar 偶爾閃。

User feedback 截錄：「Color picker popover 不跟內容高度走，可以上下滑動」。

## 根因

`flex-1` + fixed `max-height` 組合的陷阱：

```tsx
// Outer
style={{ maxHeight: 'calc(100vh - 32px)' }}
className="flex flex-col overflow-hidden"

// Inner
className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden flex-col gap-3"
```

**`flex-1` claim 的空間**：

- 在 flex 內，`flex-1` 是 `flex: 1 1 0%` 的 shorthand
- 它 claim main-axis 空間從 `0` 直到「outer 允許的最大空間」（flex container 的剩餘空間 — 不是內容空間）
- 加上 outer 有 `max-height: calc(100vh - 32px)` ≈ 1048px（1080p），inner 被 claim 到 ~1030px
- 內容只有 ~460px → 多出 ~570px 是「empty flex space」
- `overflow-y-auto` 對 empty flex space 也算 overflow → 顯示 scrollbar

**`min-width: auto` 的 implicit 行為**：

- flex child 預設 `min-width: auto` = 其內容的 intrinsic min-width
- 240px HSL picker + 220px hex row + 12px gap = 472px > outer 280px
- 內層容器不能 shrink 到比 472px 還小，所以 overflow X
- outer `overflow-hidden` clip 是 OK，但 horizontal scrollbar 偶爾還是在 inner 邊緣閃一下

## 候選方案

### Option A（採用）— popover 跟內容高度走

```tsx
// Outer — NO maxHeight, NO overflow-hidden
className="z-[9999] flex flex-col rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-lifted)]"

// Inner — plain flex column, no flex-1 / min-h-0 / overflow
className="flex min-w-0 flex-col gap-3"
```

**優點**：
- Popover 高 = 內容自然高 ≈ 460px，沒有 scrollbar
- Shadow 不被 `overflow-hidden` clip
- 沒有 X scrollbar 外洩風險（內層是 plain flex，沒 overflow）
- Figma / Sketch / Photoshop 慣例一致（popover = content height）

**取捨**：
- viewports < 460px 高時 popover 會凸出去 — 實務上 desktop viewport ≥ 700px，mobile 走 bottom sheet 不受影響
- 極短桌面窗口（< 460px 高，例如某些 split-screen 模式）需要 fallback（目前不做，標記為未來 enhancement）

### Option B（不採用）— outer 限制 + inner scroll，但內容 height 計算精確

```tsx
// Outer — maxHeight 設剛好 = 內容 height + 安全 margin
style={{ maxHeight: 480 }}
className="... overflow-hidden"

// Inner — 仍需要 flex-1 + overflow-y-auto 才能在短 viewport 內 scroll
className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden flex-col gap-3"
```

**為什麼不採用**：
- 「內容 height + margin」是 fragile magic number，內容變動要同步更新
- 內層仍是 `flex-1`，仍會 claim outer 的全部空間，仍會有 scrollbar bug
- 想消除 scrollbar 必須把 maxHeight 設到 < 內容 height，但這樣內容被 clip
- 不能從根本上修：flex-1 + maxHeight 組合永遠會撐滿 outer

### Option C（未來考慮）— 用 floating-ui library

```tsx
import { FloatingPortal, useFloating, useClick, useDismiss, ... } from '@floating-ui/react';

const { refs, floatingStyles, context } = useFloating({
  open,
  onOpenChange: setOpen,
  middleware: [offset(8), flip(), shift({ padding: 8 }), size({ ... })],
});
```

**優點**：
- Library 處理所有 edge case（positioning + sizing + dismiss + ARIA）
- 不需要自己寫 `usePopoverPosition` / `useClickOutside` / `useEscapeKey`

**為什麼這次不採用**：
- 新增依賴（@floating-ui/react ~12KB gzipped）
- 既有 `useClickOutside` / `useEscapeKey` / `usePopoverPosition` 都已實作且 tested
- 改用 floating-ui 是 P3 migration，下一季度再考慮

## 修法

### 1. Outer popover 移除 maxHeight + overflow-hidden

```tsx
// 之前
style={{ maxHeight: 'calc(100vh - 32px)' }}
className="z-[9999] flex flex-col overflow-hidden rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-lifted)]"

// 之後
// style: 只保留 top/left/width from usePopoverPosition
className="z-[9999] flex flex-col rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-lifted)]"
```

`POPOVER_HEIGHT_ESTIMATE = 420` → `460`（跟實際內容同步）

### 2. Inner 移除 flex-1 + min-h-0 + overflow-y-auto + overflow-x-hidden

```tsx
// 之前
className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden flex-col gap-3"

// 之後
className="flex min-w-0 flex-col gap-3"
```

`min-w-0` 仍保留 — 沒有它的話 implicit `min-width: auto` 會讓 HSL picker 240px 把 inner 撐到 ≥ 240px（雖然現在 outer = content height 沒 X overflow，但 defensive 仍要）。

### 3. Mobile sheet 不變（仍用 flex-1 + min-h-0 + overflow-y-auto）

`MobileColorSheet` 是另一個 layout（bottom sheet with fixed maxHeight = 85vh）。`flex-1 + min-h-0 + overflow-y-auto` 在這裡是**對的**：

- 內容可能 > 85vh（短 mobile viewport）
- Sheet 高度固定，需要 inner scroll
- 沒有 Option A / B 的兩難，因為 sheet 高度本來就該 > 內容（用戶期待 sheet 高度有 padding + bottom safe area）

### 4. 測試覆蓋更新（4 個 describe 區塊重寫）

```ts
describe('ColorSwatchPicker — desktop popover sizing (Option A: follow content height)', () => {
  it('outer popover has no overflow-hidden — shadow renders unclipped, content not clipped by container');
  it('inner content area is NOT a scroll container — no flex-1 / no min-h-0 / no overflow-y-auto (Option A)');
  it('outer popover has NO maxHeight — sizes to natural content height (Option A)');
  it('desktop popover contents are all reachable without scroll — HSL + palette + hex all rendered');
  it('desktop popover keeps trigger-anchored fixed positioning (regression guard)');
  it('inner flex sections have min-w-0 so implicit min-width: auto cannot push them past the popover width (no X scrollbar leak)');
});
```

加上 Round 1 commit `85dd857` 的「scroll listener 不關 inner scroll」測試（防 regression），共 11 個 Option A 專屬 test。

## 學習

### 1. `flex-1 + maxHeight` 是 popover sizing 的陷阱

正確的 popover sizing 模式是二選一：

| 模式 | Outer | Inner | 適用場景 |
|---|---|---|---|
| **Follow content**（Option A，採用）| no maxHeight | plain flex | 內容固定 ≤ viewport，desktop color / emoji picker |
| **Capped + scroll**（Option B）| fixed maxHeight ≤ viewport | flex-1 + overflow-y-auto | 內容可能 > viewport，menu / tree / virtual list |

不要混用「outer 有 maxHeight + inner 是 flex-1 overflow-y-auto + 內容短」— 那個組合會**永遠**有 scrollbar bug。

### 2. Popover 高度的「magic number 沉澱」

`POPOVER_HEIGHT_ESTIMATE = 460` 是 desktop popover 的內容自然高度估算。用途是 `usePopoverPosition` 判斷「要不要 flip-above trigger」。

如果未來內容變動（如加 preset search bar），這個常數要同步 bump。**未來 invariant**：在 commit hook 自動量測 popover 高度（用 Playwright probe 或 `getBoundingClientRect`），cross-check 這個常數。但目前 8 個 section × ~60px = 460 是 stable 的，不做過度工程。

### 3. `min-w-0` 在 flex 內**永遠**要加

無論 Option A 還是 Option B，只要 flex container 內有「不能 shrink 到 0」的內容（HSL picker 的 SVG、text input 的 min-content），就要 `min-w-0`。這不是 Option A 的特性，是 universal flex 紀律。

教訓已沉澱到 Round 1 commit `85dd857` 的 commit message 註解 + Rule 013 RWD 待補。

### 4. Mobile bottom sheet 是另一個 layout，不混用

**Option A**（follow content）跟 mobile bottom sheet（capped + scroll）兩種 sizing 模式**不通用**：

| Layout | Sizing | 為什麼 |
|---|---|---|
| Desktop popover | Option A（follow content）| 內容固定短、trigger-anchored、shadow 必須 visible |
| Mobile bottom sheet | Capped + scroll（85vh）| 內容可能 > 85vh short mobile、必須有 safe area padding |

`MobileColorSheet` 跟 `DesktopPopover` 各自獨立寫，不要試圖共用同一個 inner container className。

## Rule update（待辦）

需要在某個 rule 補「Popover Sizing Pattern」章節，建議位置：

- 選 A：`Rule 013 RWD` § Popover/Drawer 補 sub-section
- 選 B：新開 `Rule 029 Form Controls` § Popover Sizing

內容：

```
Option A vs Option B 表（上方 table）
`flex-1 + maxHeight` 陷阱
`min-w-0` universal 紀律
Mobile bottom sheet 獨立 layout
```

本 PR commit 沒改 rule（純 code 變更）。下次 L3 重構（如 TagPicker 或 DatePicker popover）時順手補 rule。

## Cross-link

- Master DEV LOG：Round 4「Option A Popover Sizing 決策」— `DEV/09-2026/0903-color-picker-implementation.md`
- Round 1 commit：`85dd857` fix(color-picker): keep popover open on inner scroll + min-w-0（Round 1 修「inner scroll 關 popover」bug）
- Sibling popover sizing：未來 Color Picker v2（如 TagPicker / DatePicker）共用同個 pattern
- LogoUploader Stage Height Invariant（Rule 028 § 12）：同樣是「magic number 沉澱成 invariant」的案例（`baseContainerH = max(aspectMatchedH, maskH + 2*FRAME_PADDING)`）
