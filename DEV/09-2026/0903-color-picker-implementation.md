# Color Picker — DEV LOG (Step 3 Card Colors + Option A Popover Sizing)

> 日期：2026-09-03
> Committer：Josh <josh1989213@gmail.com>
> Branch：`fix/card-builder-migration`
> Commits（依時間順序）：
> 1. `85dd857` fix(color-picker): keep popover open on inner scroll + add min-w-0 — 08:01:20（本機已 commit 但尚未 push）
> 2. （本次）Color picker shared logic + workspace integration + preview pipeline + Option A popover 重構
>
> 觸發 skill：`saome-dev-logging`（master DEV LOG raw data 紀律） + `saome-self-improvement`（feedback 即時 + INDEX 同步）
> 計畫來源：Color Picker L2 plan（CardBuilder Step 3 卡片顏色編輯器）

---

## 背景

CardBuilder Step 3 原本只有 Logo / Icon / Background 三種 image upload。Apple Wallet / Google Wallet Pass 還允許**純色卡片背景**與**文字色**（無 image，靠 hex 色碼指定背景 + 文字對比）。

需求：
1. 兩顆並列 color picker：背景色 + 文字色
2. 提供 20 色 preset palette + HSL drag picker（react-colorful）+ hex 6-digit input
3. PassCreator contract：6-char uppercase hex **無 `#`** prefix；store internal format：含 `#`
4. Mobile / Desktop 都要 work（mobile = bottom sheet，desktop = trigger-anchored popover）
5. Save → DB → reload → 同一個 hex 不能被破壞

### 範圍

| 類別 | 檔案 |
|---|---|
| 新 L2 元件 | `Step3CardColors/ColorSwatchPicker.tsx` + `.types.ts` + `.stories.tsx` + `.test.tsx` + `.hooks.ts` + `ColorSwatchPalette.tsx` |
| 父組件 | `Step3CardColors/index.tsx`（兩顆並列 + section header pattern 對齊 logo/icon/background）|
| shared package | `packages/shared/constants/color-presets.ts`（20 色）+ `packages/shared/logic/color.ts`（normalize / validate / isPreset）|
| shared test | `packages/shared/logic/color.test.ts`（11 case）|
| i18n | `apps/frontend/src/i18n/locales/colorPicker.{zh-TW,en}.ts`（component-bound namespace）+ `cardEditor.{zh-TW,en}.ts` 補 step3.colorsSection |
| store | `CardBuilderEditor.store.ts`：`loadSettings` defensive normalize color（`#FFFFFF` ↔ `FFFFFF` round-trip）|
| workspace | `CardBuilderEditorWorkspace.tsx`：Step 3 handler 持久化 colors |
| preview | `PassCardPreview.tsx` + `PassCardPreviewStrip.tsx` + `PassCardPreviewHeader/Body/Footer.tsx` 套用 colors |
| template card | `TemplateCard*.tsx` 套用 colors（template library 也顯示 color）|
| alias | `vite.config.ts` + `vitest.config.ts` 加 `@saome/shared/logic/color` + `@saome/shared/constants/color-presets` |
| deps | `apps/frontend/package.json` + `package-lock.json`：`react-colorful` ^5.8.1 |

### 不在這次範圍

- ❌ Dropper / eyedropper（不在 PassCreator 範圍）
- ❌ RGBA / opacity（PassCreator 只吃 6-digit RGB）
- ❌ 自動產生對比色文字（design token 階段處理，目前手動指定）

---

## Round 1 — Component Skeleton（85dd857，08:01:20）

第一輪實作把所有 L2 元件骨架與父組件產出，重點是：

1. **Trigger → Popover 兩段式**：`createPortal` 讓 popover 跳出 `<aside>` 的 `overflow:hidden` 祖先 clip
2. **Mobile bottom sheet vs Desktop popover 分流**：`useIsMobile(640)` 切換 layout，遵循 Rule 013 § Modal/Drawer
3. **Preset palette + Hex input 共用 form**：hex submit 走 `validateColor` → 失敗不 commit，成功 strip `#` + uppercase
4. **commit-on-close 語意**：`draft` 內部 state + `value` 對外 prop；click outside / Esc / 套用 / preset click 才 commit
5. **HSL drag preview without commit**：拖 HSL 只更新 trigger 預覽，commit 在關閉時發生（Figma / Photoshop 風格）

這個版本是「先把流程跑通」的「**draft 1**」。

> Round 1 完成時 desktop popover 還是用 `max-height: calc(100vh - 32px)` + `flex-1 overflow-y-auto` 內層容器。雖然能跑，但 desktop viewport 上**總是**出現 vertical scrollbar（content 只 ~460px，但 flex-1 把內層撐到 100vh-32px，導致 ~400px 空白被當作 overflow）。這是 Round 2 要修的「Option A」決策的契機。

---

## Round 2 — Shared Logic 抽出（本次 uncommitted commits）

### 動機

`validateColor` 一開始直接寫在 `ColorSwatchPicker.tsx` 內。需求更明確後發現三件事：

1. **Store round-trip 也要 normalize**：DB 存 `FFFFFF`（PassCreator 格式，無 `#`），但 store 內部用 `#FFFFFF`。`loadSettings` 必須把 raw `FFFFFF` 包成 `#FFFFFF`，否則 trigger 顯示 `FFFFFF` 看起來怪
2. **Preset 判定**：未來想在 preview 上 highlight 哪些卡片用 preset color，需要 `isPresetColor(hex)` 函式
3. **Mobile 重用**：未來 RN ColorPicker 也要 validate / normalize，但 RN 沒 `document` 等 web API；shared logic 必須純函式

### 修法

新增 `packages/shared/logic/color.ts`（純函式）：

```ts
const HEX6_RE = /^[0-9A-Fa-f]{6}$/;

export function normalizeHex(input: string): string | null {
  const trimmed = input.trim().replace(/^#/, '');
  if (HEX6_RE.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

export function validateColor(input: string): { hex: string } | ColorValidationError {
  const hex = normalizeHex(input);
  if (!hex) return { type: 'invalid', message: 'colorPicker.validation.invalid' };
  return { hex };
}

export function isPresetColor(hex: string): hex is ColorPreset {
  const normalized = normalizeHex(hex);
  return normalized !== null && (COLOR_PRESETS as readonly string[]).includes(normalized);
}
```

`ColorValidationError.message` 用 **i18n key**（`'colorPicker.validation.invalid'`），不是 raw text — 對齊 Rule 023 § Shared Validation 用 i18n Key。

### Store integration

`CardBuilderEditor.store.ts` 加 `normalizeLoadedColor` helper：

```ts
function normalizeLoadedColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const normalized = normalizeHex(raw);
  return normalized ? `#${normalized}` : fallback;
}
```

`loadSettings` 用它包 `backgroundColor` / `textColor`：

```ts
backgroundColor: normalizeLoadedColor(resolved?.backgroundColor, state.backgroundColor),
textColor: normalizeLoadedColor(resolved?.textColor, state.textColor),
```

加 defensive 是為了防止：
- legacy DB row 有 `'#ffffff'`（有人塞過 lowercase）
- legacy 6-char 但有 whitespace
- null / undefined / 非 string（PassCreator schema 沒擋住）
- 任何不在 `HEX6_RE` 的 garbage

加 5 個新 store test case 驗證 round-trip：

```ts
describe('CardBuilderEditor.store — backgroundColor / textColor round-trip', () => {
  it('normalizes raw PassCreator hex (6-char uppercase, no #) into store internal format with #', ...);
  it('uppercases + wraps textColor from raw PassCreator format', ...);
  it('falls back to current state value when loaded color is invalid', ...);
  it('handles both colors together in a single loadSettings call', ...);
  it('falls back to default when raw is null/undefined (no existing state)', ...);
});
```

---

## Round 3 — Preview pipeline 套用 color

### 動機

`ColorSwatchPicker` 編輯 backgroundColor / textColor → store → 必須 thread 到 preview 讓使用者即時看到效果。

下游鏈：

```
useCardBuilderStore.backgroundColor
  → PreviewWrapper
    → PassCardPreview (front + back)
      → PassCardPreviewHeader  → text color
      → PassCardPreviewBody    → text color
      → PassCardPreviewFooter  → text color
      → PassCardPreviewStrip   → background color (when no background image)
```

### 修法

每個 `PassCardPreview*.tsx` 加 `textColor` / `backgroundColor` prop，thread 到 inline `style={{ color: textColor }}` 或 `style={{ backgroundColor }}`。沒有 hard-code hex，store value 直接餵進去（已是 `#FFFFFF` 格式）。

`TemplateCard` / `TemplateCardPreview` 對稱：template library 卡片也要顯示用戶選的顏色，否則使用者選了黑底白字但 library 仍顯示白底黑字會誤導。

### Verification

- typecheck: exit 0
- vitest: 363/363 passed across 51 test files（比 commit `85dd857` 的 362 多 1 個 — store round-trip 5 個 case 計入 CardBuilderEditor.store.test.ts 總計 17 個）

---

## Round 4 — Option A Popover Sizing 決策（feedback #1）

### 動機

Round 1 的 popover 設計：

```tsx
// Outer
style={{ maxHeight: 'calc(100vh - 32px)' }}
className="... flex flex-col overflow-hidden ..."

// Inner
className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden flex-col gap-3"
```

理論上：outer 是固定 max-height + scroll-hidden，inner 是 `flex-1 overflow-y-auto` 來 scroll。

**實際問題**：
1. `flex-1` 在 flex 內**總是** claim 所有 main-axis 空間直到 maxHeight。所以 inner 永遠 ~100vh-32px-12px padding（≈ 700px on desktop）
2. 內容只有 HSL picker (160px) + palette (130px) + hex input (60px) + gaps + padding ≈ **460px**
3. 結果：inner 700px 高但內容只有 460px，多出 ~240px 是「empty flex space」 — 但 overflow-y-auto 還是把它當 overflow 顯示 scrollbar

**UX 問題**：每次打開 popover 都看到一條永遠用不到的 vertical scrollbar，視覺上像是「popover 不跟內容高度走，可以上下滑動」。這個跟 figma / sketch / photoshop 的 color picker 慣例完全相反。

### 修法：Option A — popover 跟內容高度走

```tsx
// Outer — NO maxHeight, NO overflow-hidden
className="z-[9999] flex flex-col rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-lifted)]"

// Inner — plain flex column, no flex-1 / min-h-0 / overflow
className="flex min-w-0 flex-col gap-3"
```

效果：
- Popover 高 = 內容自然高 ≈ 460px
- 沒有 scrollbar
- Shadow 不被 clip（因為沒有 overflow-hidden）
- Trade-off：viewports < 460px 高度時 popover 會凸出去，但實務上 desktop viewport ≥ 700px，mobile 走 bottom sheet 不受影響

測試覆蓋（更新 4 個 `describe('ColorSwatchPicker — desktop popover sizing')` 區塊）：
1. `outer popover has no overflow-hidden` — shadow 不被 clip
2. `inner content area is NOT a scroll container` — 沒有 flex-1 / min-h-0 / overflow
3. `outer popover has NO maxHeight` — sizes to natural content height
4. `desktop popover contents are all reachable without scroll` — HSL + palette + hex 全部在 DOM

### 學習

詳見 `runs/improvements/feedback/20260903-color-picker-popover-option-a.md`。

關鍵 takeaway：**flex-1 + fixed maxHeight 組合**會把 inner 撐到 maxHeight，無視內容高度。要么 (a) 給 maxHeight 且真實內容 > maxHeight、 (b) 完全不加 maxHeight + flex-1、改讓 outer 自己 shrink-to-fit content。

---

## Round 5 — 跨 viewport 行為對齊

### Mobile bottom sheet（< 640px）

`MobileColorSheet`：

- Full-width + `rounded-t-2xl`
- Backdrop dim+blur（與 desktop 一致）
- 內層 `flex-1 min-h-0 overflow-y-auto`：short mobile viewport 仍可 scroll
- `pb-[max(0.75rem,env(safe-area-inset-bottom))]`：iOS Safari bottom safe area

對應測試 7 個 case（開 / 關 / scroll 不關 / close handle 不 toggle / 內容 scroll / etc）

### Desktop popover（≥ 640px）

- Trigger-anchored via `usePopoverPosition`
- `width: 280`，`top` / `left` 從 `getBoundingClientRect()` 推導
- Flip-above trigger 當 `spaceBelow < POPOVER_HEIGHT_ESTIMATE + 16`
- Backdrop dim+blur（**新增** — 之前沒有 backdrop，popover bg-card 跟 page bg-background 對比不夠，使用者會看到下面內容；加 backdrop 後 popover reads as elevated）

對應測試 8 個 case

### 共用 commit-on-close 語意

兩種 viewport 共用 `commitAndClose` callback：
- Mobile：tap backdrop / tap X close handle → 觸發 commit
- Desktop：click outside / Esc / backdrop click → 觸發 commit
- 共用 HSL drag 期間的「draft」state，commit 時才呼叫 `onChange`

---

## 衍生

### 影響的檔案

| 類別 | 檔案 |
|---|---|
| L2 元件（既有 85dd857 + 本次）| `Step3CardColors/{index.tsx, ColorSwatchPicker.tsx, ColorSwatchPicker.test.tsx, ColorSwatchPalette.tsx, ColorSwatchPicker.types.ts, ColorSwatchPicker.hooks.ts, ColorSwatchPicker.stories.tsx}` |
| shared constants | `packages/shared/constants/color-presets.ts`（新）+ `index.ts`（barrel export）|
| shared logic | `packages/shared/logic/color.ts`（新）+ `color.test.ts`（新）+ `index.ts`（barrel export）|
| i18n | `apps/frontend/src/i18n/locales/colorPicker.{zh-TW,en}.ts`（新）+ `cardEditor.{zh-TW,en}.ts`（+ step3.colorsSection keys）+ `i18n/index.ts` + `test/i18n.ts`（namespace 註冊）|
| state | `CardBuilderEditor.store.{ts,test.ts}`（+ color round-trip defensive + 5 test）|
| page | `CardBuilderEditorWorkspace.tsx`（Step 3 handler 持久化 colors + Step3CardColors section header）|
| preview | `PassCardPreview.{tsx,types,test}.tsx` + `PassCardPreview{Header,Body,Footer,Strip}.tsx` + `PreviewWrapper.{tsx,types}` |
| template card | `TemplateCard.{tsx,types.ts}` + `TemplateCardPreview.tsx` |
| deps | `package.json` + `package-lock.json`（react-colorful ^5.8.1）|
| alias | `vite.config.ts` + `vitest.config.ts` |

### 與既有 rule 的對齊

- Rule 000 § A.1 L2 業務元件資料夾結構：`ColorSwatchPicker/` 完整資料夾（index + main + sub + types + hooks + stories + test）
- Rule 013 RWD § Modal/Drawer：mobile = full-screen bottom sheet，desktop = trigger-anchored popover
- Rule 014 Breakpoint：`useIsMobile(640)` 對齊 `sm:` boundary（639px = `max-width` query）
- Rule 023 § Shared Validation 用 i18n Key：`validateColor` 回傳 i18n key 而非 raw text（'colorPicker.validation.invalid'）
- Rule 023 § i18n Namespace：`colorPicker` 為 component-bound namespace（跟 `passCard` / `memberBadge` 同層）
- Rule 023 § Test i18n：`src/test/i18n.ts` 同步 register 確保 Vitest 環境可解析
- Rule 025 Vibe Coding L2 checklist：i18n 先做 → 元件結構 → test → smoke
- Rule 000 § A.3 Hook Extraction：`useClickOutside` / `useEscapeKey` / `useIsMobile` / `usePopoverPosition` 抽到 `.hooks.ts`
- Rule 024 Mobile Future-Proof：`validateColor` / `normalizeHex` / `isPresetColor` 全在 shared/logic，RN 化零成本

### 未來 reuse pattern

新 color-driven feature 的 SOP：

1. shared/logic 加 pure function（normalize / validate / match）
2. shared/constants 加 preset table（如未來需要第二組 preset）
3. component-bound i18n namespace（**不**放 cardEditor，遵循 Rule 023 元件化原則）
4. L2 元件資料夾（sub-component + hooks + types + stories + test）
5. Store action `setXxxColor` + `loadSettings` defensive normalize
6. Pipeline 套用：workspace → preview → template library

---

## 自問

1. **為什麼 `POPOVER_HEIGHT_ESTIMATE = 460` 而不是實際內容高度？**
   Option A 沒有 maxHeight，但 `usePopoverPosition` 還需要 460 估算來決定「要不要 flip-above trigger」。值是 desktop popover 的自然內容高度（HSL 160 + palette 130 + hex 60 + gaps + padding ≈ 460px）。如果未來加 preset search 或 palette grid 變大，這個常數要同步 bump。**未來 invariant**：要不要在 commit hook 自動量測 popover 高度並 cross-check 這個常數？

2. **為什麼 mobile bottom sheet 不用 `animate-in slide-in-from-bottom` 而 desktop popover 沒動畫？**
   Mobile 用 Tailwind `animate-in slide-in-from-bottom` (300ms duration) — iOS sheet pattern，視覺上從底部彈出。Desktop popover 沒動畫是**故意的** — 突然出現的 trigger-anchored popover 比「慢慢 fade in」更明確表示「這是 floating panel」。如果未來想做 desktop fade-in，要 hover delay 400ms 才不會太 aggressive。

3. **為什麼 backdrop click 同時掛 `useClickOutside` mousedown + 自己 onClick handler？**
   兩個路徑都是 idempotent（setOpen(false) 兩次 = 一次）。但 mousedown listener 用 capture phase + 比對 `popoverRef.contains(target)`，可能某些 edge case（如 backdrop 子元素有 `pointer-events:none`）漏掉。直接 onClick 是 backup。實務上 99% 情況 mousedown 就夠，但 onClick 是 defensive。

4. **i18n key `'colorPicker.validation.invalid'` 為什麼不是 `'colorPicker.error.invalid'`？**
   對齊 `logoUpload.validation.tooLarge` / `iconUpload.validation.tooLarge` / `backgroundUpload.validation.*` 的既有命名：`validation` 是 shared/logic 回傳的 prefix（與 Rule 023 § Shared Validation 連動），`error` 預留給 runtime error boundary。

5. **20 個 preset 為什麼是 4 grayscale + 16 saturated 而不是其他分配？**
   - Grayscale 4 個（純黑 / 深灰 / 淺灰 / 純白）覆蓋最低限度
   - 16 個 saturated 分成 4 group × 4 個：Warm（橘 / 蜜橘 / 琥珀 / 紅）/ Cool（綠 / 青 / 藍）/ Brand（紫 / 淡紫 / 粉）/ Neutral muted（slate 系列 + 一個 SAOME 深色 `27273B`）
   - 20 個 = 8 欄 grid 整除（2.5 排），不需要 awkward 7×3 = 21 / 6×4 = 24 選擇
   - 8 欄在 280px popover 內放下 8×30px swatch + gap 1.5*7 = 12 + 8×30 = 252，剛好

6. **為什麼不用 react-colorful 的 `HexAlphaColorPicker` 或 `RgbStringPicker`？**
   PassCreator 只吃 6-digit RGB，沒有 alpha / rgb string 需求。`HexColorPicker` 是最 specific 的選擇 — 跟 shared/logic/color 的 6-char-only contract 對齊。

---

## Verification（per Rule 006）

| 驗證項 | 狀態 | 證據 |
|---|---|---|
| typecheck | ✅ exit 0 | `npm run typecheck` exit 0 |
| lint | ✅ exit 0（no errors，13 warnings 既有的）| `npm run lint` 0 errors |
| vitest | ✅ 363 passed \| 5 skipped (368 total) across 51 test files | `npm test` exit 0 |
| i18n smoke | ✅ `npm run verify:i18n` 0 raw key | commit message footer |
| CardBuilderEditor.store round-trip | ✅ 5 new test cases | `CardBuilderEditor.store.test.ts` describe block |
| ColorSwatchPicker desktop Option A | ✅ 8 test cases | `ColorSwatchPicker.test.tsx` describe 'Option A' |
| ColorSwatchPicker mobile bottom sheet | ✅ 7 test cases | `ColorSwatchPicker.test.tsx` describe 'responsive bottom sheet' |

---

## Cross-link

- Feedback：Option A Popover Sizing → `runs/improvements/feedback/20260903-color-picker-popover-option-a.md`
- Previous commits in chain：
  - `85dd857` fix(color-picker): keep popover open on inner scroll + min-w-0
  - `5cd0846` docs: BackgroundUploader implementation trace
  - `ffcaf28` feat(cardBuilder): add backgroundImage to store + workspace + PassCardPreview pipeline
  - `09cd641` refactor(mediaAssetUploader): add background variant support
- Sibling CardBuilder Step 3 features：
  - LogoUploader 重構：`DEV/08-2026/0830-logouploader-p0p1-refactor-rule-sedimentation.md`
  - IconUploader 實作：`DEV/08-2026/0831-icon-uploader-implementation.md`
  - BackgroundUploader 實作：`DEV/08-2026/0901-background-uploader-implementation.md`

---

> 撰寫者：Josh ｜ 時間：2026-09-03 08:35 UTC+8
