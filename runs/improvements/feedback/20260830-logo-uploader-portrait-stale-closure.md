# LogoUploader Portrait Crop Position Regression — Stale Closure in handlePointerUp

## Metadata

- **日期**：2026-08-30
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：pending
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-image-upload`、`saome-task-router`（L2 Standard）
- **影響**：LogoUploader 垂直拖曳後，portrait / landscape 圖的 crop 位置會偏移 ~250 source px
- **嚴重度**：SEV-2（user-visible，UI mask 看起來正常但 export 偏移）

---

## 症狀

> 使用者回報：「直式圖片的裁切，選定的位置跟實際上傳的位置差別很多」

- **環境**：dev（本地 + 瀏覽器 UI），frontend `localhost:5173`
- **觸發條件**：上傳任何非正方形圖片（portrait 或 landscape），垂直拖曳後點擊「套用裁切」
- **觀察到的錯誤**：
  - UI mask 看起來對齊選定的位置
  - 但 export 出來的 crop 區域在垂直方向偏移 ~250 source px（拖 100 px 為例）
- **預期**：UI 選定的位置 = export 的 crop 中心

---

## 探針 / 重現

手動步驟（可重現）：

1. 開啟 CardBuilder Step 2，點擊「上傳 Logo」
2. 上傳 2000×3000 portrait 圖（或任何非正方形圖）
3. 垂直拖下圖片 100 px（offsetY = 100）
4. 點擊「套用裁切」
5. 觀察 PassCardPreview：crop 後的 logo 位置 vs 預期 mask 中心位置

**正確計算**：
- baseContainerW=400, baseContainerH=600（portrait aspect）
- focalY = 0.5 - 100/600 = 0.333
- srcY = 0.333 × 3000 - 500 = 500
- Crop 中心 srcY ≈ 1000

**實際計算**（bug 版本）：
- focalY = 0.5 - 100/400 = 0.25（用錯的分母 400 而非 600）
- srcY = 0.25 × 3000 - 500 = 250
- Crop 中心 srcY ≈ 750

**差異**：250 source px 偏移。

---

## 根因

### Stale closure in `handlePointerUp` useCallback

```typescript
// ❌ Bug-φ
const handlePointerUp = useCallback(() => {
  if (!isDraggingRef.current) return;
  isDraggingRef.current = false;
  setCropState((prev) => syncFocalFromOffset(prev, baseContainerW, baseContainerH));
}, []);  // ← 空 deps 導致 stale closure
```

`useCallback` 在第一次 render 時建立，captures `baseContainerW=400`、`baseContainerH=400`（initial placeholder，當 `naturalWidth=0` 時）。當圖片載入後：

```typescript
const baseContainerW = cropState.naturalWidth > 0
  ? Math.min(cropState.naturalWidth, BASE_CANVAS_WIDTH)
  : BASE_CANVAS_WIDTH;
const baseContainerH = cropState.naturalWidth > 0
  ? Math.round(baseContainerW * (cropState.naturalHeight / cropState.naturalWidth))
  : BASE_CANVAS_WIDTH;
```

對 portrait 2000×3000：`baseContainerH` 變成 `round(400 × 3000/2000) = 600`。
對 landscape 3000×2000：`baseContainerH` 變成 `round(400 × 2000/3000) = 267`。

但 `handlePointerUp` 從未被 recreate（empty deps），仍然使用 closure 裡的 `baseContainerH = 400`。

每次 pointer up 都會呼叫 `syncFocalFromOffset(prev, 400, 400)` 而非 `(prev, 400, 600)`，導致 `focalY = 0.5 - offsetY/400` 而非 `0.5 - offsetY/600`。

### 為什麼 portrait 特別嚴重

對正方形圖片（NH=NW），`baseContainerH = 400 = BASE_CANVAS_WIDTH`，placeholder 跟實際值相同 → 沒 bug。
對 portrait / landscape，`baseContainerH ≠ 400` → bug 顯現。

Portrait 因為 `baseH/baseW` 比值大（600/400 = 1.5），相對於 placeholder 400 的偏移幅度也最大，所以使用者最先在 portrait 上發現。

---

## 修法

### 加入 `baseContainerW` 與 `baseContainerH` 到 deps

```typescript
// ✅ Fix
const handlePointerUp = useCallback(() => {
  if (!isDraggingRef.current) return;
  isDraggingRef.current = false;

  setCropState((prev) => syncFocalFromOffset(prev, baseContainerW, baseContainerH));
}, [baseContainerW, baseContainerH]);  // ← 加入 deps
```

`baseContainerW` 和 `baseContainerH` 在圖片載入後會 recompute，deps 變化會 trigger useCallback recreate，React 重新 attach `onPointerUp` / `onPointerLeave` 到 DOM element。

### 為什麼不用其他修法

| 替代方案 | 為什麼不採用 |
|---|---|
| 改用 regular function（非 useCallback）| 每次 render 都新建，浪費；且會破壞 React.memo 優化 |
| 把 baseContainerW/H 從 CropState 移除，syncFocalFromOffset 內部從 naturalWidth/Height 算 | 改 function signature，破壞既有 17 個 conformance tests；範圍更大 |
| 改用 ref 存取最新 baseContainerW/H | 增加複雜度；沒有明顯好處 |

---

## 涉及檔案

| 檔案 | 變更 |
|------|------|
| `LogoUploader.tsx` | `handlePointerUp` useCallback deps 加 `baseContainerW`、`baseContainerH` |
| `useImageCrop.test.ts` | 新增 3 個 conformance test：portrait、landscape、square regression guards |

---

## 驗證

### 自動驗證（CI）

```bash
cd apps/frontend
npx vitest run src/hooks/useImageCrop.test.ts
# Test Files  1 passed (1)
# Tests  20 passed (20)   ← 原 17 + 新 3 個 Bug-φ guard
```

完整 frontend test suite：

```bash
npx vitest run
# Test Files  42 passed | 1 skipped (43)
# Tests  263 passed | 5 skipped (268)
```

### 手動驗證

1. 上傳 2000×3000 portrait
2. 拖下 100 px（offsetY = 100）
3. 點擊「套用裁切」
4. 觀察 PassCardPreview：crop 中心 srcY ≈ 1000（與 mask 中心對齊）

---

## 衍生

### 為什麼之前 17 個 conformance tests 沒抓到

原本的測試都用 `makeState` 配合 `naturalWidth: 1024, naturalHeight: 768`（4:3 landscape 比例），且手動傳入 `baseContainerW=400, baseContainerH=300` 給 `syncFocalFromOffset`。這些測試**單獨**測試 `syncFocalFromOffset` 的純函式行為，沒涵蓋**呼叫端**的 stale closure 場景。

新的測試（portrait/landscape regression guard）補上：

- Portrait 2000×3000：正確 focalY = 0.333（baseH=600），buggy focalY = 0.25（baseH=400 placeholder），差 ~250 source px
- Landscape 3000×2000：正確 focalY = 0.125（baseH=267），buggy focalY = 0.25（baseH=400 placeholder），差 ~250 source px
- Square 1000×1000：正確 = buggy = 0.25（no aspect change），證明 fix 沒破壞 square

### 既有 17 個 test 為何不夠

測試覆蓋的範圍：
- `syncFocalFromOffset` 純函式行為 ✓
- 各種 offsetX/offsetY 組合的 focal 計算 ✓
- Clamp 行為 ✓
- Scale invariance ✓

測試**未**涵蓋：
- ❌ LogoUploader 元件層的 callback closure 是否 stale
- ❌ non-square aspect 的 baseContainerH 變化情境
- ❌ `useCallback` deps 是否包含所有閉包變數

### 推論：為什麼 `applyScaleChange` 沒事

```typescript
function applyScaleChange(prev: CropState, targetScale: number): CropState {
  ...
  return syncFocalFromOffset({ ...prev, scale: newScale }, baseContainerW, baseContainerH);
}
```

這是 **regular function**（非 useCallback），每次 render 重新建立，captures 最新 `baseContainerW` / `baseContainerH`。所以沒有 stale closure 問題。

`handleScaleChange` useCallback 用 `applyScaleChange` 沒問題：每次 `baseContainerW` / `baseContainerH` 變化時 `applyScaleChange` 也跟著變，而 `handleScaleChange` 的 deps 是 `[containerW, containerH]`（== `[baseContainerW, baseContainerH]`）會 trigger recreate。

只有 `handlePointerUp` 的 deps 是空 `[]`，是唯一的漏洞。

---

## 自問

- **下次怎麼不犯？**
  - 任何 `useCallback` 的 deps 必含**所有** closure 內使用的變數，無一例外。可以用 ESLint rule `react-hooks/exhaustive-deps` 強制。
  - 寫 callback 時，**列舉 closure 變數清單**後逐一檢查是否進 deps
  - 「為什麼這個 useCallback 用空 deps？」需要正當理由（pure ref callback 等），不是預設

- **哪條 rule 該補？**
  - `028-image-uploader-pattern.mdc` § 11（已存在的 Crop Window Invariant）後可加 § 12：**Stale Closure in useCallback**，特別針對 baseContainerW/H 這類 first-render-placeholder 變數
  - 或在 `022-component-reuse.mdc` 或 general `000-modular-design.mdc` 加：**useCallback deps must include all closed-over variables that change over time**

- **跟既有 decisions 的關係？**
  - 沿用 `runs/improvements/feedback/20260826-0827-logo-crop-zoom-full-trace.md` 的 Crop Window Invariant 精神（UI mask ↔ export crop region 對齊）
  - 但這次 bug 不在公式（公式正確），在於 **呼叫端的 closure 沒傳對參數**

- **有沒有其他 useCallback 有類似風險？**
  - `handlePointerDown` deps = `[hasImage, state, cropState.offsetX, cropState.offsetY]` — 沒用 baseContainerW/H ✓ 安全
  - `handlePointerMove` deps = `[]` — 沒用任何 closure 變數（除了 refs）✓ 安全
  - `handleApplyCrop` deps = `[hasImage, imageRef, cropImage, templateId, onLogoUploaded, setIssuerLogo, t]` — 沒用 baseContainerW/H ✓ 安全
  - `handleScaleChange` deps = `[containerW, containerH]`（== baseContainerW/H）— ✓ 安全
  - `handleCancel` deps = `[resetCrop]` — ✓ 安全
  - **只有 `handlePointerUp` 漏 deps**

---

> 撰寫者：Josh ｜ 時間：2026-08-30 03:06