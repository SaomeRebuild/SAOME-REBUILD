# LogoUploader Mobile Drag Stutter — React Reconciliation During pointermove

## Metadata

- **日期**：2026-08-30
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：pending
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-image-upload`、`saome-task-router`（L2 Standard）
- **影響**：LogoUploader 手機拖曳時，圖片跟不上手指速度，使用者感覺「一次只能移動一點，要滑好幾次」「動作大一點了但本質上還是一點一點拉」
- **嚴重度**：SEV-3（user-visible, mobile UX only, but breaks the entire crop experience）

---

## 症狀

> 使用者回報（第二次 iteration）：
> - 「手機上還是只能用手指一點一點的拉動圖片」
> - 「雖然感覺好像動作大一點了」
> - 「但本質上還是只能一點點拉，而不是順滑的移動」

第一輪 2026-08-30 修了：
- `VIEWPORT_PADDING` 48 → 96（X 軸溢出）
- `handlePointerUp` stale closure（portrait 裁切偏移）
- `DRAG_SENSITIVITY` 1.0 → 1.5 + momentum 參數調整

第一輪修了「一次只能移動一點」（= 量太少）但沒修「順滑」（= 視覺跟不上手指）。

---

## 探針 / 重現

iPhone 12 Pro Max（428×926）或任何 mobile viewport：

1. 開啟 CardBuilder Step 3，選 Logo 上傳
2. 進入 cropping state
3. 手指快速拖動圖片
4. **觀察**：圖片以「跳格」方式跟隨手指，而非連續平滑跟隨

**預期**：圖片應該像 iOS / Android 內建 photo cropper 一樣，指頭到哪、圖片到哪。

---

## 根因

### React reconciliation 在每個 pointermove 都會觸發全 LogoUploader 重渲染

```typescript
// ❌ 舊版 handlePointerMove
const handlePointerMove = useCallback((e) => {
  // ...
  setCropState((prev) => ({
    ...prev,
    offsetX: offsetStartRef.current.x + dx,
    offsetY: offsetStartRef.current.y + dy,
  }));
}, []);
```

每個 pointermove（mobile 上 60-120 Hz）都呼叫 `setCropState`。React 會 reconcile 整個 LogoUploader 元件，包括：

- crop stage 內的 SVG mask（含 `<defs>`、`<mask>`、`<rect>`）
- 200×200 crop window
- scale slider + ZoomIn/Out icons
- 三個 action buttons（Cancel / Reset / Apply）

SVG mask + 多層 nesting 是 reconciliation 熱點。當 React 在忙 SVG diff 的時候，下一個 pointermove 已經到了，導致中間的 pointermove 被「丟掉」→ 圖片以跳格方式前進而非連續。

第一輪加 `DRAG_SENSITIVITY = 1.5` 讓**量**變大（每次跳格更遠），但**視覺跟不上手指**的問題沒解決 → 使用者感覺「還是一點一點拉」。

### 為什麼其他 React drag UI 沒這個問題

他們通常用兩種模式之一：

1. **Direct DOM manipulation**：拖曳期間直接寫 `el.style.transform`，pointerup 才 sync 到 React state
2. **`flushSync` 強制同步渲染**：每個 pointermove 都 sync 觸發 re-render

SAOME 用了方案 1 的反模式（每個 pointermove 都 setCropState），而且 LogoUploader 的 render tree 比一般 drag UI 複雜（SVG mask）。

---

## 修法

### Pointermove 完全繞過 React，用 ref + 直接 DOM 寫入

```typescript
// ✅ 新版 handlePointerMove
const handlePointerMove = useCallback((e) => {
  // ...
  const newX = offsetStartRef.current.x + dx;
  const newY = offsetStartRef.current.y + dy;

  // 寫進 ref（不觸發 re-render）+ 直接寫 img.style.transform
  liveOffsetXRef.current = newX;
  liveOffsetYRef.current = newY;
  const img = imageRef.current;
  if (img) {
    img.style.transform = `translate(${newX}px, ${newY}px)`;
  }
  // 不呼叫 setCropState
}, []);
```

### 三層防護確保 transform 不被 React 覆蓋

1. **Pointermove**：直接 DOM 寫入（最快的視覺更新路徑）
2. **calculateImageStyle**：拖曳期間（`isDraggingRef.current === true`）優先讀 live ref，就算 React 因其他原因重渲染也不會跳回
3. **Pointerup**：才把最終 offset sync 到 React state，再 `syncFocalFromOffset` 算正確的 focal

### 為什麼 momentum rAF 仍保留 setCropState

Momentum 是 rAF loop，頻率固定 60fps，React reconciliation 來得及跟上。保留 `setCropState` 是為了：

- 既有 momentum test（`LogoUploader.momentum.test.tsx`）斷言 `setCropState.mock.calls.length` 在 rAF tick 期間遞增
- Direct DOM 跟 React state 雙寫，確保兩者永遠一致

直接 DOM 寫入是「保險絲」，React state 是「真相」。如果哪天 React state 沒跟上（測試、devtools 等），視覺依然正確。

### DRAG_SENSITIVITY 1.5 → 2.0

第一輪 1.5x 還是不夠，2.0x 對齊原生 iOS / Android photo cropper 的手感：

| sensitivity | 100px 手指 → offset | focal 移動 |
|---|---|---|
| 1.0x | 100px | 25%（從 0.5 到 0.25）|
| 1.5x | 150px | 37.5% |
| **2.0x** | **200px** | **50%（直達邊緣）** |

---

## 涉及檔案

| 檔案 | 變更 |
|---|---|
| `LogoUploader.tsx` | 加 `liveOffsetXRef/YRef`；`handlePointerMove` 改寫為 ref + direct DOM；`handlePointerUp` 從 live refs 讀最終值 sync 到 React state；momentum rAF tick 也走雙寫路徑；`calculateImageStyle` 在拖曳期間優先用 live ref；`DRAG_SENSITIVITY` 1.5 → 2.0 |

---

## 驗證

### 自動驗證

```bash
cd apps/frontend
npx tsc -b --noEmit
# exit 0, 無錯誤

npx vitest run
# Test Files  44 passed | 1 skipped (45)
# Tests       276 passed | 5 skipped (281)
```

Momentum 測試（`LogoUploader.momentum.test.tsx`）：
- pointer events fire React handlers ✓
- fast drag schedules momentum ✓
- slow drag does NOT schedule momentum ✓
- new pointer down during momentum cancels it ✓
- unmount cancels in-flight momentum ✓

i18n smoke test：
```bash
npm run verify:i18n
# verify-i18n-keys: OK — 14 namespace(s) passed (28 locale files)
```

### 手動驗證

1. 開 dev frontend（`localhost:5173`）
2. iPhone 12 Pro Max 模擬（428×926）
3. 上傳 2000×3000 portrait 圖
4. 手指快速拖動
5. **觀察**：圖片應該連續平滑跟隨手指（不再跳格）✓

---

## 衍生

### 第一輪為什麼沒抓到

第一輪只調了「量」（DRAG_SENSITIVITY 1.5），沒調「順暢度」（React reconciliation）。使用者 feedback 說「量變大但還是跳格」才暴露問題。

教訓：拖曳 UX 有兩個獨立維度：
1. **量**：每次 swipe 移動多少（sensitivity）
2. **順暢度**：視覺跟手指的對齊程度（reconciliation 延遲）

只調 1 沒調 2，使用者會覺得「跳格更大但還是跳格」。

### 為什麼不直接用 `flushSync`

`flushSync` 強制 React 同步渲染，會阻塞瀏覽器主線程。在 60-120 Hz 的 pointermove 下，主線程會被榨乾，反而更卡。

ref + direct DOM 是更乾淨的做法：React 完全沒參與拖曳的視覺更新，只在拖曳結束時接回去。

### 其他 React drag UI 的 audit

`useStorage`（zustand persist）、`useImageCrop` 等都有 drag/tooltip/dialog 等互動元件，但這些都不在 60Hz 更新 hot path 上，目前不需修。

---

## 自問

- **下次怎麼不犯？**
  - 任何「每個 pointermove 都 setState」的 component，**必走** ref + direct DOM pattern
  - SVG mask、多層 nesting、複雜 children → drag 必走 direct DOM
  - Code review checklist 加一項：「這個 component 在 pointermove hot path 上嗎？render tree 複雜嗎？」

- **哪條 rule 該補？**
  - `.cursor/rules/frontend/025-vibe-coding-l2-checklist.mdc` § 2 元件結構 加一條：**Drag 必走 ref + direct DOM，不要每 frame setState**
  - 或開新 rule `029-react-drag-pattern.mdc`

- **有沒有其他 pointermove hot path 在 setState？**
  - `useImageCrop` 的 `loadImage` 只跑一次（OK）
  - `useAuthRedirect` 不在 pointermove path（OK）
  - `useLoginLockout` 沒 drag（OK）
  - 目前只有 LogoUploader 一個在 pointermove hot path 上

---

> 撰寫者：Josh ｜ 時間：2026-08-30 05:55