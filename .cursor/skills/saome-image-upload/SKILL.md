# saome-image-upload

> 觸發時機：實作任何圖片上傳元件（LogoUploader、BackgroundUploader、IconUploader 等）。

## 觸發關鍵字

「上傳圖片」「做 uploader」「R2 上傳」「圖片裁切」「LogoUploader」「BackgroundUploader」

---

## Crop Window Invariant（MANDATORY）

> **觸發**：寫任何有 zoom (scale) 的圖片裁切 UI。

### 設計意圖

Crop window（UI 上白色邊框 + 暗色遮罩挖洞）是**使用者選定的範圍指示器**，不該隨 zoom 變化。zoom 的語意是「在選定範圍內看到更多 src 細節」，不是「選更大範圍」。

### 三層結構

```
outer container (fixed layout, pointer events)
├── inner canvas (transform: scale(scale))
│   └── <img>  ← 只有 image 套 scale
├── SVG mask (NOT scaled, fixed 200×200 hole at center)
└── border (NOT scaled, fixed 200×200 frame at center)
```

| 層 | 是否套 scale | 角色 |
|----|--------------|------|
| outer container | ❌ | Layout 邊界，避免下方 slider 跳動 |
| inner canvas + image | ✅ | Zoom in 看到 src 細節 |
| SVG mask + border | ❌ | Crop 框永遠固定 |

### srcSquareSize 公式（cropImage 必須遵守）

UI mask 在 src 中的對應 square size：

```
srcSquareSize = (cropWindowSize / (baseCanvasWidth * scale)) * naturalWidth
```

對齊 src 中央的條件（必須滿足）：

```
baseCanvasWidth / naturalWidth = baseCanvasHeight / naturalHeight
```

實作上 `baseContainerH = baseContainerW * NH / NW` 已保證 canvas aspect = src aspect（image fit 100% 無 letterbox）。

### 範例（src 1024×768, base 400×300, mask 200×200）

| scale | image visual size | mask 200×200 占 image 比例 | srcSquareSize |
|-------|-------------------|-----------------------------|---------------|
| 1.0   | 400×300           | 50% × 67%                   | 512×512       |
| 2.0   | 800×600           | 25% × 33% (4x 細節)         | 256×256       |
| 3.0   | 1200×900          | 17% × 22% (9x 細節)         | ~171×171      |

### 為什麼這是鐵律

1. **語意正確**：scale 改變 = zoom in 看細節，不是「選更大範圍」
2. **Layout 不變**：outer container 不被 scale 撐大，下方 slider 不會跳動
3. **Export 對齊 UI**：`srcSquareSize` 公式嚴格保證 export region = UI mask 在 src 中的對應 region
4. **RN migration 友善**：公式只跟 naturalWidth / scale / cropWindowSize / baseCanvasWidth 相關，全部都是數字，無 DOM 依賴

### 禁止

- ❌ 將 image + mask + border 全部包在同一個 `transform: scale(scale)` 內
- ❌ `cropImage()` 用 `min(NW, NH) / scale` 算 srcSquareSize（會跟 UI mask size 不一致）
- ❌ 把 `cropWindowSize` 跟 `baseCanvasWidth` 硬編碼在 hook 內（必須從 component 傳入）

### Hook 簽名

```typescript
useImageCrop({
  outputWidth, outputHeight,
  cropWindowSize,    // 必填：UI mask size in CSS px (e.g. 200)
  baseCanvasWidth,   // 必填：UI canvas width in CSS px (e.g. 400)
  minScale, maxScale, initialScale,
});
```

詳見 `apps/frontend/src/hooks/useImageCrop.ts` 與 `.cursor/rules/028-image-uploader-pattern.mdc` § 11（Crop Window Invariant）。

詳見 `.cursor/rules/frontend/029-image-crop-mobile-ux.mdc`（mobile drag UX 三軸 + layout chain + stale closure）。

---

## Stage Height Invariant（MANDATORY）

> **觸發**：任何 image crop 元件（LogoUploader / BackgroundUploader /
> IconUploader）。**不是**只有 mobile 才有的 invariant——是 crop 元件
> 的**結構性**鐵律。

詳見 `.cursor/rules/028-image-uploader-pattern.mdc` § 12：

| 項目 | 公式 / 值 | 說明 |
|---|---|---|
| Stage height | `baseContainerH = max(aspectMatchedH, maskH + 2 * FRAME_PADDING)` | stage 永遠包含 mask + padding |
| Outer container height | `outerContainerH = baseContainerH` | outer 不再獨立 padding，等於 stage |
| Frame padding | `FRAME_PADDING = 16` (Tailwind md) | 走 design token，禁止 hardcoded 8/12/20 |
| Landscape 視覺 | image 在 stage 內 letterbox（object-fit: contain） | frame 200×200 永遠在 stage 內 |

#### 結構示意

```
舊（錯）:                          新（對）:
┌── outer ──────────┐             ┌── outer = stage ──┐
│  ┌── stage ───┐  │             │  ┌──────────────┐  │
│  │  image     │  │             │  │   image      │  │
│  │  (aspect)  │  │             │  │  (letterbox) │  │
│  └────────────┘  │             │  │              │  │
│  dark padding    │             │  │   ┌──mask─┐  │  │
│  ┌──frame──┐     │             │  │   │      │  │  │
│  │ 200×200 │ ← 超出 │             │  │   └──────┘  │  │
│  └─────────┘     │             │  └──────────────┘  │
└──────────────────┘             └────────────────────┘
frame 跨 stage / outer            frame 永遠在 stage 內
```

#### 各 aspect 行為

| Aspect | stage height | image 視覺 | frame 位置 |
|---|---|---|---|
| Portrait / Square | aspect-matched | 填滿 stage | stage 中央 |
| Landscape | max(aspect, mask+padding) | stage 內 letterbox | stage 中央，完全在 stage 內 |

#### 適用對象

- ✅ LogoUploader（已套用,commit `3c8c7b3`）
- ✅ IconUploader（720×720 crop,2026-08-31 — refactored as `MediaAssetUploader` variant="icon" via plan `iconuploader_實作計畫_2123407a.plan.md`）
- ⏳ BackgroundUploader（1860×738 crop,尚未實作;`backgroundImage` schema field 已預留）

Icon variant 的 CROP_WINDOW_SIZE 為 **150**（非 256）,為 mobile UX 考量（在 ≤412 viewport 提供更舒服的拖曳空間）。
詳見 plan § 1.1「比例一致性 150/300」段落。

兩個未實作的 uploader 套用此 invariant 後,未來 landscape 圖片不會再出現「frame 超出 stage」視覺。

#### 為什麼不直接縮小 frame 適應 stage

Frame 200×200（BackgroundUploader 為 800×800、IconUploader 為 150×150,1:2 比例）
**是 export contract**，UI mask size 必須永遠 = export srcSquareSize。
若 landscape 時縮小 frame，視覺是 72×72 但 export 是 200×200，使用者
心智模型會裂掉。

正確解法：stage extends 包含 frame + padding，image 在 stage 內 letterbox。
這與 native iOS / Android photo cropper 行為一致。

#### 必跑 invariant test

```typescript
it('invariant: stageH >= maskH + 2 * FRAME_PADDING for ALL aspect ratios', () => {
  const cases = [
    { name: 'portrait 1:3',           w: 1000, h: 3000, parentW: 376 },
    { name: 'square 1:1',             w: 1000, h: 1000, parentW: 376 },
    { name: 'mild landscape 16:9',    w: 1920, h: 1080, parentW: 376 },
    { name: 'landscape 3:1',          w: 3000, h: 1000, parentW: 376 },
    { name: 'extreme landscape 15:1', w: 3000, h:  200, parentW: 376 },
  ];
  for (const c of cases) {
    // render, assert: stageH >= maskH + 32
  }
});
```

#### 與 § Crop Window Invariant 的分工

| § | 不變量 | 對齊目標 |
|---|---|---|
| Crop Window Invariant | mask size === export srcSquareSize | UI ↔ export |
| **Stage Height Invariant** | **stage height ≥ mask + padding** | **stage ↔ mask** |
| **Stage Width Invariant** | **stage width floor = 200** | **stage ↔ mobile viewport** |

#### Stage Width Floor（NEW — Rule 028 § 12.1）

`MIN_STAGE_WIDTH = 200` 為 stage 寬度的 universal floor，**不跟 `CROP_WINDOW_SIZE/WIDTH` 走**。

```ts
const MIN_STAGE_WIDTH = 200;
const baseContainerW = Math.min(
  naturalCap,
  BASE_CANVAS_WIDTH,
  Math.max(availableWidth - STAGE_SAFETY_MARGIN, MIN_STAGE_WIDTH),
);
```

**為什麼不直接用 `CROP_WINDOW_WIDTH` 為 floor**：background variant `CROP_WINDOW_WIDTH = 800`，套到 376px iPhone viewport 會把 stage 撐成 800px，導致 white crop frame 跑出容器。Floor 必須跟著 mobile viewport 對齊而非 crop window。

**兩個覆蓋場景**：
1. **Mobile viewport 退化**（≥ 320px）：floor 200 保證 stage 至少 200px，frame 在容器內
2. **jsdom 退化**：`offsetWidth = 0` 時 `availableWidth - STAGE_SAFETY_MARGIN = -16`，floor 200 把它撐成 200，避免 degenerate 0px-wide stage 導致 cropImage 算 NaN

詳見 `.cursor/rules/028-image-uploader-pattern.mdc` § 12.1 + `runs/improvements/feedback/20260901-background-uploader-min-stage-width-floor.md`。

事故紀錄：`runs/improvements/feedback/20260830-logo-uploader-landscape-frame-exceeds-container.md`。
詳見 `.cursor/rules/028-image-uploader-pattern.mdc` § 12。

---

## Mobile Drag UX（MANDATORY）

> 觸發：image uploader 會在 < 768px viewport 出現 drag pan / 裁切 stage。

### 三軸預設值（詳見 Rule 029 § 1）

| 軸 | 衡量 | touch | mouse | pen |
|----|------|-------|-------|-----|
| 量 | sensitivity | 5.0 | 1.0 | 1.0 |
| 順暢度 | pointermove 走 ref+DOM | yes | yes | yes |
| 手感 | momentum | on | off | off |

實作細節：見 `apps/frontend/src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.tsx` 的 `handleTouchStart/Move/End` 與 `handlePointerDown/Move/Up`。

### Layout chain 必加 `min-w-0`（詳見 Rule 029 § 3）

crop stage 用了 inline width 的元件（如 LogoUploader），整條 chain 的 flex item 都要加 `min-w-0`。新增 uploader 時對齊下面的 checklist：

```
□ 元件 root div 加 min-w-0
□ 父層 section / aside 加 min-w-0
□ 更上層的 layout wrapper 加 min-w-0
□ Outlet inner 加 min-w-0（如尚未加）
□ html, body { overflow-x: hidden }（如尚未加，進 index.css）
□ 量測時 walk 整條 chain（不只是 body）
```

### useCallback deps 必查（詳見 Rule 029 § 2）

寫 callback 時列舉 closure 變數清單，逐一進 deps。特別注意 first-render placeholder 變數（如 `baseContainerW/H` 會在 image load 後改變值）。

### 為什麼這是 skill 級鐵律

- 8/30 LogoUploader 一天踩三類雷（stale closure、drag stutter、chain overflow）
- 共同根因：寫 uploader 時假設「父層是 desktop / 父層 padding 固定 / React 一定跟得上」
- 每個都靠使用者手機實測才抓得到（jsdom 模擬不到 touch event、layout chain 簡化）

---

## Variant Header Pattern（MANDATORY）

> **觸發**：實作 variant-driven image uploader（logo / icon / background 等）。

### Pattern 三件

詳見 `.cursor/rules/028-image-uploader-pattern.mdc` § 15：

| 元件 | 角色 | 必備元素 |
|---|---|---|
| `MediaAssetUploaderHeader/` sub-component | 變體 agnostic 渲染 title + description | 接受 `title` + `description?` + `className?` props |
| `showHeader?: boolean` prop on parent | Consumer opt-out | default `true`，consumer 巢在已有 section 時設 `false` |
| Cross-variant visual consistency | 所有 variant 一律相同 token | 見下表 |

### 跨變體 Token（兩個 header 路徑必須完全相同）

| 元素 | Token |
|---|---|
| Title (`<h3>`) | `text-base font-semibold text-foreground` + `style={{ fontFamily: 'var(--font-family-heading)' }}` |
| Description (`<p>`) | `text-sm text-muted-foreground`（無 `text-center`，左對齊）|
| Container (`<div>`) | `flex w-full flex-col items-start gap-2` |

### 對齊鐵律

- ✅ Header 一律 left-aligned（`items-start`），與 parent section heading 對齊才能讀成同一段
- ❌ `items-center` → 視覺漂移
- ❌ Title 不設 `var(--font-family-heading)` → Fredoka 字體 fallback 到系統字

### 何時用 `showHeader={false}`

| 情境 | 設定 |
|---|---|
| Uploader 獨立成一區（無 parent section）| `showHeader={true}`（default）— 顯示內部 header |
| Uploader 巢在已有 section header 的 parent 內 | `showHeader={false}` — parent 自己渲染，避免雙重 header |

範例：`CardBuilderEditor Step 3` 的 Icon 區塊已有 `<section><h3>推播通知圖示</h3><p>...</p></section>`，所以 `<MediaAssetUploader variant="icon" showHeader={false}>`。

### i18n layout（避免誤判為重複）

| Key | Namespace | 語意 |
|---|---|---|
| `iconUpload.title` / `iconUpload.hint` | 變體獨立 namespace | Action verb + 技術規格 |
| `cardEditor.step3.iconSection.title` / `.hint` | 父 feature namespace | 概念 + 出現位置 |

**禁止**：誤判為重複而合併 → 兩層語意會塌陷成一層。

### 禁止

- ❌ 在主組件 inline header JSX（違反 Rule 000 § A.1 modular design）
- ❌ `showHeader` default `false`（多數 consumer 會忘記傳）
- ❌ 命名為 `hideHeader`（雙重否定）/ `withHeader`（語意模糊）
- ❌ In-component header 用不同 design token（例如 `text-lg` 而非 `text-base`）→ 變體之間大小不一致

### 實作範本

`apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploaderHeader/`：
- `MediaAssetUploaderHeader.tsx`（~50 行，只做渲染）
- `MediaAssetUploaderHeader.test.tsx`（5 tests：title / description / className / showHeader / items-start）
- `index.ts`（barrel）

事故紀錄：`runs/improvements/feedback/20260901-media-asset-uploader-header-pattern.md`。

---

## Variant Config Bundle Pattern（MANDATORY）

> **觸發**：MediaAssetUploader 加入新 variant（如 background / 未來 membershipCard / avatar 等）。
> 這是新 variant 的 SOP，bundle pattern 取代 5 個 inline 三元鏈。

### 5 維 bundle 結構

`packages/shared/constants/card-images.ts` 提供 `MEDIA_ASSET_CONFIG[variant]` map：

```ts
export const MEDIA_ASSET_CONFIG: {
  readonly [K in MediaAssetVariant]?: MediaAssetVariantEntry;
} = {
  logo:       { i18nNamespace: 'logoUpload',       cropConfig: LOGO_CROP_CONFIG,       settingsField: 'issuerLogo',    cardImageType: 'logo' },
  icon:       { i18nNamespace: 'iconUpload',       cropConfig: ICON_CROP_CONFIG,       settingsField: 'iconImage',     cardImageType: 'icon' },
  background: { i18nNamespace: 'backgroundUpload', cropConfig: BACKGROUND_CROP_CONFIG, settingsField: 'backgroundImage', cardImageType: 'background' },
};
```

元件從 config 讀，零分支：

```ts
const config = MEDIA_ASSET_CONFIG[variant]!;
const cropConfig = config.cropConfig;
```

唯一保留的 ternary 是 **store action setter**（React hook selector 必須 ternary）。

### 新 variant SOP（8 步）

1. **新 `Xxx_CROP_CONFIG` 加進 `card-images.ts`**（含 `OUTPUT_WIDTH/HEIGHT`、`MIN_INPUT_*`、`CROP_WINDOW_WIDTH/HEIGHT`、`BASE_CANVAS_WIDTH`、`MIN_SCALE/MAX_SCALE`）
2. **加 `MEDIA_ASSET_CONFIG.xxx` entry**（5 維 bundle）
3. **加 `xxxUpload` i18n namespace + `cardEditor.stepN.xxxSection`**（Section header 跟隨 § Variant Header Pattern）
4. **store 加 `setXxx` + `xxxVersion`**（用 `set({ xxx, xxxVersion: Date.now() })` 觸發 cache busting）
5. **CardBuilderEditorWorkspace 補 render branch**（section wrapper + `<MediaAssetUploader variant="xxx" showHeader={false}>`）
6. **PassCardPreview 補 render branch**（組 URL + 傳給 `PassCardPreviewStrip`）
7. ⚠️ **加 stage width floor 驗證**（`MIN_STAGE_WIDTH = 200` 必須確認）
8. ⚠️ **加 rectangular crop 公式**（`cropWindowWidth/Height` 而非 `cropWindowSize`）

### 設計決策

**Union 而非 intersection**：`MediaAssetCropConfig = LogoCropConfig | IconCropConfig | BackgroundCropConfig`，每個 variant config 只實作自己需要的欄位；讀時用 structural cast（見 MediaAssetUploader.tsx L122–128）。

**Optional map 而非 required map**：容許 union 增加與 config entry 補完分兩個 commit，避免巨型 PR。

### 禁止

- ❌ 元件內 inline 5 個 `variant === 'logo' ? ... : variant === 'icon' ? ...` 三元鏈
- ❌ 為每個 variant 寫獨立 component（用 variant 區分即可）
- ❌ 為 rectangular / square 分兩個 config 介面（union 已涵蓋兩種 shape）

事故紀錄：`runs/improvements/feedback/20260901-media-asset-variant-config-pattern.md`。
詳見 `.cursor/rules/028-image-uploader-pattern.mdc` § 16。

---

## 完整流程圖

```mermaid
flowchart TD
 subgraph Step1[Step 1：準備]
 A1[確認 imageType enum 值] --> A2[建立 i18n namespace]
 end

 subgraph Step2[Step 2：Backend]
 B1[POST generate-upload-url] --> B2[aws4fetch 簽署 presigned URL]
 B2 --> B3[Key: {tenantId}/{cardId}/{imageType}.png]
 B3 --> B4[GET 圖片 proxy]
 end

 subgraph Step3[Step 3：Frontend 元件]
 C1[LogoUploader 元件] --> C2[HTML Canvas 裁切]
 C2 --> C3[PUT presigned URL]
 C3 --> C4[PATCH settings 回填 key]
 end

 subgraph Step4[Step 4：Preview]
 D1[lastUploadedXxxKey state] --> D2[PassCardPreview 使用 proxy URL]
 end

 A2 --> Step2
 Step2 --> Step3
 Step3 --> Step4
```

---

## Step-by-step Checklist

### Step 1：確認 imageType enum 值

在 `packages/shared/constants/card-images.ts` 加入新的 imageType key：

```typescript
// packages/shared/constants/card-images.ts
export const IMAGE_TYPE = {
  issuerLogo: 'issuerLogo',
  backgroundImage: 'backgroundImage',
  icon: 'icon',
  // 未來再加
} as const;
export type ImageType = typeof IMAGE_TYPE[keyof typeof IMAGE_TYPE];
```

**R2 多租戶資料夾結構**（Rule 028 § 9）：

```
saome/
└── {tenantId}/
    └── {cardId}/
        ├── issuerLogo.png      ← 固定檔名，每次上傳覆蓋
        ├── backgroundImage.png
        └── icon.png
```

**禁止** UUID versioning（`issuerLogo-{uuid}.png`）— 理由見 Rule 028 § 10。

### Step 2：建立 i18n namespace（先做！）

> 觸發 Rule 023 § 元件化原則 + Rule 025 § i18n。

**禁止**把翻譯放在 feature namespace（如 `cardBuilder`），**必須**建立獨立的 component-bound namespace。

```typescript
// apps/frontend/src/i18n/locales/logoUpload.zh-TW.ts
export default {
  title: '上傳 Logo',
  selectFile: '選擇圖片',
  replace: '更換圖片',
  dragging: '拖曳調整顯示區域，滾輪縮放',
  uploading: '上傳中...',
  success: 'Logo 上傳成功',
  error: '上傳失敗，請重試',
  remove: '移除 Logo',
  apply: '套用裁切',
  cancel: '取消',
  reset: '重置',
  scale: '縮放',
  hint: 'Logo 會被裁切為正方形（960×960 像素）',
  previewHint: '拖曳移動位置，滾輪縮放範圍',
  validation: {
    tooSmall: '圖片寬度需至少 960 像素',
    tooLarge: '檔案大小需小於 5MB',
    wrongFormat: '僅支援 PNG 或 JPG 格式',
    tooSmallForSave: '圖片太小，無法保存',
  },
};
```

同步更新：
- `apps/frontend/src/i18n/index.ts` — import + resources
- `apps/frontend/src/test/i18n.ts` — 同步 import + resources

### Step 3：Backend route — `POST generate-upload-url`

**不需要新 CORS**：同一個 route 吃不同 imageType，CORS 已經設定好了。

實作：`apps/backend/src/modules/cards/routes/generate-upload-url.ts`

#### Key 命名：多租戶資料夾 + 同檔名覆蓋

```typescript
import { S3SignedURL } from 'aws4fetch';

export async function generateUploadUrlService(
  cardId: string,
  imageType: string,
  tenantId: string,  // 從 JWT middleware 或 request body 取得
  env: Env,
) {
  // ✅ 多租戶資料夾：每個 tenant 獨立目錄
  // ✅ 同檔名覆蓋：imageType 固定 key，每次上傳覆蓋舊檔
  const key = `${env.R2_BUCKET}/${tenantId}/${cardId}/${imageType}.png`;

  const presignedUrl = await new S3SignedURL({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    region: 'auto',
    key,
    verb: 'PUT',
    expires: 3600,
  }).toURL();

  return { presignedUrl, key };
}
```

**多租戶結構**（Rule 028 § 9）：
```
saome/
└── {tenantId}/
    └── {cardId}/
        ├── issuerLogo.png      ← 固定檔名，覆蓋舊檔
        ├── backgroundImage.png
        └── icon.png
```

**為什麼固定檔名**（Rule 028 § 10）：
- R2 按儲存用量收費，UUID 版本化累積舊檔浪費
- 每個 imageType 在 DB 只有一個 key，覆蓋就是更新同一個 key
- 不需要版本歷史（編輯器可以 undo，不需要 restore 舊圖）

### ~~Step 4：R2 CORS 設定~~

> 已設定，不需要重做。當出錯時的檢查項目，見 Rule 028 § R2 CORS 四件套。

### ~~Step 5：Wrangler secrets~~

> 已設定，不需要重做。當出錯時的檢查項目，見 Rule 028 § Wrangler secrets 順序。

### Step 6：Frontend uploader 元件

```typescript
// components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.tsx
// 使用 useImageCrop hook 做裁切，presigned URL PUT 上傳
// 上傳成功後呼叫 onSuccess(key)
```

實作重點：
- 使用 `HTMLCanvasElement` 裁切（RN 未來替換為 `react-native-image-crop-picker`）
- 裁切運算寫在 `packages/shared/logic/` 為純函式（RN 化時零改動）
- **嚴禁**在 component 內直接寫業務邏輯，拆到 hook 或 service
- 所有翻譯走 `useTranslation('logoUpload')`
- **必跑 Crop Window Invariant**（見上方 § Crop Window Invariant）：三層結構 + srcSquareSize 公式

#### 每個 imageType 對應的 crop window 設定（NEW — Rule 028 § 11.1）

| imageType        | CROP_WINDOW_WIDTH | CROP_WINDOW_HEIGHT | baseCanvasWidth | baseCanvasHeight | Shape | 備註 |
|------------------|-------------------|--------------------|------------------|------------------|-------|------|
| `issuerLogo`     | 200               | 200                | 400              | auto (NH/NW × W) | square | LogoUploader |
| `backgroundImage`| 800               | 317                | 800              | auto             | rectangular 2.52:1 | BackgroundUploader |
| `icon`           | 150               | 150                | 300              | auto (NH/NW × W) | square | IconUploader |

> **square variant**（logo / icon）：`CROP_WINDOW_HEIGHT = CROP_WINDOW_WIDTH`，UI mask 正方。
> **rectangular variant**（background）：`CROP_WINDOW_HEIGHT` 從 output aspect 推導（`OUTPUT_HEIGHT / OUTPUT_WIDTH`），UI mask 矩形。

詳見 `packages/shared/constants/card-images.ts` + `.cursor/rules/028-image-uploader-pattern.mdc` § 11.1。

詳見 `apps/frontend/src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.tsx`。

### Step 7：Settings merge（在 cardService.update 內）

> **必用 postgres.js `sql.json()` 而非手動 stringify + cast**——workerd runtime 對 non-ASCII 字串會破壞。詳見 Rule 027 § workerd `JSON.stringify` pitfall。

```typescript
// apps/backend/src/modules/cards/db/templates.ts
const setSettings = input.settings !== undefined
  ? sql`settings = settings || ${sql.json(input.settings as any)}`
  : null;
```

**為什麼必用 `sql.json()`**：

| Pattern | Node.js | workerd | 推薦 |
|---|---|---|---|
| `sql\`settings = settings \|\| ${sql.json(input.settings)}\`` | ✅ 正常 | ✅ 正常 | ✅ **採用** |
| `sql\`settings = settings \|\| ${JSON.stringify(input.settings)}::jsonb\`` | ✅ 正常 | ❌ 破壞 non-ASCII | ❌ 禁止 |

事故紀錄：`runs/improvements/feedback/20260831-workerd-json-stringify-jsonb-pitfall.md` — 中文 `storeName` PUT 500 完整 trace。

詳見 Rule 027 § workerd `JSON.stringify` pitfall 與 Rule 028 § 2 Settings merge。

### Step 8：Preview URL 串接

使用 backend proxy URL 避免 CORS 問題：

```typescript
// GET /api/cards/:id/image/:type
// Backend 透過 Hyperdrive 讀取 R2 圖片，回傳給前端
const proxyUrl = `/api/cards/${cardId}/image/${imageType}`;
```

---

## presigned URL flow 詳細說明

### 為什麼不走 Worker streaming？

Cloudflare Worker 有 **50ms CPU time budget**。Streaming 大圖（數 MB）時：

1. Worker 接收前端 POST 的完整 body
2. 一邊接收一邊 streaming pipe 到 R2
3. 若檔案大於 Worker 單次 CPU 配額，會超時

Presigned URL 把頻寬成本 offload 到 R2，Worker 只做簽署，CPU time 用量極低。

### presigned URL 生命週期

| 階段 | 誰做什麼 |
|---|---|
| 1. 生成 | Worker 用 `aws4fetch` 對 R2 bucket 簽署 PUT URL（有效期 1 小時），key = `{tenantId}/{cardId}/{imageType}.png` |
| 2. 上傳 | 前端拿 presigned URL 直接 PUT 到 R2（繞過 Worker） |
| 3. 回填 | 前端拿 R2 key，PATCH `/api/cards/:id` 寫入 `settings.issuerLogo` |
| 4. 讀取 | 前端 GET `/api/cards/:id/image/issuerLogo`，Worker 透過 Hyperdrive 代理讀取 |

---

## R2 CORS Debug 參考

若未來新增 R2 bucket 時才需要重新設定。完整 Debug 流程見 `runs/improvements/feedback/20260823-logo-uploader-full-trace.md` § Bug 5。

設定檔：`apps/backend/r2-cors.json`。

**R2 CORS 四件套**（見 Rule 028）：

```jsonc
{
  "cors": {
    "allowed_origins": [
      "https://saome-frontend.pages.dev",
      "https://saome-frontend-*.pages.dev",
      "https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"
    ],
    "allowed_headers": ["*"],
    "allowed_methods": ["PUT", "HEAD"],
    "max_age": 6000
  }
}
```

---

## RN Migration 提示

### Canvas API → react-native-image-crop-picker

| Web | RN |
|---|---|
| `HTMLCanvasElement` | `react-native-image-crop-picker` |
| `useImageCrop` hook | 直接用 library 的 crop API |
| 裁切運算（normalize focal point） | 寫在 `packages/shared/logic/` 為純函式 |

### localStorage → react-native-mmkv

目前 `lastUploadedLogoKey` 存在 localStorage（RN 不能用）：

```typescript
// Web
localStorage.setItem('lastUploadedLogoKey', key);

// RN
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV({ id: 'saome-uploads' });
storage.set('lastUploadedLogoKey', key);
```

### presigned URL 安全模型

目前 presigned URL 由 Worker 生成後回傳給前端，前端持有並使用 presigned URL 直接 PUT 到 R2。

RN 版考慮：presigned URL 內含 R2 寫入權限，未來應改為 **Server-side 生成並用 Cookie 儲存 short-lived session token**，避免前端直接持有 Signing Key。
