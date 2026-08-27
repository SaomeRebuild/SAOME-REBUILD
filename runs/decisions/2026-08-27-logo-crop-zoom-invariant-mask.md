# Logo Crop Zoom — Mask 不變式決策

## Metadata

- **日期**：2026-08-27
- **作者**：Josh（agent-assisted via Cursor）
- **觸發**：LogoUploader Step 2 crop zoom — scale 改變時，整體 canvas（image + mask + border）一起 scale，使用者看到 mask 框跟著圖片一起變大，**沒有「zoom in 看更細節」的語意**，且 export crop region 與 UI mask 顯示不一致
- **規則 / skill 觸發**：`saome-image-upload`、`saome-task-router`（L2 Standard）、`saome-dev-logging`

---

## 背景

LogoUploader 採用 200×200 crop window 搭配 0.5x–3x zoom range。兩個問題反覆出現：

1. **Mask 跟著 scale 變大**（Bug-A）
   - 原本 inner canvas（image + SVG mask + border）整套 `transform: scale(scale)`
   - scale=2 時，UI mask 視覺 = 400×400，使用者以為「選更大範圍」
   - 正確語意應該是「選定 200×200 範圍內看到更多 src 細節」

2. **UI mask 跟 export crop region 不一致**（Bug-B）
   - 原本 `cropImage` 用 `squareSize = min(NW, NH)/scale`
   - 對 1024×768 src + baseW=400×baseH=300，scale=1：export 給 768×768，但 UI mask 對應 src 512×512
   - UI 跟 export 差了 1.5 倍，使用者看到 crop 框在 src 中央偏左，但 export 出來區域完全不同

兩個 bug 同源：**crop window 跟圖片是同一個 transform 鏈，導致 visual zoom 跟 semantic crop 耦合**。

---

## 選項

### 選項 A：Mask Invariant + srcSquareSize 公式（採用）

Crop window 永遠固定 200×200 CSS px（不套 scale），只有 image 套 scale。Mask 在 outer container 中央固定。

UI mask size 在 src 中對應的 square size：

```
srcSquareSize = (cropWindowSize / (baseCanvasWidth * scale)) * naturalWidth
```

- crop window = 200, baseCanvasWidth = 400, scale = 1, NW = 1024 → 512×512 square
- crop window = 200, baseCanvasWidth = 400, scale = 2, NW = 1024 → 256×256 square
- crop window = 200, baseCanvasWidth = 400, scale = 3, NW = 1024 → ~171×171 square

對齊 src 中央的條件：`baseCanvasWidth / naturalWidth = baseCanvasHeight / naturalHeight`（canvas aspect = src aspect，image fit 100% 沒 letterbox）。實作上 `baseContainerH = baseContainerW * NH/NW` 已保證。

`cropImage()` 必須讀 `cropWindowSize` 跟 `baseCanvasWidth` 兩個 UI 常數才能算對 srcSquareSize，**這兩個值必須透過 hook options 傳入，禁止硬編碼**。

### 選項 B：Mask 也跟著 scale，但擴大 cropImage 公式對齊

接受 UI mask 跟圖片一起 scale，重新設計 cropImage 公式讓 export region = UI mask 視覺對應的 src region。

- 缺點：使用者語意錯亂（mask 變大 = 選更大範圍），違反「zoom in 看細節」直覺
- 缺點：必須額外記錄 layout-time 與 visual-time 的比例，複雜度高

### 選項 C：放棄固定 mask，用 draggable rectangle

使用者自由拖曳矩形選範圍，沒有 zoom 概念。Instagram / iOS Photos 早期風格。

- 缺點：操作步驟多兩步（拉角 + 確認），不適合快速 logo 替換
- 缺點：mobile-first 場景下，觸控拖角體驗差

---

## 決策

**選擇**：選項 A — Mask Invariant + srcSquareSize 公式

**理由**：

1. **語意正確**：scale 改變 = zoom in 看 src 細節，crop 框永遠是同一個「選定範圍」
2. **視覺直接**：使用者看到的 200×200 框 = 永遠是 200×200 視覺大小（不像 Facebook avatar crop 框會變大）
3. **Layout 不變**：outer container 不被 scale 撐大，下方 slider 不會跳動
4. **Export 對齊 UI**：`srcSquareSize` 公式嚴格保證 export region = UI mask 在 src 中的對應 region
5. **RN migration 友善**：公式只跟 naturalWidth / scale / cropWindowSize / baseCanvasWidth 相關，全部都是數字，無 DOM 依賴；可搬到 `packages/shared/logic/` 為純函式

---

## 實作規劃

| 步驟 | 說明 | 狀態 |
|------|------|------|
| 1 | LogoUploader 三層結構：outer container、inner canvas（image only, scale）、SVG mask + border（不 scale）| ✅ |
| 2 | `useImageCrop` 新增 options `cropWindowSize` + `baseCanvasWidth` | ✅ |
| 3 | `cropImage` 改用 `srcSquareSize = (cropWindowSize / (baseCanvasWidth * scale)) * naturalWidth` | ✅ |
| 4 | LogoUploader 從 module-level const 傳入 `cropWindowSize` / `baseCanvasWidth` | ✅ |
| 5 | 寫進 SKILL § Crop Window Invariant + Rule 028 | ✅ |
| 6 | 寫 feedback 完整 trace + Decision Log | ✅ |
| 7 | 加 conformance test：srcSquareSize + mask binding + drag direction | ✅ 2026-08-27 |
| 8 | 修小圖 (NW < baseCanvasWidth) corner case：resolvedBaseCanvasWidth 進 cropState | ✅ 2026-08-27 |
| 9 | 修 syncFocalFromOffset：移除 `* scale` factor（Bug-C）| ✅ 2026-08-27 |
| 10 | 抽 syncFocalFromOffset 為 module-level export function（供 test 呼叫）| ✅ 2026-08-27 |

---

## 影響

| 位置 | 影響 |
|------|------|
| `apps/frontend/src/hooks/useImageCrop.ts` | 新增 `cropWindowSize`、`baseCanvasWidth`、`resolvedBaseCanvasWidth` options；`cropImage` 改公式 |
| `apps/frontend/src/hooks/useImageCrop.test.ts` | **新建** 17 個 conformance tests（srcSquareSize + mask binding + drag direction）|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.tsx` | 三層結構；syncFocalFromOffset 抽出 module-level export；resolvedBaseCanvasWidth sync；常量從 LOGO_CROP_CONFIG 讀 |
| `.cursor/skills/saome-image-upload/SKILL.md` | 新增 § Crop Window Invariant + srcSquareSize 公式 |
| `.cursor/rules/028-image-uploader-pattern.mdc` | 新增 § 11 Crop Window Invariant |
| `design-system/MASTER.md` | 新增 § 13 Crop Window Pattern |
| `packages/shared/constants/card-images.ts` | 新增 `CROP_WINDOW_SIZE` + `BASE_CANVAS_WIDTH` |
| `runs/decisions/2026-08-27-logo-crop-zoom-invariant-mask.md` | **新建** Decision Log |
| `runs/improvements/feedback/20260826-0827-logo-crop-zoom-full-trace.md` | **新建** Feedback |

---

## 衍生問題

1. ~~**`baseCanvasWidth` 在小圖 (NW < 400) 不一致**~~ ✅ **已修**（resolvedBaseCanvasWidth 進 cropState + useEffect sync）
2. ~~**`offsetX/Y` drag 對應的 src 座標公式方向**~~ ✅ **已修**（syncFocalFromOffset 移除 `* scale`，17 個 conformance tests 斷言方向正確）
3. **未來加 BackgroundUploader / IconUploader**
   - 沿用相同公式，但要傳不同 cropWindowSize（背景 1920×1080、icon 256×256）
   - SKILL § Step 6 必須明列「每個 imageType 各自的 cropWindowSize 跟 baseCanvasWidth」

---

## 自問

- **下次怎麼不犯？**
  - 任何「image + overlay」互動，**先把 overlay 跟 image 的 transform 鏈拉開**，再寫公式
  - Crop window size 跟 export crop size 是同一個概念的兩面，**必須共用同一個常數**
  - 任何 focal/offset 公式，**先做 dimension analysis**（確認每個變數的單位）：`offsetX / baseW` 無因次，`offsetX * scale / baseW` 有額外 scale 因次 ✗
  - **抽成 pure function + export for test** 是確保公式可測試的最好方法

- **哪條 rule 該補強？**
  - 新增 `frontend/028-image-crop-invariant.mdc`：mask size ↔ export size 對齊鐵律
  - 強化 `frontend/024-mobile-future-proof.mdc`：transform chain 必須避免 DOM 耦合；公式要抽純函式

- **有沒有其他系統用類似 pattern？**
  - `2026-08-21-card-type-extension-pattern.md` 的「Flat Schema + Extension Map」也是把常數放在 shared 集中管理 — 對齊原則
  - `000-modular-design.mdc` Part A.2「業務邏輯不能在 component 內」：syncFocalFromOffset 已抽出 module-level export；srcSquareSize 將來應搬 `packages/shared/logic/`
