# LogoUploader Crop Zoom Full Trace（Aug 26-27, 2026）

## 概覽

延續 2026-08-23 LogoUploader 實作，本週 session 專注於 crop zoom 行為。兩個關聯 bug：

| Bug | 症狀 | 根因 |
|-----|------|------|
| **A：Mask 跟著 scale 變大** | scale=2 時 mask 框視覺變 400×400，使用者以為「選更大範圍」| Image + SVG mask + border 共用同一 transform: scale 鏈 |
| **B：UI crop 框跟 export crop region 不一致** | UI 看到紅色方塊偏左，export 出來的 crop 區域跟 UI 框不對應 | `cropImage` 用 `min(NW, NH)/scale` 算 srcSquareSize，跟 UI mask 在 src 中的實際 size 不同 |

兩個 bug 同源：**crop window 跟 image 共用 transform 鏈**，導致「visual zoom」跟「semantic crop region」耦合。

詳見 `runs/decisions/2026-08-27-logo-crop-zoom-invariant-mask.md`（決策記錄）。

---

## Bug A：Mask 跟著 scale 變大

### 症狀

User 回報：「修改有成功，但中間的裁切區域跟著圖片一起放大縮小了，這樣沒有起到選定裁切範圍的作用」

scale=2 時，整個 inner canvas（含 SVG mask + 白色 border）一起 scale 2 倍，mask 視覺 = 400×400，**使用者預期是 zoom in 看 src 細節，但視覺上像是「選更大範圍」**。

### 根因

原本架構是「image + mask + border 全部包在同一個 inner canvas 內，inner canvas 套 `transform: scale(scale)`」。這個架構一開始的目的是保證 mask hole 跟 border 對齊（兩者同步 scale）。

但這違反使用者語意：**crop 框應該是「選定範圍」的視覺指示器，不該隨 zoom 變大**。

### 修法

把 SVG mask 跟 border 從 inner canvas 內搬到 outer container，**不套 scale**：

```
outer container (fixed layout, pointer events)
├── inner canvas (transform: scale(scale), 只含 image)
│   └── <img>
├── SVG mask (不 scale, fixed 200×200 hole at center)
└── border (不 scale, fixed 200×200 frame at center)
```

只有 image 套 scale，所以「crop 框永遠 200×200 視覺，框內看到的 src 細節隨 scale 增加」。

### 驗證

- scale=1: image visual 400×300, mask 200×200 = 50% of image
- scale=2: image visual 800×600, mask 200×200 = 25% of image (4x 細節)
- scale=3: image visual 1200×900, mask 200×200 = 16.7% of image (9x 細節)

User 確認：「成功了」

---

## Bug B：UI crop 框跟 export crop region 不一致

### 症狀

User 上傳一張 1024×768 landscape 圖（黑底 + 中央偏左紅色方塊），crop 出來結果：
- UI 顯示 mask 框在 image 中央，紅色方塊在 mask 框內偏左
- Export 出來的圖：紅色方塊 + 額外的黑底區域，**整個 crop 範圍比 UI 看到的框大**

User 回報：「裁切區域跟實際裁切的範圍，往左了一點，也就是裁切區不是實際上傳的範圍」

### 根因

`cropImage()` 用 `squareSize = min(NW, NH) / scale`：

```typescript
// ❌ 原本
const sourceSizeW = naturalWidth / scale;
const sourceSizeH = naturalHeight / scale;
const squareSize = Math.min(sourceSizeW, sourceSizeH);
const srcX = focalX * naturalWidth - squareSize / 2;
```

對 1024×768 src, scale=1：
- squareSize = min(1024, 768) = 768
- export region = 768×768 square
- srcX = 0.5 × 1024 - 384 = 128, srcY = 0
- export src 範圍 = (128, 0) to (896, 768) — 包含整個 src 高度

但 UI mask 在 src 中的實際 size：
- baseW=400, baseH=300 (canvas aspect = src aspect)
- mask 200×200 在 base canvas 中央
- mask 在 src 中比例 = 200/400 × 1024 = 512 wide, 200/300 × 768 = 512 tall
- **UI mask 對應 src 512×512 square**

**兩個 size 差 1.5 倍**：
- UI 看到：512×512 square（mask 在 src 中的投影）
- Export 給：768×768 square（min(NW, NH)）
- User 看到 mask 框對齊 src 中心，但 export 出來 src region 多出 256×256 的額外邊界

紅色方塊在 src 中央偏左 → mask 框看到紅色方塊 + 旁邊黑底 → export 拿到 src (128, 0)-(896, 768) 包含整個 src 高度 → **UI 跟 export 視覺位置不一致**。

### 修法

`cropImage()` 改用 UI mask 在 src 中的實際 size：

```typescript
// ✅ 修正
const srcSquareSize = (cropWindowSize / (baseCanvasWidth * scale)) * naturalWidth;
const srcX = focalX * naturalWidth - srcSquareSize / 2;
```

對 1024×768, scale=1, cropWindowSize=200, baseCanvasWidth=400:
- srcSquareSize = (200 / 400) × 1024 = 512
- export region = 512×512 square

跟 UI mask 在 src 中的 size 嚴格對齊。

### Hook API 變更

`useImageCrop` 新增 options：
- `cropWindowSize` (default 200)
- `baseCanvasWidth` (default 400)

LogoUploader 從 module-level const 傳入：
```typescript
useImageCrop({
  cropWindowSize: CROP_WINDOW_SIZE,  // 200
  baseCanvasWidth: MAX_PREVIEW_W,    // 400
  ...
});
```

### 為什麼不把常數直接寫進 hook

`useImageCrop` 是 shared hook，未來可能被其他 image crop 元件（BackgroundUploader、IconUploader）用。每個元件的 crop window size 跟 base canvas 不一樣：
- LogoUploader: 200×200 crop, 400px base
- BackgroundUploader: 1920×1080 crop, 800px base
- IconUploader: 256×256 crop, 256px base

常數必須由呼叫端傳入。

---

## 待修（已知限制）

### 限制 1：小圖 (NW < 400) baseCanvasWidth 不一致

`baseContainerW = min(NW, MAX_PREVIEW_W)`. 對 NW < 400：
- UI 用 `baseContainerW = NW`
- Hook 用 `baseCanvasWidth = MAX_PREVIEW_W = 400`

Hook 算出的 srcSquareSize 比 UI 預期偏小。

**修法**：把 `baseContainerW` 存進 cropState（image load 後動態計算）。
✅ **已修**：resolvedBaseCanvasWidth 進 cropState + useEffect sync。

### Bug C：syncFocalFromOffset 多乘了 scale（drag 後 crop 飄移）

#### 根因

`syncFocalFromOffset` 原本公式：
```typescript
// ❌ 錯誤
const focalX = 0.5 - (offsetX * scale) / baseContainerW;
```

zoom in 後 drag，會 double-correct focal：scale=2 + drag 100px → `0.5 - 200/400 = 0.0`（過頭）；正確應該是 `0.5 - 100/400 = 0.25`。

#### 正確幾何推導

Mask center 在 image content 中 normalized = `(-offsetX / baseW, -offsetY / baseH)`，所以 `focalX = 0.5 - offsetX / baseW`（scale 在分子分母對稱消掉）。

#### 修法

移除 `* scale`：
```typescript
// ✅ 正確
const focalX = 0.5 - offsetX / baseContainerW;
const focalY = 0.5 - offsetY / baseContainerH;
```

#### Conformance test

17 個 tests 在 `src/hooks/useImageCrop.test.ts` 涵蓋：
- scale=1/2/3 的 srcSquareSize 正確性
- focal 移動（clamp）
- cropWindowSize 比例改變
- 小圖 resolvedBaseCanvasWidth fallback
- drag 方向：drag right → focalX 減小；drag left → focalX 增大；無 drag → focal=0.5
- **Bug-A regression guard**：scale=1 vs scale=2 的 focalX 必須相同（same drag distance, same visual shift）

### 限制 2：drag offset 對應的 src 座標方向

~~`applyScaleChange` 用 `0.5 - offsetX * scale / baseW` 反推 focalX~~ ✅ **已修**（Bug-C）。
~~方向可能錯~~ → 17 個 conformance tests 斷言方向正確。

### 限制 3：缺 conformance test

~~jsdom canvas drawImage mock 困難~~ ✅ **已修**（用純函式測試，不用 DOM/canvas）。

### 限制 4：小圖 corner case

~~NW < 400 時 baseContainerW 跟 baseCanvasWidth 不一致~~ ✅ **已修**（resolvedBaseCanvasWidth 進 cropState）。

---

## 衍生 rule / skill 變更

| 位置 | 變更 |
|------|------|
| `runs/decisions/2026-08-27-logo-crop-zoom-invariant-mask.md` | 新增（決策記錄） |
| `.cursor/skills/saome-image-upload/SKILL.md` | 新增 § Crop Window Invariant + srcSquareSize 公式 |
| `.cursor/rules/028-image-uploader-pattern.mdc` | 新增 § 11 Crop Window Invariant |
| `design-system/MASTER.md` | 新增 § 13 Crop Window Pattern |
| `packages/shared/constants/card-images.ts` | 新增 `CROP_WINDOW_SIZE` + `BASE_CANVAS_WIDTH` |
| `apps/frontend/src/hooks/useImageCrop.test.ts` | **新建** 17 個 conformance tests |
| `apps/frontend/src/hooks/useImageCrop.ts` | 新增 `resolvedBaseCanvasWidth` 修小圖 corner case |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.tsx` | syncFocalFromOffset 抽出 module-level export；修 Bug-C；常量集中 LOGO_CROP_CONFIG |

---

## 自問

- **下次怎麼不犯？**
  - 任何「image + overlay」互動，**先把 overlay 跟 image 的 transform 鏈拉開**再寫公式
  - 「UI 視覺框 size」跟「export crop size」是同一概念兩面，**必須共用同一個常數**
  - 寫 crop 公式前，**先畫 UI mask 在 src 中的 size 對應圖**（focalX + squareSize → src range）

- **哪條 rule 該補強？**
  - 新增 `frontend/028-image-crop-invariant.mdc`：mask size ↔ export size 對齊鐵律
  - 強化 `frontend/024-mobile-future-proof.mdc`：transform chain 必須避免 DOM 耦合

- **跟既有 decisions 的關係？**
  - `2026-08-21-card-type-extension-pattern.md`：常數集中在 shared 的精神對齊
  - 但本 case 是 UI 常數（CSS px），不是 domain 常數，所以放在 component module 而非 shared/constants
  - 未來 srcSquareSize 公式應搬到 `packages/shared/logic/cropGeometry.ts` 為純函式
