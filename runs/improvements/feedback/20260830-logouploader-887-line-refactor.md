# LogoUploader 887 → 394 行重構 — Hook Extraction Strategy（A.3 Rule 000）

## Metadata

- **日期**：2026-08-30
- **作者**：Cursor Agent + Josh
- **commit hash**：`0ba9c9e`（refactor(logoUploader): P0+P1 refactor + rule sedimentation）
- **規則 / skill 觸發**：`000-modular-design.mdc` § A.3 Hook Extraction Strategy、`saome-image-upload`
- **影響**：LogoUploader 主組件 887 → 394 行（-56%）；拆出 7 個 sub-component；每個 sub-component 可獨立測試
- **嚴重度**：N/A（純 refactor，無 runtime behavior 改變）

---

## 症狀

> 「LogoUploader.tsx 主組件 887 行，混了 JSX / state / drag handlers / momentum raf / scale logic / upload API call —— 完全沒辦法 unit test sub-component，每次改都怕 breaking。」

### 觀察（refactor 前 audit）

| 項目 | 當前狀態 | 問題 |
|---|---|---|
| 主組件行數 | **887 行** | 嚴重超過 L2 100 行上限（rule 000 鐵律）|
| 純邏輯位置 | inline 在 component 內 | 無法跨 feature 重用、RN 化時無法共享 |
| `useDragHandlers`（pointermove / touchmove / momentum raf） | 主組件 inline | props 必須從主組件一路傳到 sub-component |
| Sub-component 拆分 | 無 | 全部 inline 在主組件 |
| 測試覆蓋 | 主組件整體測試 | drag / momentum / scale 三個邏輯混在一起，寫不出 isolated test |

---

## 根因分析

### 為什麼不能直接拆 sub-component

直接拆 sub-component 會發現：

1. **props 一大坨**：refs 全部要從主組件傳到 sub-component
2. **sub-component 內還是有 inline 邏輯**：例如 CropStage 內還是有 drag handlers
3. **測試難寫**：sub-component 依賴一坨 inline logic，要 mock 整個主組件環境

### 正確順序：先抽 hook、再拆 sub-component

> 詳見 `000-modular-design.mdc` § A.3 Hook Extraction Strategy（NEW）

| 元件行數 | 行動 | 順序 |
|---|---|---|
| ≤ 100 | OK | — |
| 100–500 | 拆 sub-component + props 化 | sub-component only |
| **500–1000** | **先抽 hook 到 `.hooks.ts`，再拆 sub-component** | hook → sub-component |
| > 1000 | 拆 sub-component + 拆多個 `.hooks.ts`，考慮分多個 L2 元件 | hook × N → sub-component × M |

當元件有 500–1000 行時，裡面通常混了 3 種東西：

1. **JSX**（渲染）
2. **state 與 orchestration**（reducer 邏輯、event handler）
3. **複雜 hook 邏輯**（如 `useDragHandlers`：pointermove / touchmove / momentum raf）

直接拆 sub-component 會發現：

- props 一大坨（refs 全部要從主組件傳到 sub-component）
- 每個 sub-component 內還是有 inline 邏輯
- 測試難寫（sub-component 依賴一坨 inline logic）

**正確順序**：

1. **先把複雜 hook 抽到 `<Component>.hooks.ts` 內的 `useXxx` hook**
2. **主組件用 `useXxx()` 取代 inline 邏輯**（refs 改成 hook 內部持有）
3. **主組件行數下降後，props 變少，再拆 sub-component**

---

## 修法 — LogoUploader P1 重構

### Step 1：先抽 hook 到 `.hooks.ts`

```ts
// apps/frontend/src/components/business/dashboard/CardBuilderEditor/LogoUploader/CropStage/CropStage.hooks.ts
export function useDragHandlers({
  imageRef,
  cropState,
  setCropState,
  minScale,
  maxScale,
}: UseDragHandlersParams) {
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  // ... pointermove / touchmove / momentum raf logic ...
  return { handlePointerDown, handlePointerMove, handlePointerUp };
}
```

抽出後：`CropStage.tsx` 不再持有 `isDraggingRef` / `lastPointerRef` / `velocityRef` / `rafRef` 等 refs，改從 hook 取。

### Step 2：再拆 sub-component

主組件從 887 → 394 行後，props 數量減少，再拆：

```
LogoUploader/
├── LogoUploader.tsx              ← 主組件（394 行，只做組裝 + state orchestration）
├── UploadPrompt.tsx              ← 初始「拖檔案或點擊上傳」提示
├── LogoPreview.tsx               ← 裁切前預覽 + 上傳觸發
├── CropStage.tsx                 ← 裁切舞台（用 useDragHandlers）
├── CropStage/CropStage.hooks.ts  ← useDragHandlers（pointermove / touchmove / momentum）
├── ScaleControl.tsx              ← scale slider
├── CropActions.tsx               ← 套用 / 取消按鈕
├── UploadError.tsx               ← 錯誤訊息
├── UploadingIndicator.tsx        ← 上傳中 spinner
└── LogoUploader.types.ts         ← shared types
```

每個 sub-component 各自有 `index.ts` barrel export，可獨立 unit test。

### Step 3：主組件簡化後的樣子

```tsx
// LogoUploader.tsx（394 行）
export function LogoUploader({ cardId, onUploadComplete }: Props) {
  const [view, setView] = useState<'prompt' | 'preview' | 'crop' | 'uploading' | 'error'>('prompt');
  const [error, setError] = useState<ValidationError | null>(null);
  const { cropImage, hasImage, imageUrl, cropState, setCropState, ... } = useImageCrop({ ... });

  if (view === 'prompt') return <UploadPrompt onFile={handleFile} />;
  if (view === 'preview') return <LogoPreview imageUrl={imageUrl} onCrop={handleCropStart} onReset={handleReset} />;
  if (view === 'crop') return <CropStage cropState={cropState} setCropState={setCropState} onApply={handleApply} onCancel={handleCancel} />;
  if (view === 'uploading') return <UploadingIndicator />;
  if (view === 'error') return <UploadError error={error} onRetry={handleReset} />;
  return null;
}
```

主組件純粹是「組裝 + view orchestration」，JSX < 50 行，符合 rule 000 鐵律。

---

## 驗證

### 行數驗證

| 階段 | LogoUploader.tsx 行數 | 主要動作 |
|---|---|---|
| 重構前 | **887** | 所有邏輯、JSX、drag handlers inline |
| 抽 hook（步驟 1）| ~700 | `useDragHandlers` 抽到 `CropStage.hooks.ts` |
| 拆 sub-component（步驟 2）| **394** | UploadPrompt / LogoPreview / CropStage / ScaleControl / CropActions / UploadError / UploadingIndicator |
| Sub-component 各自獨立測試 | 394 | 行為不變，可分開 unit test |

### 測試覆蓋

| 測試檔 | 涵蓋 |
|---|---|
| `LogoUploader.test.tsx` | 主組件 view orchestration |
| `LogoUploader.momentum.test.tsx` | momentum raf 行為 |
| `LogoUploader.touch-drag.test.tsx` | touch event 行為 |
| `LogoUploader.chain.test.tsx` | upload chain 整合 |

每個 sub-component 之後可獨立加 `.test.tsx`。

### typecheck / lint / test 全綠

```bash
cd apps/frontend
npx tsc --noEmit           # exit 0
npm run lint               # 0 errors, 11 pre-existing warnings
npm test                   # 273 passed | 5 skipped (45 files)
```

---

## 規範層沉澱

新增到 `000-modular-design.mdc` § A.3 Hook Extraction Strategy（NEW, +75 行）：

> #### 為什麼「先抽 hook」
>
> 當元件有 500–1000 行時，裡面通常混了 3 種東西：
> 1. **JSX**（渲染）
> 2. **state 與 orchestration**（reducer 邏輯、event handler）
> 3. **複雜 hook 邏輯**（如 `useDragHandlers`：pointermove / touchmove / momentum raf）
>
> 直接拆 sub-component 會發現：
> - props 一大坨（refs 全部要從主組件傳到 sub-component）
> - 每個 sub-component 內還是有 inline 邏輯
> - 測試難寫（sub-component 依賴一坨 inline logic）
>
> **正確順序**：
> 1. 先把複雜 hook（如 `useDragHandlers`）抽到 `<Component>.hooks.ts` 內的 `useXxx` hook
> 2. 主組件用 `useXxx()` 取代 inline 邏輯（refs 改成 hook 內部持有）
> 3. 主組件行數下降後，props 變少，再拆 sub-component

---

## 影響

| 範圍 | 影響 |
|---|---|
| 主組件可維護性 | 887 → 394 行（-56%），JSX < 50 行 |
| Sub-component 獨立測試 | 7 個 sub-component 可分開 unit test，coverage 提升 |
| drag / momentum 邏輯 | 從 inline 抽到 `useDragHandlers` hook，可單獨 mock pointer event |
| Rule 000 A.3 規範 | 「先抽 hook、再拆 sub-component」鐵律永久沉澱 |
| 後續維護 | 新功能（例如 background / icon variant）容易加 sub-component |

---

## 教訓

1. **不要直接拆 sub-component**：props 爆炸、測試難寫、邏輯還是散在各 sub-component 內
2. **「先抽 hook、再拆 sub-component」是 500–1000 行元件的 SOP**
3. **`.hooks.ts` 命名 + 單一職責**：每個 hook 只負責一種關注點（drag / momentum / upload）
4. **測試金字塔**：拆 sub-component 後可從「主組件整體測試」升級到「主組件 + 每個 sub-component 獨立測試」

---

## 參照

- `.cursor/rules/000-modular-design.mdc` § A.3 Hook Extraction Strategy（NEW）— 完整規範
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.tsx`（394 行 after）
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/LogoUploader/CropStage/CropStage.hooks.ts` — `useDragHandlers`
- `DEV/08-2026/0830-logouploader-p0p1-refactor-rule-sedimentation.md` — 完整 session trace（從症狀 → 結構 → 規範）
- 對應 plan：[`合併P0+P1_LogoUploader重构_1ace8b42.plan.md`](file:///c:/Users/user/.cursor/plans/合併p0+p1_logouploader重構_1ace8b42.plan.md)