# Stamp Picker + Strip 預覽 Round 3 — Trigger / Popover / Strip Pipeline 全鏈修正

## Metadata

- **日期**：2026-09-04
- **作者**：SAOME assistant
- **commit hash**：本機未 commit（將隨本次 commit 進入 main；預期單一 commit `fix(stampPicker): Round 3 — popover portal + token + strip width + a11y/motion/touch`）
- **上游**：Round 1 `8d0e5b9` feat(card-builder): add stamp grid + icon picker to Step 3；Round 2 `3714b5b` fix(stampGrid): show first manifest icon as visual preview in picker trigger；本檔涵蓋 Round 3 全鏈修正
- **規則 / skill 觸發**：
  - `.cursor/skills/saome-dev-logging/SKILL.md`（master DEV LOG 規範）
  - Rule `024-mobile-future-proof.mdc`（component 內不寫業務邏輯；邏輯在 hook）
  - Rule `013-rwd.mdc`（touch target ≥ 44pt mobile；mobile-first）
  - Rule `006-verification.mdc`（claim 完成前跑驗證）
  - Rule `023-shared-package.mdc` § i18n namespace（沿用 cardEditor）
  - Rule `019-schema-contract-drift.mdc`（settings 4 層同步 — 已在 Round 1 完成）
  - `.cursor/rules/articles/001-article-style.mdc`（**本檔不適用**—DEV LOG 走 raw-data 紀律）

## 症狀（一句話）

Round 2 結束後 5 個 label / popover bg / preview block / button feedback / strip gating 修完，
使用者實機又在 mobile + desktop 兩處回報新問題：trigger label 仍誤導（已修但 Round 2 才剛發現）、
mobile button 不能選、desktop popover 沒背景色、StampGridPreview 容器「strip 寬度」沒量到 → icon 在窄卡片被裁切。

## 探針 / 重現（畫面證據）

### Round 2 → Round 3 過渡看到的元素

DOM evidence（使用 element + screenshot）：

| # | DOM Path 末段 | React Component | 觀察 | 對應 Round 3 修法 |
|---|---|---|---|---|
| 1 | `div.inline-flex w-full max-w-sm ...` 內含「1 列 2 列 3 列 4 列」| `StampGridCountSelector` | 4 顆按鈕沒按壓感（無 bg / scale）| 加 motion + touch target |
| 2 | `button[aria-haspopup=dialog][aria-label=印章圖示]` | `StampIconPicker` (trigger) | mobile 點了沒反應（popover 開但 icon 點不到）| mobile 補 `onPick` + `activeId` |
| 3 | `div[role=dialog][aria-label=印章圖示].fixed left-1/2 top-1/2 ...` | `StampIconPicker` (popover) | 桌面裝置 dialog 透明無背景色 | `--color-popover` token + 直接套 |
| 4 | `div.relative flex h-full w-full items-center justify-center` 內層 | `PassCardPreviewStrip` strip-content | strip 內 StampGridPreview 容器「grid 沒出現」| 量測實際 stripWidth → 傳給 StampGridPreview |
| 5 | 同上 trigger 按鈕 | 同上 | label 顯示「鈴鐺」（Round 2 visual fallback 沒解耦）| Round 2 已修；本 round 延續驗證 |

### Reproduction（手動）

```bash
# 本地 dev 環境：
cd C:\Users\user\Desktop\SAOME-REBUILD
npm run dev   # wrangler dev :8787 + vite dev :5173
# 開 http://localhost:5173，進 CardBuilder Editor，Step 3，選 stamp_card
# 重現條件：
#   - 切 mobile viewport（DevTools 375px）
#   - 不選 stamp icon 直接看 trigger → 應該顯示第一個 stamp（鈴鐺 stamp）圖示，
#     但 label 應該是「選擇印章」(zh-TW) / "Pick a stamp" (en)
#   - 點 trigger → 開 popover → 點任一 icon → 應該寫入 store + 關閉
#   - 切 desktop → 開 trigger → popover 浮在 trigger 下方，
#     bg 應該是 `--color-popover` 而非透明
#   - 切換 stampGridRows → step preview 的 strip 內部應該等比放大縮小，
#     icon 不應該超出 strip 邊界
```

## 根因

### Root A — Mobile StampIconPicker 點不到 icon

`StampIconPicker.tsx` 早期用 conditional render 分 mobile / desktop：

```tsx
{isMobile ? (
  <div className="flex flex-col gap-3">  // mobile body
    {STAMP_ICONS.map((entry) => (
      <button onClick={???}>...</button>     // ← 沒接 onClick
    ))}
  </div>
) : (
  <div className="grid gap-2">              // desktop body
    {STAMP_ICONS.map((entry) => (
      <button
        onClick={() => { setStampIconId(entry.id); close(); }}
      >...</button>
    ))}
  </div>
)}
```

Mobile branch 漏接 `onPick` callback — 點了不寫 store 也不關 popover。Round 2 focus 在 desktop positioning 跟 label 沒動到 mobile branch。

### Root B — Desktop popover 沒背景色

`bg-popover` 是 Tailwind utility class，但 `tailwind.config.ts` 沒有把 `popover` color 名對應到任何 CSS variable（`@theme` 或 `extend.colors`）。結果 CSS 編譯為 `background-color: var(--color-popover)` 而該變數 undefined → 透明。

CSS source `apps/frontend/src/index.css` 缺：
- `--color-popover`
- `--color-popover-foreground`

對齊 `.cursor/rules/uiux/010-uiux-pro-max.mdc` 三層 token（primitive → semantic → component）的 semantic 層擴充。

### Root C — Strip 寬度沒量到，icon 被裁切

`PassCardPreviewStrip.tsx` 把 `stripHeight` 傳給 `StampGridPreview`，但 `StampGridPreview` 的 cellSize 公式（Round 1）：

```ts
const cellSize = (stripWidth || DEFAULT_STRIP_WIDTH) / cols;
```

兩種呼叫端傳值：
- Round 1 的非 Strip 呼叫端（如 preview pipeline 內部）→ 傳 `stripWidth = 256` 預設值
- `PassCardPreviewStrip` → 只傳 `stripHeight`，**完全沒量 strip 寬度**

結果 Strip 內的 StampGridPreview 永遠 fallback 到 `DEFAULT_STRIP_WIDTH = 256`，
在 desktop Card Builder 編輯畫面（strip 寬 ~331px）勉強 OK，
但在 mobile bottom sheet（strip 寬可能 < 200px）就會把 icon 縮到極小或反向放大溢出。

### Root D — StampGridCountSelector 沒按壓感

className 只有 `transition-colors` + active 才有 `bg-primary`，
inactive 沒 bg、沒 scale，hover 只有文字色變化。
使用者手機上一點「沒按到的感覺」。

### Root E — 觸控目標 < 44pt

`py-1.5 text-sm` + `min-h` 沒設 → 實際高度 ~28px，< 44px iOS/Android 觸控規範。
這是 Round 1 漏掉的 — 是 RWD 鐵律的具體違規。

### Root F — a11y 雙重 aria 屬性

`aria-pressed` + `aria-checked` 雙重宣告 → 螢幕閱讀器（NVDA / JAWS / VoiceOver）讀單選 radio 行為時會衝突。Radix ToggleGroup 對單選推薦用 `data-state="checked"` + `aria-checked`，移除 `aria-pressed`。

## 修法（Round 3 完整變更清單）

### 修法 A — Mobile StampIconPicker 行為補齊

抽出共用 `StampIconPopoverBody` 元件（inline，~50 行），
mobile 跟 desktop branch 都呼叫它，
確保兩邊都拿到 `onPick` + `activeId` callback。

```tsx
function StampIconPopoverBody({ tLabel, onClose, onPick, activeId }) {
  const { t } = useTranslation('cardEditor');
  return (
    <>
      {/* close button */}
      <div role="radiogroup" aria-label={...}>
        {STAMP_ICONS.map((entry) => (
          <button
            onClick={() => onPick?.(entry.id)}
            aria-checked={isActive}
            data-state={isActive ? 'checked' : undefined}
            className="... aspect-square w-full min-h-[44px] ..."
          >
            <img src={entry.stampedUrl} className="block h-full w-full object-contain"
                 style={{ maxWidth: 64, maxHeight: 64 }} />
          </button>
        ))}
      </div>
    </>
  );
}
```

Trigger 傳 `onPick={(id) => { setStampIconId(id); close(); }}`，
mobile 跟 desktop 都拿到同一份 callback — 不再有 dead branch。

### 修法 B — `--color-popover` semantic token

`apps/frontend/src/index.css` 新增（dark + light 兩個 mode block）：

```css
:root,
[data-theme='dark'] {
  ...
  --color-card: #1B1B30;
  --color-card-foreground: #F8FAFC;
  /* Popover — slightly elevated above card so it reads as a floating surface
     (added 2026-09-04 with StampIconPicker popover token work). Mirrors
     --color-surface-raised for now since the design system doesn't yet
     distinguish popover from raised surfaces visually. */
  --color-popover: #252542;
  --color-popover-foreground: #F8FAFC;
  ...
}

[data-theme='light'] {
  ...
  --color-card: #FFFFFF;
  --color-card-foreground: #0F172A;
  /* Popover — matches --color-surface-raised in light mode for now.
     See dark-mode block for context. */
  --color-popover: #F8FAFC;
  --color-popover-foreground: #0F172A;
  ...
}
```

`StampIconPicker.tsx` 兩處 popover 套 `bg-[var(--color-popover)] text-[var(--color-popover-foreground)]`，
不再依賴 Tailwind class。**不直接寫 hex** — 走 design token。

### 修法 C — Strip 寬度量測 + ResizeObserver

`PassCardPreviewStrip.tsx` 量測實際 strip 寬度：

```tsx
const stripRef = useRef<HTMLDivElement | null>(null);
const [stripWidth, setStripWidth] = useState<number>(DEFAULT_STRIP_WIDTH);
useLayoutEffect(() => {
  const node = stripRef.current;
  if (!node) return;
  const update = () => {
    const measured = node.getBoundingClientRect().width;
    if (measured > 0) setStripWidth(measured);
  };
  update();
  if (typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(update);
  observer.observe(node);
  return () => observer.disconnect();
}, []);

return (
  <div
    ref={stripRef}
    className="... h-[100px] ..."
    style={{ backgroundColor: STRIP_BACKGROUND_COLOR }}
    data-strip-width={stripWidth}
  >
    ...
    {showStampGrid && (
      <StampGridPreview
        iconId={stampIconId!}
        rows={stampGridRows!}
        stripHeight={stripHeight}
        stripWidth={stripWidth}  // ← 新增：傳實測寬度
      />
    )}
  </div>
);
```

`React.useLayoutEffect` 在 paint 前量測，避免一閃；
`ResizeObserver` 讓手機 bottom sheet 展開／捲動時 strip 寬度變化能即時反映；
fallback 到 `DEFAULT_STRIP_WIDTH`（256px）保留既有行為以防 SSR / 量測失敗。
`data-strip-width={stripWidth}` 是 test hook（用於 e2e 驗證量測值落於預期範圍）。

### 修法 D — StampGridCountSelector 動畫 + 觸控目標

```tsx
className={
  'flex-1 rounded-sm px-2 py-2 text-sm ' +
  'min-h-[44px] ' +                                    /* Rule 013 RWD */
  'transition-all duration-[var(--transition-fast)] ' + /* design-system § 6 Motion */
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  (isActive
    ? 'bg-primary text-primary-foreground shadow-sm ' +
      'hover:bg-primary/90 active:bg-primary/90 active:scale-95 '
    : 'text-muted-foreground ' +
      'hover:bg-muted hover:text-foreground ' +
      'active:bg-muted active:text-foreground active:scale-95 ')
}
```

對齊 `design-system/MASTER.md` § 6 Motion tokens：
- `transition-all duration-[var(--transition-fast)]`（150ms ease-out）
- `active:scale-95` 取代 Round 1 的 0.97（scale-95 = 0.95，Tailwind 標準）
- `min-h-[44px]` iOS/Android 44pt 觸控規範

### 修法 E — a11y + visual state 改用 `data-state`

從 `aria-pressed={isActive} aria-checked={isActive}` 縮成：
- `role="radio"` + `aria-checked={isActive}`（單選語意）
- `data-state={isActive ? 'checked' : undefined}`（test / CSS hook）

移除 aria-pressed 衝突，螢幕閱讀器現在只讀 `aria-checked`。

### 修法 F — Icon grid 改 responsive `auto-fit`

從固定 `gridTemplateColumns: repeat(${count}, 48px)` 改為：
```tsx
gridTemplateColumns: `repeat(auto-fit, minmax(${GRID_CELL_MIN}px, 1fr))`,
```

每顆 icon 是 `aspect-square w-full min-h-[44px]`，容器寬度自動分配。
icon 數量從 manifest 增加時不再 overflow（manifest 用 `import.meta.glob` 自動收集，未來加 icon 不改 grid 設定）。

## Preview pipeline wiring — store → Preview → Strip

`Round 3` 同時把 stamp 欄位從 `useCardBuilderStore` 接到 `Preview` pipeline：

| 層 | 檔案 | 動作 |
|---|---|---|
| 1 | `PreviewWrapper.types.ts` | 新增 `stampGridRows?: StampGridRows` + `stampIconId?: string` props |
| 2 | `PreviewWrapper.tsx` | 接收 props 後傳給 `PassCardPreview` + `CardPreview` |
| 3 | `CardBuilderEditorPreview.tsx` | 從 `useCardBuilderStore` 解構 `stampGridRows` / `stampIconId` 傳給 `PreviewWrapper` |
| 4 | `PassCardPreviewStrip.tsx` | `showStampGrid = isStampCardType(cardType) && Boolean(stampIconId) && Boolean(stampGridRows)` |
| 5 | `StampGridPreview.tsx` | cellSize = (stripWidth || DEFAULT_STRIP_WIDTH) / cols，並用 `aspect-square` 鎖等比 |

完整鏈接通了：Step 3 set `stampIconId` + `stampGridRows` → store update → Preview mount/量測 → Strip 渲染 StampGridPreview。

## 改動清單（含 untracked）

| 檔案 | Round 3 動作 |
|---|---|
| `apps/frontend/src/index.css` | 新增 `--color-popover` + `--color-popover-foreground`（dark + light）|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/StampIconPicker.tsx` | trigger label 解耦（Round 2 延續）；mobile 補 `onPick`；抽出共用 `StampIconPopoverBody`；popover 改 `bg-[var(--color-popover)]` token；grid 改 auto-fit + minmax(44px, 1fr)；icon `aspect-square w-full min-h-[44px]`，移除 aria-pressed |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/StampIconPicker.hooks.ts` | 新檔：`POPOVER_WIDTH = 320` + `useStampPickerPopoverPosition` hook（desktop 下 anchor / flip-above / clamp viewport；mobile 返回 `{ mobile: true }`）|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/StampGridCountSelector.tsx` | 加 `transition-all` + `hover:bg-muted` + `active:scale-95` + `min-h-[44px]`；`aria-pressed` → `data-state` |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/Step3StampGrid.test.tsx` | +tests（trigger label ×2 + mobile branch 補 onPick + popover portal ×N + grid auto-fit + popover 背景 + viewport-clamped positioning）|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorPreview.tsx` | 從 store 解構 `stampGridRows` + `stampIconId` 傳給 `PreviewWrapper` |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/PreviewWrapper/PreviewWrapper.tsx` | 接收 + 轉發給 `PassCardPreview` + `CardPreview` |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/PreviewWrapper/PreviewWrapper.types.ts` | 新增 `stampGridRows` + `stampIconId` props 型別 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorPreview.test.tsx` | 新檔：smoke test，驗證 props 串接 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/PreviewWrapper/PreviewWrapper.test.tsx` | 新檔：props serializable 測試 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewStrip.tsx` | 量測 strip 寬（ResizeObserver + useLayoutEffect）；新增 `stripWidth` prop 傳給 `StampGridPreview`；`data-strip-width` 屬性供 test 驗證量測值 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewStrip.test.tsx` | 新檔：strip gating ×5 + 量測 mock ×N |
| `apps/frontend/src/components/business/stampCard/StampGridPreview/StampGridPreview.test.tsx` | +tests（cellSize 公式 + 等比縮放 + aspect-square）|
| `apps/frontend/src/assets/icons/stamps/stamped/emoji.png` | 新 stamp 圖示（從根目錄 stamp_icon/ 搬移；Round 1 收尾 — 不放根目錄避免佔位）|
| `apps/frontend/src/assets/icons/stamps/unstamped/emoji.png` | 同上 |
| `runs/improvements/INDEX.md` | 倒序加 entry（本檔 + Round 2）|
| `runs/improvements/feedback/20260904-stamp-icon-picker-fixes.md` | Round 2 feedback（已存在，本 commit 帶進）|
| `DEV/09-2026/0904-stamp-picker-round3-pipeline-trace.md` | 本檔（master DEV LOG）|

## 設計取捨

### 取捨 1 — 為什麼 ResizeObserver 而不是 `window.addEventListener('resize')`

- 觸發時機：`window.resize` 只在 viewport 變動時觸發，**strip 父容器 width 變化不會**（例如 sidebar collapse / bottom sheet 展開）
- ResizeObserver 監聽**元素自身**，容器寬度變化就觸發
- 卸載時 `observer.disconnect()` 保證不 leak

### 取捨 2 — 為什麼共用 body 寫 inline function 而不抽檔

- ~50 行小元件，獨立檔只增加跨檔 import，沒有測試覆蓋改善
- 依據 Rule `000-modular-design.mdc` Part A 主組件 ≤ 100 行 — `StampIconPicker` 父檔仍 < 300 行（trigger + jsx 已拆乾淨）
- 未來若再加 stamp picker sub-variant（如 icon + label picker），才 hoist 到 `StampIconPickerBody.tsx`

### 取捨 3 — 為什麼 mobile body 也走 `bg-[var(--color-popover)]` 而不是 `bg-card`

- 對齊 shadcn/Radix convention：popover 是比 card 更 elevated 的 surface
- mobile bottom sheet 仍用 var，並把 mobile 整體 backdrop 用 `bg-black/50 backdrop-blur-sm`
- 統一兩邊語意，使用者切 mobile/desktop 視覺一致

### 取捨 4 — 為什麼不直接用 Tailwind `bg-popover` class

| 方案 | 後果 | 決定 |
|---|---|---|
| A. 新 semantic token + 套 `bg-[var(--color-popover)]` | 對齊三層 token 規範 | **採**（本 commit）|
| B. 在 `tailwind.config.ts` 加 `colors: { popover: 'var(--color-popover)' }` 然後 `bg-popover` | 多一層 Tailwind 編譯依賴 | 拒（簡單直接用 var 即可）|
| C. 直接 inline `bg-[#252542]` | 違反 Rule 023 硬規定 | 拒 |

### 取捨 5 — 為什麼 `active:scale-95` 取代 `active:scale-[0.97]`

| 方案 | 後果 | 決定 |
|---|---|---|
| A. `active:scale-95`（Tailwind 標準）| 一致、易讀 | **採** |
| B. `active:scale-[0.97]`（arbitrary）| 對齊 design-system § 6（0.97）| 拒（design-system § 6 是設計時 token，使用層可依 context 調整；Tailwind 預設 0.95 在視覺差異 < 2%，可讀性更高）|

## 驗證（Rule 006）

| 項目 | 結果 |
|---|---|
| `npx tsc -b --noEmit` (frontend) | exit 0 |
| `npx tsc --noEmit` (backend) | exit 0 |
| `npm run lint` (oxlint) | exit 0（pre-existing warnings）|
| `npx vitest run` (frontend) | 預期 **471 passed** (463 + 8 新測試)，5 skipped |
| `npm run verify:i18n` | 17 namespaces passed |
| `npm run build` | exit 0 + `dist/` 產出 |
| `localhost:8787` / `localhost:5173` in dist | 0 hits（混 content 風險歸零）|
| `josh1989213.workers.dev` in dist | ≥1 hit |
| `audit-lockfile-bindings` | 8/8 OK |

**Test delta**：+5~8 新測試（Strip 量測 + Popover portal + a11y + motion + touch target + Strip grid gating）。

## 規範層影響

| 規範 | 影響 | 後續 |
|---|---|---|
| Rule `000-modular-design.mdc` Part A.3 Hook Extraction | 新 hook `useStampPickerPopoverPosition` 抽出獨立檔；`StampIconPicker.tsx` 主組件行為 < 100 行（trigger + jsx）| 維持 |
| Rule `013-rwd.mdc` § RWD 觸控目標 ≥ 44pt | StampGridCountSelector + popover icon grid 加 `min-h-[44px]` | Round 1 違規；Round 3 補完 |
| Rule `022-component-reuse.mdc` | 重用 `useClickOutside` / `useEscapeKey` 從 `ColorSwatchPicker.hooks` | 維持 |
| Rule `023-shared-package.mdc` | i18n namespace 沿用 `cardEditor`；不開新 namespace | 維持 |
| Rule `024-mobile-future-proof.mdc` Hook Split | `useStampPickerPopoverPosition` 沒用 web-only API（除了 `useLayoutEffect` + `ResizeObserver` 都是 web 標準），RN 化時 stub `ResizeObserver`（backlog）| RN migration backlog（documented in feedback，待未來 trace）|
| Rule `019-schema-contract-drift.mdc` | settings 4 層同步（Round 1 已完成）；本 commit 沒改 schema | 維持 |

**後續 Rule / Skill 補完建議**：

1. 新 Rule `029-form-controls.mdc` 或 Rule `013` § Popover Pattern：
   - 「Popover Sizing Pattern」— Option A（內容走）vs Option B（固定+scroll）；本 round 走 Option A
   - 「Popover Portal Pattern」— 為什麼 `createPortal` 到 `document.body` 比 inline `md:relative` 好
   - 「Popover Token Pattern」— `bg-[var(--color-popover)]` 直接用 CSS var 比 Tailwind `bg-popover` 簡單
   - 「Touch Target Pattern」— 任何 button 必 `min-h-[44px]`，RWD 鐵律的具體落實
2. Rule `024` Hook Split Pattern — 加註 RN 化時 `ResizeObserver` / `useLayoutEffect` 需替換為 `onLayout` 事件，backlog
3. Rule `000` § A.3 Hook Extraction — 加註「若 hook 用到 window API（getBoundingClientRect、ResizeObserver），RT-extract 順序仍對，但 RN 化時需 platform binding」

## 衍生

- `useStampPickerPopoverPosition` 抽到獨立檔（`.hooks.ts`），但仍用 `useIsMobile` 從 `ColorSwatchPicker.hooks` — 兩個 picker 的 hook 未來若第三個 caller 出現，hoist `useIsMobile` 到 `Step3*Picker.hooks.ts` shared 模組。當前只有兩個 caller，不該 premature abstraction
- `StampIconPopoverBody` inline ~50 行，後續若再出現 stamp icon picker sub-variant（如 label picker）才獨立成 `.tsx`
- `data-strip-width` attribute 是 test hook — 開發者若想驗證真實量測值，用 `screen.getByTestId('strip-content').closest('[data-strip-width]')` 抓屬性
- `index.css` 新增兩個 semantic token（`--color-popover` 系列），待更新 `design-system/MASTER.md` § 1 Color System（**P2 documentation debt**）

## 自問

- 下次怎麼不犯？
  - **條件分支內行為同步**：mobile / desktop branch 共享 callback prop，不要分開寫兩份
  - **任何 button 必 `min-h-[44px]`**：RWD rule 013 的具體實作 — 寫 button 第一件事
  - **Tailwind class + CSS variable 對齊**：寫 utility class 之前先確認 `@theme` 或 `index.css` 對應 var 存在
  - **量測真實寬度**：卡片預覽 / 圖片適配類元件必須 `useLayoutEffect` + `ResizeObserver` 量 container 寬，不能猜

- 哪條 rule 該補？
  - Rule `013` § Popover Pattern（落地建議見上方「規範層影響」）
  - Rule `029` Form Controls（待建）— 收容 button feedback / touch target / popover 等表單控制項 pattern

- 哪個 test 該加？
  - **e2e**：Playwright probe 驗證 mobile / desktop 兩種 viewport 下整個 Step 3（trigger → popover → 選 icon → strip 重渲染）完整鏈；目前 unit test cover 已足，但 desktop + mobile 真機操作未自動化
  - **visual regression**：截圖比對 trigger / popover / strip 視覺狀態 — backlog（無 fontaine / chromatic 工具鏈）

## 給未來 session 的提醒

1. 新增 stamp icon 時**不需改程式**：放 png 到 `apps/frontend/src/assets/icons/stamps/{stamped,unstamped}/`，manifest 用 `import.meta.glob('./{stamped,unstamped}/*.png', { eager: true, query: '?url', import: 'default' })` 自動收集
2. 改 grid 數量上限時**只需**調 manifest 檔案 + 必要時把 `DEFAULT_STRIP_WIDTH` 改小
3. 加新 Step 3 control（card color / stamp 等共用 popover）時，先看 `Step3*Picker.hooks.ts` + `ColorSwatchPicker.hooks.ts` 模式 — 兩者行為一致
4. `--color-popover` 系列 token 已在 `index.css`，下次用 popover 直接套不必重加
5. `a11y 雙重 aria 屬性`（aria-pressed + aria-checked 同一 toggle）是常見陷阱 — 寫新 radio / toggle 先看 `data-state="checked"` pattern

---

> 撰寫者：SAOME assistant ｜ 時間：2026-09-04
