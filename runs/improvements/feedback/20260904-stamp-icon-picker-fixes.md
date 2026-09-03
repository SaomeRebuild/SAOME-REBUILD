# StampIconPicker + Strip 預覽 — 5 個 UX Bug 修正

> Date: 2026-09-04
> Session: stamp grid feature follow-up UX fix (Round 2)
> Scope: `Step3StampGrid/StampIconPicker`、`Step3StampGrid/StampGridCountSelector`、`index.css` (popover token)、`CardPreview/PassCardPreviewStrip`

## 背景

Stamp grid feature 上線後（commit `8d0e5b9`，加上 Round 1 `3714b5b` 修 trigger visual fallback），使用者實機測試時回報 5 個新 UX bug，集中在 Step 3 集點印章區塊：

| # | DOM 現象 | 根因摘要 |
|---|---|---|
| 1 | trigger button 顯示「鈴鐺」誤導使用者以為已選 | label 用 visual fallback icon 名稱 |
| 2 | popover 沒背景色 | `--color-popover` token 沒定義 |
| 3 | popover 內「印章預覽」+ `<StampGridPreview>` 區塊多餘 | 早版本留下的 dead code |
| 4 | StampGridCountSelector 4 顆按鈕沒按壓感 | 只有 active 有 bg，hover 沒反饋 |
| 5 | Strip 在 stampIconId 空時不顯示 grid | `showStampGrid` gate 含 `Boolean(stampIconId)` |

## 5 個 Bug 逐項根因 + 修法

### Bug 1 — Trigger label 顯示 fallback icon 名稱誤導使用者

**症狀**：trigger button 在 `stampIconId === ''` 時顯示「鈴鐺」(STAMP_ICONS[0] 的 i18n 名稱)，使用者以為 stamp 已選定，結果點了其它選項卻「選不到」（因為 store 本來就是空字串）。

**根因**：`StampIconPicker.tsx` Round 1 修法：

```tsx
// ❌ Round 1 (commit 3714b5b)：visual 跟 label 共用 currentIcon
const fallbackIcon = STAMP_ICONS[0];
const currentIcon = stampIconId ? (getStampIcon(stampIconId) ?? fallbackIcon) : fallbackIcon;
const labelIconId = currentIcon?.id ?? '';
const currentLabel = labelIconId
  ? t(`step3.stampSection.icons.${labelIconId}`, { defaultValue: labelIconId })
  : t('step3.stampSection.iconPicker.trigger');
```

`currentIcon` 永遠 fallback 到 STAMP_ICONS[0]，導致 `labelIconId = 'bell'`，label 變成「鈴鐺」。Visual fallback 是設計好的（讓使用者看到「一個印章」），但 label 是語意提示，**不該**跟著 visual fallback 走。

**修法**：「Visual default ≠ functional default」原則延伸 — label 跟 store 狀態綁定，visual 跟 fallback 綁定：

```tsx
// ✅ Round 2：visual 跟 label 解耦
const fallbackIcon = STAMP_ICONS[0];
const currentIcon = stampIconId
  ? (getStampIcon(stampIconId) ?? fallbackIcon)
  : fallbackIcon;

// Label reflects STORE state, NOT the visual fallback
const hasCommittedIcon = stampIconId !== '' && getStampIcon(stampIconId) !== undefined;
const currentLabel = hasCommittedIcon
  ? t(`step3.stampSection.icons.${stampIconId}`, { defaultValue: stampIconId })
  : t('step3.stampSection.iconPicker.trigger');
```

32×32 `<img>` 仍然顯示 fallback icon（視覺提示），但 label 一律是「選擇印章」(空) / icon 名稱 (有值)。

### Bug 2 — Popover 沒背景色

**症狀**：popover dialog 顯示在頁面上但透明，內容浮在 Step 3 的 background 上無層次感。

**根因**：`apps/frontend/src/index.css` 沒定義 `--color-popover` token（只有 `--color-card` / `--color-muted` 等），但 Tailwind class `bg-popover` 對應 CSS var `var(--color-popover)` — undefined → fallback 到 transparent。

**修法**：加 token 到 `index.css` dark + light 兩個 mode block：

```css
:root,
[data-theme='dark'] {
  ...
  --color-card: #1B1B30;
  --color-card-foreground: #F8FAFC;
  /* Popover — slightly elevated above card so it reads as a floating surface.
     Mirrors --color-surface-raised for now since the design system doesn't
     yet distinguish popover from raised surfaces visually. */
  --color-popover: #252542;
  --color-popover-foreground: #F8FAFC;
  ...
}

[data-theme='light'] {
  ...
  --color-card: #FFFFFF;
  --color-card-foreground: #0F172A;
  /* Popover — matches --color-surface-raised in light mode for now. */
  --color-popover: #F8FAFC;
  --color-popover-foreground: #0F172A;
  ...
}
```

**為什麼新增 token 而非直接用 `bg-card`**：
- shadcn/Radix convention：popover 是比 card 更 elevated 的 surface
- `bg-popover` class 已經存在且本意對應 popover surface
- design-system MASTER.md § 1 已經列出「Color System」的 token 三層（primitive / semantic / component），加 popover 是語意層擴展

**Token 取值理由**：
- dark `#252542` 與 `--color-surface-raised` 相同 — dark mode 視覺差異在 popover 跟 card 都是輕微 elevation，未來 design 想要 popover 更突出時可直接改此 var
- light `#F8FAFC` 與 `--color-surface-raised` 相同 — 同理

### Bug 3 — Popover 內「印章預覽」+ `<StampGridPreview>` 多餘

**症狀**：popover 內除了 close btn + icon grid，還有一段 header title「印章預覽」+ 內嵌的 `<StampGridPreview>`（rows × 5 cols 預覽）。使用者反映「這個不需要存在」。

**根因**：Stamp grid feature 早期 commit 加的 live preview，讓使用者 hover icon 時能看到 grid 效果。但：
1. trigger button 的 visual fallback 已經讓使用者看到「一個印章」
2. popover 開啟時 icon grid 已經在右側，使用者可以直接看到所有 icon 長相
3. 預覽區塊浪費 2/3 popover 高度

**修法**：直接刪除整個 preview block：

```tsx
// ❌ Round 1 (commit 3714b5b)：
<div className="flex justify-center rounded-md border border-input bg-muted/40 p-3">
  <StampGridPreview iconId={previewIconId} rows={stampGridRows} stripHeight={PICKER_PREVIEW_STRIP_HEIGHT} />
</div>

// ✅ Round 2：整個區塊刪除，StampGridPreview import 也清掉
```

Header title `印章預覽` 一併刪（沒預覽就沒 title），header 只剩 X close 鈕（`justify-between` → `justify-end`）。

**為什麼完全刪而不是縮小**：
- 預覽無消費需求（plan feedback 已確認）
- 縮小只是 aesthetic 取捨，scope creep
- 直接刪讓 popover 高度從 ~280px 降到 ~160px，UI 更精簡

**Popover 寬度也順修**：
- Round 1: `width: min(100vw - 32px, 480px)`（容納 preview + 5 grid icons）
- Round 2: `width: min(100vw - 32px, 280px)`（只容納 close + 5 grid icons）
- POPOVER_WIDTH 常數對齊 hook 的 POPOVER_WIDTH

### Bug 4 — StampGridCountSelector 沒按壓感

**症狀**：4 顆 segmented buttons 只有 active state 有 `bg-primary`，inactive 沒背景；hover 只有文字色變化，click 完全沒反饋。

**根因**：原 className：

```tsx
className={
  'flex-1 rounded-sm px-2 py-1.5 text-sm transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  (isActive
    ? 'bg-primary text-primary-foreground shadow-sm'
    : 'text-muted-foreground hover:text-foreground')
}
```

只有 `transition-colors` + `hover:text-foreground`，沒 scale 沒 bg，inactive 視覺太平。

**修法**：對齊 design-system MASTER.md § 6 Motion tokens：

```tsx
className={
  'flex-1 rounded-sm px-2 py-1.5 text-sm ' +
  'transition-all duration-[var(--transition-fast)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'active:scale-[0.97] ' +
  (isActive
    ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
    : 'text-muted-foreground hover:bg-muted hover:text-foreground')
}
```

設計細節：
- `transition-all duration-[var(--transition-fast)]`（150ms ease-out）— 對齊 design-system § 6
- `active:scale-[0.97]` — 對齊 design-system § 6「Active: transform: scale(0.97)」
- inactive 加 `hover:bg-muted` — 提供明顯 hover 提示（bg-muted 是 surface-neutral，不干擾 active 視覺）
- active 用 `hover:bg-primary/90` — hover 比 resting 稍暗，hover 跟 active 視覺有差

### Bug 5 — Strip 在 stampIconId 為空時不顯示 grid

**症狀**：使用者進到 Step 3，cardType 已選 stamp_card，但 stampIconId 還沒選時，Strip 區域顯示 default hero（CreditCard icon + 名稱），不顯示 grid。

**根因**：`PassCardPreviewStrip.tsx::showStampGrid`：

```tsx
const showStampGrid =
  isStampCardType(cardType) && Boolean(stampIconId) && Boolean(stampGridRows);
```

`Boolean(stampIconId)` gate 確保沒選 icon 時不顯示 grid。這是 plan 階段的決定 — Strip 在「沒選 stamp icon」時應該繼續顯示 default hero（讓使用者知道「這是張卡片」）。

**處理決定**：保持現狀（依使用者選擇），但補 test 鎖定行為避免未來 wiring regression。

新增 `PassCardPreviewStrip.test.tsx`（5 cases）：
- stampIconId 空 → 無 StampGridPreview
- 三個條件都滿足 → 顯示 StampGridPreview
- multipass + icon + rows → 顯示（mirrors stamp_card）
- 非 stamp_card/multipass + icon + rows → 不顯示（gate 正確）
- strip-content container 永遠在（不論哪個 mode）

## 衍生修正 — Desktop popover 定位

實作 popover 移除預覽時順手發現 desktop popover 定位有 bug：

**症狀**：原 className：
```tsx
'fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 ... md:relative md:left-auto md:top-auto md:translate-x-0 md:translate-y-0'
```

mobile 用 `fixed top-1/2 left-1/2 translate` 置中（正確），但 desktop 用 `md:relative` 覆寫變成 inline 元素 — popover 跑到 trigger 父元素的 layout flow 裡，長頁面下 popover 可能被祖先 `overflow:hidden` 切掉或跑到 body 底部。

**修法**：跟 `ColorSwatchPicker` 對齊，使用 explicit `usePopoverPosition` hook + `position: fixed; top; left`：

新建 `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/StampIconPicker.hooks.ts`：

```ts
export function useStampPickerPopoverPosition(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
): PopoverPosition {
  const isMobile = useIsMobile();
  const [position, setPosition] = useState<PopoverPosition>(null);
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    if (isMobile) { setPosition({ mobile: true }); return; }
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const desiredTop =
      spaceBelow >= POPOVER_HEIGHT_ESTIMATE + 16
        ? rect.bottom + VIEWPORT_PADDING
        : Math.max(VIEWPORT_PADDING, rect.top - POPOVER_HEIGHT_ESTIMATE - VIEWPORT_PADDING);
    const maxTop = window.innerHeight - POPOVER_HEIGHT_ESTIMATE - VIEWPORT_PADDING;
    const top = Math.max(VIEWPORT_PADDING, Math.min(desiredTop, maxTop));
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, rect.left),
      window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING,
    );
    setPosition({ mobile: false, top, left });
  }, [open, containerRef, isMobile]);
  return position;
}
```

**為什麼不直接 import `ColorSwatchPicker.hooks::usePopoverPosition`**：
- 兩者 popover 高度不同（color picker ~460px / stamp picker ~160px），POPOVER_HEIGHT_ESTIMATE 不能共用
- shared hook 會引入 cross-folder coupling
- 第三個 caller 出現時再 hoist 成 shared `Step3*Picker.hooks.ts`（目前只有兩個 caller，不該 premature abstraction）

**Mobile 模式仍用 viewport-centered modal**（不是 bottom sheet）：
- 使用者截圖顯示 mobile viewport 中央 modal 已經可以工作，scope 守住
- ColorSwatchPicker 的 mobile bottom sheet 是 iOS-pattern 優化，但 stamp picker 內容簡單（無 HSL 等長 content），中央 modal 已足夠
- 後續若需改 bottom sheet，獨立 plan

## 改動清單

| 檔案 | 動作 |
|---|---|
| `apps/frontend/src/index.css` | 新增 `--color-popover` + `--color-popover-foreground`（dark + light）|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/StampIconPicker.tsx` | trigger label 跟 visual fallback 解耦；popover 移除 preview block；desktop 改 explicit positioning（mobile 維持 modal）；popover 寬度 480 → 280 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/StampIconPicker.hooks.ts` | 新檔 — `useStampPickerPopoverPosition` hook |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/StampGridCountSelector.tsx` | 按鈕加 hover bg + active scale（design-system § 6 Motion）|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/Step3StampGrid.test.tsx` | +3 test：trigger label ×2 + popover 移除 preview ×1 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewStrip.test.tsx` | 新檔 — strip grid gating 5 cases |
| `runs/improvements/INDEX.md` | 倒序加 entry |
| `runs/improvements/feedback/20260904-stamp-icon-picker-fixes.md` | 本檔 |

## 設計取捨整理

### Bug 1 trigger label — 為什麼改通用文案而不是改 visual fallback

| 選項 | 後果 | 決定 |
|---|---|---|
| A. 完全移除 visual fallback（回到灰底） | UIUX 退步，使用者看不到「印章長什麼樣」 | 拒 |
| B. **保留 visual fallback，label 改通用** | 使用者看到圖示 + 「選擇印章」提示未選；store 仍是空字串 | 採 |
| C. 兩者都改回第一個 icon 名稱 | 維持誤導，UX bug 重現 | 拒 |

「Visual default ≠ functional default」原則（Round 1 引入）延伸：visual 跟 fallback 綁定、label 跟 store 綁定。

### Bug 2 popover 背景色 — 為什麼加 token 而不是用既有的 bg-card

| 選項 | 後果 | 決定 |
|---|---|---|
| A. **新增 `--color-popover` token** | 對齊 shadcn/Radix convention（popover 是比 card 更 elevated 的 surface），design-system 可擴展 | 採 |
| B. 直接用 `bg-card` | 跳過 token 設計，popover 跟 card 同色，視覺上 popover 不「浮起」 | 拒 |

### Bug 3 移除預覽區塊 — 為什麼直接刪而不是縮小

| 選項 | 後果 | 決定 |
|---|---|---|
| A. **完全移除**（header + icon grid only） | Popover 更精簡，符合「picker 只需要選」 | 採 |
| B. 縮小預覽（換成 24px icon 而非 grid） | 增加複雜度，但使用者不要求 live preview | 拒 |
| C. 預覽移到 trigger button 右側（小圖） | 結構變更，scope creep | 拒 |

### Bug 5 Strip gating — 為什麼保持現狀

| 選項 | 後果 | 決定 |
|---|---|---|
| A. **保持現狀**（沒選就不顯示 grid） | 既有 fallback 行為不變，向後相容 | 採 |
| B. 沒選時顯示 grid placeholder | 變更既有行為，影響既有使用者體驗 | 拒 |

## 驗證（Rule 006）

| 項目 | 結果 |
|---|---|
| `npx tsc -b --noEmit` (frontend) | exit 0 |
| `npx tsc --noEmit` (backend) | exit 0 |
| `npm run lint` (oxlint) | exit 0（pre-existing warnings）|
| `npx vitest run` (frontend) | 57 files, **463 passed (+8 vs prior 455)**, 5 skipped |
| `npm run verify:i18n` | 17 namespaces passed |
| `npm run build` | exit 0 + `dist/` 產出（5 stamp icons: 1 emitted `sun-D_gGEYQQ.png` + 4 inlined）|
| `localhost:8787` / `localhost:5173` in dist | 0 hits（混 content 風險歸零）|
| `josh1989213.workers.dev` in dist | ≥1 hit |
| `audit-lockfile-bindings` | 8/8 OK |

**Test delta**：+3 stamp icon picker (label ×2 + preview ×1) + 5 strip gating = **+8 tests** (455 → 463)。

## 規範層影響

| 規範 | 影響 |
|---|---|
| Rule `024-mobile-future-proof.mdc` § Hook Split Pattern | 不變（`useStampPickerPopoverPosition` 沒用到 web-only API，可直接 RN 化）|
| Rule `023-shared-package.mdc` § i18n namespace | 不變（仍用 `cardEditor` namespace）|
| Rule `028-image-uploader-pattern.mdc` | 不變（picker 跟 image upload 無關）|
| Rule `013-rwd.mdc` § Modal/Drawer | 不變（mobile 仍用中央 modal，未來可改 bottom sheet）|

**後續 Rule 補完建議**：
- Rule `024` 或新 Rule 029 (Form Controls) 可加「Visual default ≠ functional default」章節：32×32 thumbnail 是視覺提示，label 是語意提示；語意必須反映 store 狀態
- Rule `013` 可加「Popover Sizing Pattern」章節：依內容高度走（Option A）vs 固定 + scroll（Option B）；本次 stamp picker 從 Option B（過寬 480px）改 Option A（280px）
- Rule `013` 或新 Rule 029 可加「Press Feedback Pattern」：interactive button 必有 hover bg + active scale，`transition-fast` (150ms ease-out)

## 給未來 session 的提醒

1. **加新的 L1/L2 元件時，先 grep `components/ui/` + `components/business/`** — StampIconPicker 已經抽成 L2，避免重複造輪
2. **新 token 加進 `index.css` 後，要同步更新 `design-system/MASTER.md` § 1** — 本次 `--color-popover` 忘了更新 MASTER.md，屬於 P2 documentation debt
3. **popover hook 抽 shared 時機**：當第三個 caller 出現時，把 `useStampPickerPopoverPosition` + `ColorSwatchPicker::usePopoverPosition` hoist 到 `Step3*Picker.hooks.ts` shared 模組
