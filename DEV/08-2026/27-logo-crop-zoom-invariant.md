# LogoUploader Crop Zoom — Mask Invariant + Bug-C Fix（Aug 26-27, 2026）

## Metadata

- **日期**：2026-08-27
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：local only（pending commit）
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-image-upload`、`saome-task-router`（L2 Standard）

---

## 症狀

> 使用者回報：「修改有成功，但中間的裁切區域跟著圖片一起放大縮小了」+ 「裁切區域跟實際裁切的範圍，往左了一點」

- **環境**：dev（本地 + 瀏覽器 UI）
- **觸發條件**：上傳 1024×768 圖片，crop 完成後檢視紅色方塊位置
- **觀察到的錯誤**：
  1. scale=2 時，UI mask 視覺變大（mask 跟 image 一起 scale）
  2. UI mask 看到的紅色方塊在中央，export 出來的 crop 區域多了黑底（位置不一致）
- **預期 vs 實際**：scale=2 時 mask 應固定 200×200，export 應跟 UI mask 對齊

---

## 探針 / 重現

手動步驟（可重現）：

1. 開啟 CardBuilder Step 2，點擊「上傳 Logo」
2. 上傳 1024×768 圖片（黑底 + 中央偏左紅色方塊）
3. 點擊「套用裁切」
4. scale=1，觀察：mask 固定 200×200，紅色方塊在 mask 左側
5. scale=2，觀察：**mask 變大 400×400（Bug-A）**
6. 點「上傳」，檢查 PassCardPreview：紅色方塊位置偏移（Bug-B）

---

## 根因

### Bug-A：Image + Mask + Border 共用同一 transform: scale()

原本 inner canvas 內 image + SVG mask + border 全部包在一起套 `transform: scale(scale)`，導致 mask 跟著圖片一起放大，zoom 語意從「看更細節」變成「選更大範圍」。

### Bug-B：cropImage 用 min(NW, NH)/scale 算 srcSquareSize

對 1024×768 src：
- 舊公式：`min(1024, 768) / 1 = 768` → export 768×768
- UI mask 在 src 中實際 size：`200/400 × 1024 = 512×512`
- **差 1.5 倍 → UI 看到的 crop 框跟 export 結果不一致**

### Bug-C：syncFocalFromOffset 多了 * scale

drag offset 反推 focalX 的公式多乘了 scale：
```typescript
// ❌ 錯誤
const focalX = 0.5 - (offsetX * scale) / baseContainerW;

// ✅ 正確
const focalX = 0.5 - offsetX / baseContainerW;
```
幾何推導：`mask center in image content normalized = (-offsetX / baseW, ...)`，scale 在分子分母對稱消掉。

---

## 修法

### 1. 三層結構（Bug-A）

```
outer container (fixed layout)
├── inner canvas (transform: scale(scale)) — 只含 <img>
├── SVG mask (NOT scaled, fixed 200×200)
└── border (NOT scaled, fixed 200×200)
```

### 2. srcSquareSize 公式（Bug-B）

```typescript
const srcSquareSize = (cropWindowSize / (effectiveBaseCanvasWidth * scale)) * naturalWidth;
```

### 3. 小圖 corner case（NW < 400）

新增 `resolvedBaseCanvasWidth` 到 cropState，LogoUploader useEffect sync `baseContainerW`。

### 4. syncFocalFromOffset（Bug-C）

移除 `* scale`，`syncFocalFromOffset` 抽出 module-level export function 供 test 呼叫。

### 5. 常量集中

`LOGO_CROP_CONFIG` 新增 `CROP_WINDOW_SIZE: 200` + `BASE_CANVAS_WIDTH: 400`。

### 涉及的檔案

| 檔案 | 變更 |
|------|------|
| `LogoUploader.tsx` | 三層結構；syncFocalFromOffset 抽出；useEffect sync |
| `useImageCrop.ts` | resolvedBaseCanvasWidth；effectiveBaseCanvasWidth |
| `card-images.ts` | LOGO_CROP_CONFIG 新增 CROP_WINDOW_SIZE / BASE_CANVAS_WIDTH |
| `useImageCrop.test.ts` | **新建** 17 個 conformance tests |
| `LogoUploader.test.tsx` | mock 補 setCropState |
| `saome-image-upload/SKILL.md` | § Crop Window Invariant |
| `028-image-uploader-pattern.mdc` | § 11 Crop Window Invariant |
| `design-system/MASTER.md` | § 13 Crop Window Pattern |
| `runs/decisions/2026-08-27-logo-crop-zoom-invariant-mask.md` | Decision Log |
| `runs/improvements/feedback/20260826-0827-logo-crop-zoom-full-trace.md` | Feedback trace |

---

## 衍生

### 17 個 Conformance Tests

`src/hooks/useImageCrop.test.ts` 分 4 個 section：

| Section | 涵蓋 |
|---------|------|
| srcSquareSize formula | scale=1/2/3, focal 移動, clamp, output size |
| UI mask binding | cropWindowSize 比例, defaults 非零, old buggy formula regression |
| 小圖 corner case | resolvedBaseCanvasWidth, fallback, 正確性 |
| syncFocalFromOffset 方向 | drag right/left/up/down, no drag, clamp, **Bug-C regression guard** |

### 待修（不在本 PR）

- `syncFocalFromOffset` 公式從 LogoUploader 抽出到 `packages/shared/logic/cropGeometry.ts`（RN-friendly）
- BackgroundUploader（800×800 crop）/ IconUploader（256×256 crop）沿用相同 pattern

---

## 自問

- **下次怎麼不犯？**
  - 任何「image + overlay」互動，**先把 overlay 跟 image 的 transform 鏈拉開**再寫公式
  - 任何 focal/offset 公式，**先做 dimension analysis**（確認每個變數的單位）
  - **抽成 pure function + export for test** 是確保公式可測試的最好方法
  - Bug-C（多乘 scale）是最容易犯的錯誤：直覺上 zoom in → 所有跟 offset 相關的都乘 scale，但幾何推導後 scale 會對稱消掉

- **哪條 rule 該補？**
  - `028-image-uploader-pattern.mdc` § 11 已加 Crop Window Invariant ✅
  - `024-mobile-future-proof.mdc` 強化：transform chain 必須避免 DOM 耦合

---

> 撰寫者：Josh ｜ 時間：2026-08-27
