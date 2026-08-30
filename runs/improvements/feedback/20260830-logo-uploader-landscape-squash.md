# LogoUploader Landscape Image Export Squash — Missing naturalHeight Cap in srcSquareSize

## Metadata

- **日期**：2026-08-30
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：pending
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-image-upload`、`saome-task-router`（L2 Standard）
- **影響**：橫式圖（landscape）上傳後，export 的 logo 會被縱向拉伸填滿 960×960 canvas
- **嚴重度**：SEV-2（user-visible，UI mask 看起來正常但 export 比例失真）

---

## 症狀

> 使用者回報：「我把橫式的 logo 上傳，套用裁切後 logo 看起來被拉長 / 變形」

- **環境**：dev（本地 + 瀏覽器 UI），frontend `localhost:5173`
- **觸發條件**：上傳任何寬度遠大於高度的 landscape 圖片（例如 2000×600、3000×800）
- **觀察到的錯誤**：
  - UI mask 內顯示的 crop 區域比例正確
  - export 出來的 logo 垂直方向被拉伸（squashed），填滿 960×960
  - 越極端的 landscape（10:1）變形越嚴重
- **預期**：UI 看到的 mask 比例 = export 出來的 crop 比例（永遠保持 srcW === srcH 的 src-side square）

---

## 探針 / 重現

手動步驟（可重現）：

1. 開啟 CardBuilder Step 2，點擊「上傳 Logo」
2. 上傳 2000×600 landscape 圖（寬高比 10:3）
3. 不調整焦點 / 縮放（保留 focalX=focalY=0.5, scale=1）
4. 點擊「套用裁切」
5. 觀察 PassCardPreview：export logo 應該是 600×600 方形 src region，卻出現 1000×600 矩形 → Canvas 拉伸成 960×960 的變形圖

**正確計算**（修好後）：
- cropWindowSize=200, baseW=400, scale=1
- srcSquareSize = min((200 / (400×1)) × 2000, 600) = min(1000, 600) = **600**
- srcX = 0.5 × 2000 - 300 = 700，srcY = 0.5 × 600 - 300 = 0
- srcW = srcH = 600（**方形**）

**實際計算**（bug 版本，沒有 cap）：
- srcSquareSize = (200 / (400×1)) × 2000 = **1000**（已經超過 naturalHeight=600）
- srcX = 0.5 × 2000 - 500 = 500
- srcW = min(1000, 2000 - 500) = **1000**
- srcH = min(1000, 600 - 0) = **600**（被 clamp 住）
- → srcW=1000, srcH=600（非方形，被 Canvas 拉伸成 960×960）

**差異**：export 的 src 區域比預期多 1.67× 寬度，垂直方向被擠壓。

---

## 根因

### `useImageCrop.cropImage()` 的公式缺 `naturalHeight` cap

```typescript
// ❌ Bug：缺少 naturalHeight cap（useImageCrop.ts cropImage 內）
const srcSquareSize = (cropWindowSize / (effectiveBaseCanvasWidth * scale)) * naturalWidth;
//                              ^^^^ 只看 width-based fraction

// ✅ 修好後：加上 naturalHeight cap
const srcSquareSize = computeSrcSquareSize(
  cropWindowSize,
  effectiveBaseCanvasWidth,
  scale,
  naturalWidth,
  naturalHeight,
);
// 內部 = Math.min((cropWindowSize / (baseW * scale)) * naturalWidth, naturalHeight);
```

### 為什麼這個 cap 是必要的

UI 設計假設：

1. Image 渲染在 `baseCanvasWidth × baseCanvasHeight` 的 canvas 內，aspect match src
2. UI mask 是固定 `cropWindowSize × cropWindowSize` 的方框（200×200）
3. mask 在 stage 中心；zoom 從中心 scale
4. src-side 的方框大小 = `(cropWindowSize / (baseW × scale)) × NW`（width-based fraction）

**這條公式在 src aspect ratio = 1 的時候是 square**。但 landscape 圖（NW > NH）情況下：

- width-based 計算會得到比 NH 大的方框
- 套用到 src 時 srcW = srcSquareSize（很大），srcH = NH - srcY（被 clamp 變小）
- srcW !== srcH → Canvas `drawImage` 拉伸成 960×960

**修法的本質**：當 width-based 計算超過 naturalHeight 時，用 naturalHeight 當上限（因為 aspect-matched canvas 在垂直方向最多就是 NH 大）。

---

## 修復

### `useImageCrop.ts`

1. 抽出 pure function `computeSrcSquareSize`，放在檔案頂部（line ~85），含完整 JSDoc 解釋為什麼需要 cap。
2. `cropImage()` 改成呼叫這個 function。

```typescript
// apps/frontend/src/hooks/useImageCrop.ts
export function computeSrcSquareSize(
  cropWindowSize: number,
  effectiveBaseCanvasWidth: number,
  scale: number,
  naturalWidth: number,
  naturalHeight: number,
): number {
  return Math.min(
    (cropWindowSize / (effectiveBaseCanvasWidth * scale)) * naturalWidth,
    naturalHeight,
  );
}
```

### `useImageCrop.test.ts`

1. 移除 local duplicate `function computeSrcSquareSize(...)`。
2. 改成 `import { computeSrcSquareSize } from '@/hooks/useImageCrop'`。
3. 新增 § 2.5「Landscape srcW===srcH invariant」8 個 conformance test case：

| Case | 來源尺寸 | srcSquareSize 預期 | srcW === srcH |
|---|---|---|---|
| 極端 landscape（10:1） | 2000×200 | 200（cap 生效） | ✅ |
| 寬 landscape（10:3） | 2000×600 | 600（cap 生效） | ✅ |
| 寬 landscape 變形 | 2000×600 | 600（不是 1000） | ✅ |
| 溫和 landscape（16:9） | 1920×1080 | 960（cap 不生效） | ✅ |
| portrait（1:3） | 600×2000 | 300（cap 不生效） | ✅ |
| 正方形 | 500×500 | 250（cap 不生效） | ✅ |
| landscape + zoom=2 | 2000×600 | 500 | ✅ |
| landscape + zoom=3 | 2000×200 | 200 | ✅ |

`computeSrcRect`（focal→srcX/srcY 計算）依然保留為 test-local 函式，因為它不屬於 production surface，僅用於 assertion 幾何比對。

---

## 為什麼這個 bug 沒被早點抓到

1. **測試有 local duplicate 函式**：test 檔內自己定義了 `function computeSrcSquareSize(...)` 含 cap，test 都通過 → 但其實在測 test 自己的 local 副本，沒測到 production code。
2. **production code 沒 export 純函式**：沒有 surface 讓 conformance test 直接綁定到 production 公式。
3. **portrait / square 圖沒事**：width-based 公式只在 landscape 出問題，常見測試場景（手機拍的 square 圖、portrait 自拍）都通過。
4. **手動 QA landscape 圖成本高**：大多數內部測試用既有素材（多為 square 或 portrait），landscape 圖往往是使用者真實 logo。

修法同時解決三件事：

- ✅ 修掉 bug（production code 加上 cap）
- ✅ 消除 local duplicate（test 改成 import production）
- ✅ 建立 conformance surface（exported pure function 變成可被測試綁定的 contract）

---

## 同 PR 帶進的衍生修正

無。本次 commit 僅處理 `computeSrcSquareSize` 一處。

---

## 驗證

- ✅ Vitest conformance tests（`useImageCrop.test.ts` § 2.5）：8 cases 全綠
- ✅ Vitest § 1 / § 2 / § 3 / § 4 既有測試不受影響（pure function 抽離，行為不變）
- ⏳ TypeScript：`npx tsc -b --noEmit` 待 commit 前跑一次
- ⏳ Lint：`npm run lint` 待 commit 前跑一次
- ⏳ 整合測試：實際上傳 2000×600 landscape 圖，觀察 PassCardPreview 圖像比例（需 production bundle rebuild）

---

## 預防

### Conformance 規則

任何 crop / transform / scale 相關的 pure function，**必須** 從 production 模組 export，**禁止** test 檔自行定義副本。理由：local duplicate 等於把 production 公式跟 test 斷開綁定，bug 改了 production 不會被 test 抓到。

### 測試 case 矩陣

未來新增 crop / scale 相關測試，必須涵蓋至少：

| 場景 | 為什麼 |
|---|---|
| Square 圖 | 基本 sanity |
| Portrait 圖 | 直式 aspect 不會觸發 width-based over-calc |
| Mild landscape（16:9）| 溫和 aspect 不觸發 cap |
| Wide landscape（10:3）| 觸發 naturalHeight cap |
| Extreme landscape（10:1）| 極端 cap，sanity check |
| Zoom-in（scale > 1）| 確認 zoom 跟 cap 互動正確 |

---

## 名詞解釋

- **srcSquareSize**：export 區域在原圖上的邊長（px），永遠是正方形。
- **naturalHeight cap**：當 width-based 計算結果超過原圖高度時，用原圖高度當上限。Landscape 圖的關鍵 safety net。
- **Crop Window Invariant**：UI mask 是固定 200×200 方框，export 的 src region 必須永遠保持 srcW === srcH。
- **baseCanvasWidth**：UI 階段 canvas 的寬度（CSS px），aspect 自動匹配原圖。LogoUploader 預設 400。

---

## 參照

- `apps/frontend/src/hooks/useImageCrop.ts` — `computeSrcSquareSize` pure function + `cropImage()` consumer
- `apps/frontend/src/hooks/useImageCrop.test.ts` — § 2.5 Landscape srcW===srcH invariant（8 cases）
- `.cursor/skills/saome-image-upload/SKILL.md` § Crop Window Invariant
- `.cursor/rules/028-image-uploader-pattern.mdc` § 11（srcSquareSize 公式對齊 contract）
- `.cursor/rules/frontend/029-image-crop-mobile-ux.mdc` — mobile UX 規範
- `runs/improvements/feedback/20260830-logo-uploader-portrait-stale-closure.md` — 同期另一個 crop bug（stale closure），同一個 crop 路徑
