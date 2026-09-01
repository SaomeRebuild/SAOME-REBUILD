# useImageCrop Rectangular Support — Hook signature 從 square 升級為 rectangular

> 日期：2026-09-01
> 來源 commit：`09cd641` refactor(mediaAssetUploader): add background variant support
> 修法位置：
>   - `apps/frontend/src/hooks/useImageCrop.ts`（主檔 signature）
>   - `apps/frontend/src/hooks/useImageCrop.web.ts`（web binding）
>   - `apps/frontend/src/hooks/useImageCrop.native.ts`（native stub）
> 對齊 rule：Rule 028 § 11.1 Rectangular Crop Window（NEW）

## 背景

8/30 LogoUploader 重構時 `useImageCrop` 簽名是：

```ts
type UseImageCropOptions = {
  outputWidth: number;
  outputHeight: number | null;
  cropWindowSize: number;  // ← square 假設
  baseCanvasWidth: number;
  // ...
};
```

`cropWindowSize` 是**正方形邊長**，因為 logo 跟 icon 兩個 variant 都是 square crop（200×200 與 150×150）。Background 是第一個非 square variant，UI mask 必須是 **800×317**（aspect 2.52:1）才能 match 1860×738 export 比例。

## 根因

若繼續用 `cropWindowSize = 800`，UI mask 變 800×800 正方：

- 使用者看到的選取範圍：800×800 正方
- 實際 export 結果：1860×738 矩形

這違反 Rule 028 § 11 Crop Window Invariant — **UI mask 必須跟 export 比例一致**，否則使用者選的範圍跟實際輸出不一致，會誤判裁切結果。

**概念錯誤**：把 square 當作「最容易表達的 shape」，而非「最 specific 的 shape」。事實上 square 是 rectangle 的特例（`WIDTH === HEIGHT`），所以 rectangle 才是更 general 的形。

## 修法

### 1. Hook signature 向後相容擴充

```ts
// 之前
type UseImageCropOptions = {
  cropWindowSize: number;
};

// 之後
type UseImageCropOptions = {
  cropWindowWidth: number;
  cropWindowHeight: number;
  /** @deprecated Use cropWindowWidth/Height. Kept for callers that haven't migrated. */
  cropWindowSize?: number;
};
```

- 新簽名：`cropWindowWidth` + `cropWindowHeight`（推薦）
- 舊 `cropWindowSize` 留 fallback（內部 `cropWindowSize ? { w: cropWindowSize, h: cropWindowSize } : { w, h }`）

### 2. `CropImageFn` signature 同步

```ts
export type CropImageFn = (
  image: HTMLImageElement,
  cropState: CropState,
  cropWindowWidth: number,   // 取代 cropWindowSize
  cropWindowHeight: number,
  baseCanvasWidth: number,
) => Promise<Blob>;
```

### 3. `cropImage` 改用 `computeSrcRegion`

之前是 `computeSrcSquareSize` 回傳正方形 src region。改成 `computeSrcRegion` 接受 `cropWindowWidth/Height`，回傳矩形 `{ srcX, srcY, srcW, srcH }`。

### 4. MediaAssetUploader 從 union cropConfig 取 WIDTH/HEIGHT

```ts
const cropWindowLike = cropConfig as unknown as {
  CROP_WINDOW_WIDTH?: number;
  CROP_WINDOW_HEIGHT?: number;
  CROP_WINDOW_SIZE?: number;
};
const CROP_WINDOW_WIDTH = cropWindowLike.CROP_WINDOW_WIDTH ?? cropWindowLike.CROP_WINDOW_SIZE ?? 0;
const CROP_WINDOW_HEIGHT = cropWindowLike.CROP_WINDOW_HEIGHT ?? CROP_WINDOW_WIDTH;  // square case HEIGHT = WIDTH
```

這是必要的「structural cast」：union config 中 LogoCropConfig 有 `CROP_WINDOW_SIZE`、BackgroundCropConfig 有 `CROP_WINDOW_WIDTH/HEIGHT`，runtime 讀欄位前要做 fallback。

### 5. CropStage SVG mask 矩形化

```tsx
// 之前
<rect width={maskSize} height={maskSize} x={...} y={...} />

// 之後
<rect width={maskW} height={maskH} x={(stageW - maskW) / 2} y={(stageH - maskH) / 2} />
```

加上 frameLayer 同樣矩形化。

### 6. Responsive crop window height 由 output aspect 推導

```ts
const responsiveCropWindowHeight = cropConfig.OUTPUT_HEIGHT !== null
  ? Math.round(responsiveCropWindowWidth * (cropConfig.OUTPUT_HEIGHT / cropConfig.OUTPUT_WIDTH))
  : responsiveCropWindowWidth;
```

- logo（OUTPUT_HEIGHT: null）：height = width（square fallback）
- icon（OUTPUT_HEIGHT: OUTPUT_WIDTH = 720）：height = width × 1 = width
- background（OUTPUT_HEIGHT = 738, OUTPUT_WIDTH = 1860）：height = width × 738/1860 = 0.397 × width

## 學習

### Hook signature 設計原則

**「最容易表達的 shape」** 應該是**最 general 的形**，而非**最 specific 的特例**。

- 錯：先寫 square (`cropWindowSize: number`)，再加 rectangular (`cropWindowWidth: number, cropWindowHeight: number`)。第二次重構時要 deprecate 舊欄位。
- 對：一開始就寫 rectangular (`width, height`)，square 是 `width === height` 的特例。第一次就 correct。

### 向後相容 vs breaking change

這次選擇**向後相容**（保留 `cropWindowSize` 作為 fallback），理由：

1. LogoUploader / IconUploader 還在用 `cropWindowSize`（雖已被 MediaAssetUploader 取代）
2. Vitest 51 個 test file 全綠不退步
3. 既有測試可分階段 migrate

未來 v2 可以把 `cropWindowSize` 完全移除，但要等所有 caller 都 migrate 完。

### 為什麼用 union 而非 sub-class

候選設計：

```ts
// A. Sub-class
class SquareCropConfig { ... }
class RectangularCropConfig extends SquareCropConfig { ... }

// B. Union + structural cast（採用）
type MediaAssetCropConfig = LogoCropConfig | IconCropConfig | BackgroundCropConfig;
```

選 **B**。理由：

- sub-class 在 TypeScript 中要 `instanceof` 判斷，比 structural cast 囉嗦
- union + structural cast 更接近「shape-based typing」哲學
- 從 `as const` 推導出來的 type 結構簡單，加 variant 只要擴充 union 成員

## Rule update

Rule 028 § 11 補「§ 11.1 Rectangular Crop Window」：

- `cropWindowWidth` × `cropWindowHeight`（取代 `cropWindowSize`）
- Square 是 rectangle 的特例（`HEIGHT === WIDTH`）
- `computeSrcRegion` 公式（取代 `computeSrcSquareSize`）
- 向後相容策略（保留舊欄位 fallback）

## Cross-link

- Master DEV LOG：Round 2 第 2–3 點 — `DEV/08-2026/0901-background-uploader-implementation.md`
- Rule 028 § 11.1 Rectangular Crop Window（NEW）
- Rule 028 § 12.1 Stage Width Floor（feedback #1 同步）
- Rule 028 § 16 Variant Config Bundle Pattern（feedback #2 同步）
- SKILL saome-image-upload § Crop Window Invariant 補 rectangular 段
- Rule 024 Hook Split Pattern（`useImageCrop.web.ts` / `.native.ts` 雙檔）
