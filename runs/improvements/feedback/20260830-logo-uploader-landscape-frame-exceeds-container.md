# LogoUploader Landscape White Frame Exceeds Container

## Metadata

- **日期**：2026-08-30
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：pending
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-image-upload`、`saome-task-router`（L2 Standard）
- **影響**：LogoUploader 在 landscape 圖片（高度不高的圖）上傳時，white crop frame 視覺上會超出 stage（亮圖片區域）進入 outer 容器的 dark padding 區域，使用者誤以為「白框超出了容器」/「白框卡到其他元件」
- **嚴重度**：SEV-3（UX confusion，無功能性損壞，但破壞 user 對 crop 區域的視覺模型）

---

## 症狀

> 使用者回報：「上傳一張高度不高的圖片做測試，在某些寬度的裝置，白框卡到了其他元件，白框還是超出了容器，會不會讓容器不要矮於白框，並加上一點高度會比較好?」

- **環境**：mobile viewport（375–428px）
- **觸發條件**：
  1. 進入 CardBuilder Step 3
  2. 上傳 landscape 圖片（如 3000×1000）
  3. 進入 cropping state
- **觀察到的錯誤**：
  - White crop frame (200×200) 垂直方向延伸到 stage 之外
  - Frame 在 stage 上方 / 下方各延伸約 40px，進入 outer 容器的 dark padding
  - 使用者誤以為「frame 超出了 stage / 容器」

---

## 根因

### 舊設計：stage 是 aspect-matched，outer 額外 padding 給 frame

```typescript
// ❌ 舊版
const baseContainerH = Math.round(baseContainerW * (cropState.naturalHeight / cropState.naturalWidth));
const FRAME_PADDING = 12;
const outerContainerH = Math.max(
  baseContainerH,
  responsiveCropWindow + 2 * FRAME_PADDING,
);
```

對於 landscape 圖片（3000×1000, parentWidth=376）：

| 項目 | 值 |
|---|---|
| `baseContainerW` | 360 |
| `baseContainerH` (aspect-matched) | 120 |
| `responsiveCropWindow` | 200 |
| `outerContainerH` | max(120, 200+24) = 224 |

Stage 是 360×120，outer 是 360×224，stage 垂直置中（top=52）。

**White frame** 是 outer 的 sibling（`absolute inset-0`），用 `left:50%, top:50%, translate(-50%, -50%)` 居中於 **outer**（不是 stage）。

所以 frame 居中於 360×224：
- Frame top = 224/2 − 100 = **12**
- Frame bottom = 224/2 + 100 = **212**
- Frame extends **40px above stage top (52)** and **40px below stage bottom (172)**

視覺效果：white frame 跨越 bright image area（stage）與 dark padding area（outer）。

使用者看到的「frame 在 stage 之外延伸進 dark padding」，解讀為「frame 超出容器」。

### 為什麼使用者會這樣解讀

| Frame 在哪 | 使用者感知 |
|---|---|
| 跨 stage 的亮圖片區 | 「frame 在圖片上」 |
| 跨 outer 的 dark padding | 「frame 跑到容器外面」 |

兩個 frame extension area 看起來都像「frame 不在它該在的地方」。

### SVG mask 進一步擴大問題

```jsx
// SVG mask rect 的 y 計算
y={(baseContainerH - responsiveCropWindow) / 2}
```

對於 landscape 120 stage、200 mask：`y = (120-200)/2 = -40`

mask rect 從 y=-40 延伸到 y=160，**超出 SVG viewBox (0..120)**。SVG 預設 overflow:hidden 會 clip，但 stage 內部的 SVG mask 「hole」覆蓋**整個 SVG 高度**，所以 dark overlay 在 stage 內完全隱藏，bright image 充滿整個 stage。

使用者看不到 SVG mask 應該提供的「frame 外的暗罩」視覺提示，反而更強化「frame 漂浮在 image 之外」的感受。

---

## 修法

### Stage height invariant：frame 永遠在 stage 內

```typescript
// ✅ 新版：stage height = max(aspect-matched, mask + 2 * padding)
const FRAME_PADDING = 16; // Tailwind md token (was 12)
const aspectMatchedH = cropState.naturalWidth > 0
  ? Math.round(baseContainerW * (cropState.naturalHeight / cropState.naturalWidth))
  : BASE_CANVAS_WIDTH;
const baseContainerH = Math.max(
  aspectMatchedH,
  responsiveCropWindow + 2 * FRAME_PADDING,
);

// Outer = stage (no separate padding)
const outerContainerH = baseContainerH;
```

對於 landscape 3000×1000：

| 項目 | 舊 | 新 |
|---|---|---|
| `baseContainerH` | 120 (aspect) | **232** (max(120, 200+32)) |
| `outerContainerH` | 224 | **232** |
| Stage | 360×120，top=52 | **360×232**，top=0 |
| Frame 在 stage 內? | ❌ 超出 40px 上/下 | ✅ 完全在內 |

對於 portrait / square：aspect-matched H 已經 ≥ mask+padding，行為不變。

### Stage 填滿 outer，image 用 object-fit: contain 自動 letterbox

```jsx
// stage 在 outer 內的定位：top:0, height = outerH
<div data-testid="logo-crop-stage"
  style={{
    left: 0,
    top: 0,                                        // 舊: (outerH - baseH) / 2
    width: baseContainerW,
    height: baseContainerH,                        // = outerH
    overflow: 'hidden',
    ...
  }}>
```

對於 landscape：stage 360×232，image 用 object-fit: contain 在 stage 內 letterbox 成 360×120，上下各有 56px dark area。Frame 200×200 centered (top=16, bottom=216)，完全在 stage 內。

### 為什麼 image letterbox 在這裡是對的

- Frame 在 stage 內 → 解決「frame 超出容器」user perception
- Image letterbox 維持 aspect → 不扭曲 image
- Dark letterbox padding 視覺一致（與 outer / stage 同一 dark bg）
- 與 native iOS / Android photo cropper 行為一致：frame 是固定大小的 crop 區域，image 在 frame 範圍內做 letterbox / pan

---

## 涉及檔案

| 檔案 | 變更 |
|---|---|
| `LogoUploader.tsx` | `baseContainerH = max(aspectMatchedH, maskH + 2 * FRAME_PADDING)`；`outerContainerH = baseContainerH`；stage `top: 0` (was `(outerH-baseH)/2`)；FRAME_PADDING 12 → 16 |
| `LogoUploader.test.tsx` | 5 個現有 test 更新 expectation（224→232, 52→0, 82→0, 24→32）；新增 `stage height extends to contain mask` describe block + invariant test |

---

## 驗證

### 自動驗證

```bash
cd apps/frontend
npx tsc -b --noEmit
# exit 0

npx vitest run src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.test.tsx
# Test Files  1 passed (1)
# Tests       15 passed (15)

npm test
# Test Files  45 passed | 1 skipped (46)
# Tests       302 passed | 5 skipped (307)

npm run lint
# warnings only (pre-existing, no new warnings from this change)
```

### 新 invariant test

```typescript
it('invariant: stageH >= maskH + 2 * FRAME_PADDING for ALL aspect ratios', async () => {
  const cases = [
    { name: 'portrait 1:3', w: 1000, h: 3000, parentW: 376 },
    { name: 'square 1:1', w: 1000, h: 1000, parentW: 376 },
    { name: 'mild landscape 16:9', w: 1920, h: 1080, parentW: 376 },
    { name: 'landscape 3:1', w: 3000, h: 1000, parentW: 376 },
    { name: 'extreme landscape 15:1', w: 3000, h: 200, parentW: 376 },
    { name: 'extreme landscape 6:1', w: 3000, h: 500, parentW: 376 },
  ];
  for (const c of cases) {
    // ... render, assert: stageH >= maskH + 32 (2 * 16)
  }
});
```

涵蓋 portrait 1:3、square、mild landscape 16:9、landscape 3:1、extreme landscape 15:1 與 6:1 全部 aspect ratios。

### 手動驗證（待 user 在真機跑）

1. dev frontend 開啟，登入
2. CardBuilder → Step 3
3. 上傳 3000×1000 landscape 圖
4. 觀察：white frame 在 stage 內，image 上下有 dark padding（letterbox）
5. 觀察：拖曳 image，frame 跟著移動
6. 觀察：scroll wheel 縮放，frame 維持大小（內部細節變多）

---

## 衍生

### 為什麼這次 fix 比之前更結構性

前幾次 fix（`runs/improvements/feedback/20260830-logo-uploader-iphone12promax-double-padding.md`、`20260830-logo-uploader-portrait-stale-closure.md`、`20260830-logo-uploader-mobile-drag-stutter.md`）都是**症狀層級**的修補：
- VIEWPORT_PADDING 數字修對
- Stale closure 用 deps array 修對
- pointermove 直接 DOM 寫入繞過 React reconciliation

這次（2026-08-30 round 4）改的是**結構不變量**：
> stage 高度永遠 ≥ mask 高度 + 2 × padding

之前所有 fix 都保留了「stage = aspect, outer padded」這個**錯誤的結構假設**，只是在 padding 數字上 try-and-error。

新 invariant 直接改變結構：frame 永遠在 stage 內，outer 不再獨立 padding。未來任何 aspect ratio 的圖片都不會再出現「frame 超出」視覺。

### SVG mask 的 side effect 改善

舊版：landscape stage 內 SVG mask y 為負，整個 stage 看不到暗罩。
新版：landscape stage 高於 aspect-matched image（232 > 120），SVG mask y = (232-200)/2 = **16**（正值）。Mask 完全在 SVG bounds 內，dark overlay 在 frame 四周正確顯示。

使用者終於能看到「frame 外的暗罩」這個 crop 視覺提示。

### Frame size 在 mobile 仍維持 200×200（CROP_WINDOW_SIZE）

- 視覺 mask 仍是 200×200 → 與最終 200×200 export 一致
- 唯一改變：landscape 時 stage 高度大於 image aspect-matched 高度 → image 在 stage 內 letterbox
- Mobile 視覺 frame 仍是 200×200（capped at CROP_WINDOW_SIZE via `Math.min(baseContainerW * 0.6, 200)`）

### 為什麼不直接縮小 frame 適應 stage

替代方案：`responsiveCropWindow = min(width*0.6, height*0.6, 200)`

| Aspect | 視覺 frame | 問題 |
|---|---|---|
| Landscape 3:1 | 72×72 | 與 200×200 export 不一致，使用者會困惑「我看到 72，匯出是 200?」 |
| Portrait 1:3 | 200×200 | 沒影響 |
| Square | 200×200 | 沒影響 |

選「stage extends」而非「frame shrinks」：視覺 mask 永遠是 200×200，與 export size 1:1 對應。Image letterbox 是「在 stage 內對齊 frame 中心」的標準 photo cropper UX。

---

## 自問

- **下次怎麼不犯？**
  - 任何 crop / frame / mask UI 元件都應有「frame 永遠在 stage 內」的 invariant
  - Component 拆分：stage（image + mask）、frame layer（white border）應該共享同一個「frame container」，而不是 outer padding 額外處理
  - Review checklist：「stage 高度怎麼算？涵蓋 mask 嗎？」

- **哪條 rule 該補？**
  - `028-image-uploader-pattern.mdc` § Crop Window Invariant 加一條：「stage 高度必須 ≥ mask 高度 + 2 × padding」
  - 或在 `.cursor/skills/saome-image-upload/SKILL.md` § Crop Window Invariant 加新的 invariant 段落

- **有沒有其他地方有類似風險？**
  - 任何「aspect-matched container」+ 「fixed-size frame / mask / overlay」組合都需要同樣 invariant
  - SAOME 還有其他 image crop 場景（背景圖、大頭貼）尚未實作，未來實作時套用此 pattern

---

> 撰寫者：Josh ｜ 時間：2026-08-30 09:00
