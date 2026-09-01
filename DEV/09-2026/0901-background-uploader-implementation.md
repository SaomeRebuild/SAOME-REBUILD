# BackgroundUploader Implementation — DEV LOG

> 日期：2026-09-01
> Committer：Josh <josh1989213@gmail.com>
> Branch：`fix/card-builder-migration`
> Commits（依時間順序）：
> 1. `efeff08` feat(i18n): add backgroundUpload namespace + cardEditor backgroundSection — 08:29:49
> 2. `09cd641` refactor(mediaAssetUploader): add background variant support — 08:30:16
> 3. `ffcaf28` feat(cardBuilder): add backgroundImage to store + workspace + PassCardPreview pipeline — 08:30:39
>
> 觸發 skill：`saome-dev-logging`（master DEV LOG raw data 紀律） + `saome-self-improvement`（feedback 即時 + INDEX 同步）
> 計畫來源：`.cursor/plans/backgrounduploader_dev_log_+_feedback_撰寫計畫_e3de1b23.plan.md`

---

## 背景

CardBuilder Step 3 原本只支援 Logo 與 Icon 上傳（皆為 square crop）。Apple Wallet Pass 與 Google Wallet Pass 的「hero strip」需要一張橫幅背景圖（PassCreator 規格：**1860×738 像素，aspect 2.52:1**），用於 Pass 頂部彩色區域。BackgroundUploader 是 MediaAssetUploader 的第三個 variant，引入 **第一個非 square crop**，因此牽動整條 React + Zustand + i18n + hook pipeline 的 chain。

下游消費點：

- `PassCardPreviewStrip`（hero strip）— 渲染 `<img>` 滿版 `object-cover`，加 `rgba(0,0,0,0.35)` overlay 確保文字可讀
- iOS / Android Wallet 內顯示（透過 R2 presigned URL + `${tenantId}/${templateId}/background.png` key）

Backend 已於 2026-08-30 提前把 `backgroundImage` schema 寫進 `templateSettingsSchema` 與 `cardService.generateUploadUrl(..., 'background')`，所以這輪純前端實作。

---

## Round 1 — i18n 先做（`efeff08` 08:29:49）

### 動機

依 Rule 023 § 元件化原則，「L2 元件跨 feature 重用」必須有 component-bound namespace。Background 是 MediaAssetUploader 的第三個 variant，跟 logo/icon 屬同一個 component family，**不可**借用 `cardBuilder` feature namespace。

決定翻譯檔結構要跟既有 `logoUpload` / `iconUpload` 鏡像（**flat keys** + 巢狀 `validation.*`）：

```
apps/frontend/src/i18n/locales/
├── backgroundUpload.zh-TW.ts   ← 新
├── backgroundUpload.en.ts      ← 新
├── iconUpload.zh-TW.ts         ← 鏡像對象
└── logoUpload.zh-TW.ts         ← 鏡像對象
```

### 內容 spec

- `hint`：zh-TW「背景圖會被裁切為 1860×738 像素（2.52:1 寬幅）」、en「Background image will be cropped to 1860×738 pixels (2.52:1 landscape)」
- `validation.tooSmall`：zh-TW「圖片寬度需至少 1860 像素、高度需至少 738 像素」
- `validation.wrongFormat` / `tooLarge`：與 logo/icon 共用措辭

### 同步兩個 registry

- `apps/frontend/src/i18n/index.ts`：在 `resources['zh-TW']` 與 `resources['en']` 各加 `backgroundUpload: backgroundUploadZhTW/En`
- `apps/frontend/src/test/i18n.ts`：test environment i18n 也要 register（否則 Vitest 內 `useTranslation('backgroundUpload')` 會 fallback 成 raw key）

### 同步 Step 3 section header

CardBuilderEditorWorkspace Step 3 已有 `step3.iconSection.title` / `.hint` 給 Icon 用。Background 必須有對稱的 `step3.backgroundSection.title` / `.hint`，給 Step 3 parent section 的 `<h3>` + `<p hint>` 用（Rule 028 § 15 Variant Header Pattern：parent section 自己渲染 header，MediaAssetUploader `showHeader={false}` 抑制內部 header）。

### Verification

- typecheck: exit 0
- i18n smoke test：namespaces registered for both `en` + `zh-TW`
- `npm run verify:i18n`：0 raw key、雙語對齊

---

## Round 2 — Variant 重構（`09cd641` 08:30:16）

### 動機

MediaAssetUploader 從 LogoUploader 重構（2026-08-30）後是 variant-driven，但只支援 `logo | icon`，**Extract<MediaAssetVariant, 'logo' | 'icon'>`** 限制了 props 型別。Background 是第一個非 square variant，UI mask 必須是矩形 **800×317**（aspect 2.52:1）才能 match 1860×738 export 比例。若仍用 `cropWindowSize=800`，mask 變 800×800 正方，使用者看到的選取範圍跟實際 export 不一致（違反 Rule 028 § 11 Crop Window Invariant）。

### 五大變更（依賴順序）

#### 1. `MEDIA_ASSET_CONFIG.background`（`packages/shared/constants/card-images.ts`）

新增 entry：

```ts
background: {
  i18nNamespace: 'backgroundUpload',
  cropConfig: BACKGROUND_CROP_CONFIG,
  settingsField: 'backgroundImage',
  cardImageType: 'background',
},
```

`MediaAssetCropConfig` 從 `{ CROP_WINDOW_SIZE, BASE_CANVAS_WIDTH }` 變 union（`LogoCropConfig | IconCropConfig | BackgroundCropConfig`），`BACKGROUND_CROP_CONFIG` 是第一個 `CROP_WINDOW_WIDTH`/`CROP_WINDOW_HEIGHT` 對（取代 `CROP_WINDOW_SIZE`）。

#### 2. `useImageCrop` rectangular 擴充

簽名從 `cropWindowSize?: number` 改為 `cropWindowWidth?: number` + `cropWindowHeight?: number`（Rule 024 Hook Split Pattern 向後相容：square case 兩個值相等）。`cropImage` 從 `computeSrcSquareSize` 改為 `computeSrcRegion`，回傳 `{ srcX, srcY, srcW, srcH }`。

#### 3. `CropStage` SVG mask 矩形化

`<mask>` 的 `<rect>` 從 `width=height=maskSize` 改為 `width=maskW, height=maskH, x=(stageW-maskW)/2, y=(stageH-maskH)/2`。White frame 同樣矩形化。

#### 4. `MediaAssetUploader` 2-arm → 3-arm × 3 處

```ts
// 1. Store action
const setStoreField = useCardBuilderStore(
  variant === 'logo' ? (s) => s.setIssuerLogo
  : variant === 'icon' ? (s) => s.setIconImage
  : (s) => s.setBackgroundImage,
);

// 2. Validator
const validateFile = variant === 'logo' ? validateLogoFile
  : variant === 'icon' ? validateIconFile
  : validateBackgroundFile;

// 3. Preview-key read (idle/success render)
const existingKey = variant === 'logo' ? storeState.issuerLogo
  : variant === 'icon' ? storeState.iconImage
  : storeState.backgroundImage;
```

#### 5. ←→ **關鍵決策瞬間**：`MIN_STAGE_WIDTH = 200` 取代 `CROP_WINDOW_WIDTH = 800` 為 floor

原本的 stage width 公式用 `CROP_WINDOW_WIDTH = 800` 為 floor。問題：**376px iPhone viewport** 撐不下 800px stage，白色 crop frame 跑出容器（visual overflow bug）。

修法見 `MediaAssetUploader.tsx` line 175–190：

```ts
// Floor at MIN_STAGE_WIDTH (200) instead of CROP_WINDOW_WIDTH. The previous
// floor (CROP_WINDOW_WIDTH = 800 for background variant) forced the stage
// to 800px on a 376px phone viewport, overflowing the viewport and making
// the white frame (480px wide, centered in the 360px-capped outer) appear
// as full-width horizontal lines outside the container. The crop window
// itself scales to `min(baseContainerW * 0.6, CROP_WINDOW_WIDTH)`, so it
// always fits inside the stage regardless of stage size. The 200 floor
// also covers the jsdom test case where `offsetWidth` reports 0 (so the
// ResizeObserver-based `availableWidth` collapses to 0 and the floor
// prevents a degenerate 0px-wide stage).
const MIN_STAGE_WIDTH = 200;
const baseContainerW = Math.min(
  naturalCap,
  BASE_CANVAS_WIDTH,
  Math.max(availableWidth - STAGE_SAFETY_MARGIN, MIN_STAGE_WIDTH),
);
```

這是 **magic number 沉澱成 invariant** 的關鍵 frame — 詳見 feedback #1 + Rule 028 § 12.1。

### Verification

- typecheck: exit 0
- vitest: 321/321 passed across 51 test files
- 既有 logo/icon 5 個 MediaAssetUploader test files 1320+ 行全部不退步（signature 向後相容：`cropWindowSize` 仍 fallback）

---

## Round 3 — Pipeline 串接（`ffcaf28` 08:30:39）

### 動機

Variant 支援做完後，backgroundImage 必須從 editor → store → workspace → preview 一路 thread，並且 **cache-busting** 套 Rule 028 § 13 Image Cache Busting 模式（`?v=${version}` query param，upload 後 bump version）。

### 變更鏈（5 個檔案）

```
1. CardBuilderEditor.store.ts
   - state: + backgroundImage, + backgroundImageVersion
   - action: + setBackgroundImage(key)
   - loadSettings: parse backgroundImage + bump version when key changed
   - reset(): clear backgroundImageVersion

2. CardBuilderEditorWorkspace.tsx
   - Step 3: render background section wrapper (h3 + p hint + MediaAssetUploader showHeader={false})
   - handleNext Step 3: persist { issuerLogo, iconImage, backgroundImage } to settings

3. CardBuilderEditorPreview.tsx
   - read backgroundImage from store
   - thread to <PreviewWrapper backgroundImage={...}>

4. PreviewWrapper.tsx
   - thread to <PassCardPreview backgroundImage={...}> (front + back side)

5. PassCardPreview.tsx + .types.ts + .test.tsx
   - build URL: ${api.baseUrl}${api.paths.cardImage(templateId, 'background')}?token=${token}&v=${backgroundImageVersion}
   - pass to <PassCardPreviewStrip backgroundImage={url}>

6. PassCardPreviewStrip.tsx
   - render <img> absolute fill + object-cover + rgba(0,0,0,0.35) overlay
   - fallback backgroundColor when no backgroundImage
```

### Cache-busting 模式（Rule 028 § 13）

```ts
const existingVersion = variant === 'logo' ? store.issuerLogoVersion
  : variant === 'icon' ? store.iconImageVersion
  : store.backgroundImageVersion;
const displayUrl = `${api.baseUrl}${api.paths.cardImage(templateId, config.cardImageType)}?token=${getAccessToken() ?? ''}&v=${existingVersion}`;
```

每次 `setBackgroundImage(key)` 都會 `set({ backgroundImage, backgroundImageVersion: Date.now() })`，保證上傳後圖立刻 refresh（不會被 Cloudflare edge cache 喂舊圖）。

### Verification

- typecheck: exit 0
- vitest: 321/321 passed across 51 test files
- CardBuilderEditorWorkspace.test.tsx 新增 backgroundImage threading smoke test
- PassCardPreview.test.tsx 新增 backgroundImage render assertion

---

## 衍生

### 影響的檔案

| 類別 | 檔案 |
|---|---|
| shared constants | `packages/shared/constants/card-images.ts`（+ BACKGROUND_CROP_CONFIG + MEDIA_ASSET_CONFIG.background） |
| shared logic | `packages/shared/logic/imageCrop.ts`（+ validateBackgroundFile, computeSrcSquareSize → computeSrcRegion） |
| hook | `apps/frontend/src/hooks/useImageCrop.{ts,web.ts,native.ts}`（signature 向後相容） |
| i18n | `apps/frontend/src/i18n/locales/backgroundUpload.{zh-TW,en}.ts`（新） |
| i18n registry | `apps/frontend/src/i18n/index.ts`, `src/test/i18n.ts` |
| feature i18n | `apps/frontend/src/i18n/locales/cardEditor.{zh-TW,en}.ts`（+ step3.backgroundSection） |
| L2 component | `MediaAssetUploader/{types,tsx,header}`（3-arm × 3 處、stage floor、rectangular cropWindow） |
| sub-component | `CropStage/{tsx,types}`（SVG mask 矩形化） |
| state | `CardBuilderEditor.store.{ts,test.ts}`（+ backgroundImage state） |
| page | `CardBuilderEditorWorkspace.tsx`, `CardBuilderEditorPreview.tsx` |
| preview | `PassCardPreview.{tsx,types,test}`, `PreviewWrapper.{tsx,types}`, `PassCardPreviewStrip.tsx` |

### 與既有 rule 的對齊

- Rule 000 § A.3 Hook Extraction Strategy：`useImageCrop.web.ts` / `.native.ts` 雙檔拆分保持不變
- Rule 023 § 元件化原則：`backgroundUpload` namespace 不放 `cardBuilder`
- Rule 024 Hook Split Pattern：主檔 + 平台 binding，native stub 仍 throw NotImplementedError
- Rule 028 § 11 Crop Window Invariant：mask 矩形化（800×317 aspect 2.52:1 match export）
- Rule 028 § 12 Stage Height Invariant：width floor 新增子節（§ 12.1）
- Rule 028 § 13 Image Cache Busting：`?v=${backgroundImageVersion}` query param
- Rule 028 § 14 Image Auth Strategy：query token 與 logo/icon 共用
- Rule 028 § 15 Variant Header Pattern：`showHeader={false}` + parent section 自帶 h3/hint

### 未來 Image / 其他 variant 的 reuse pattern

新 variant（如未來的 `membershipCard`）的 SOP checklist（從 Variant Config Bundle Pattern 推導）：

1. 新 `Xxx_CROP_CONFIG` 加進 `card-images.ts`（含 `OUTPUT_*`、`MIN_INPUT_*`、`CROP_WINDOW_WIDTH/HEIGHT`、`BASE_CANVAS_WIDTH`）
2. 加 `MEDIA_ASSET_CONFIG.xxx` entry（5 維 bundle）
3. 加 `xxxUpload` i18n namespace + `cardEditor.stepN.xxxSection`
4. store 加 `setXxx` / `xxxVersion`
5. CardBuilderEditorWorkspace 補 render branch
6. PassCardPreview 補 render branch
7. ⚠️ 對 `MIN_STAGE_WIDTH = 200` 自問：「`CROP_WINDOW_WIDTH` 是否比 mobile viewport 大？floor 邏輯需不需要另外設計？」
8. ⚠️ 對 `responsiveCropWindowHeight` 自問：「output aspect 不為 1 時 height 怎麼從 width 推？」

---

## 自問

1. **`MIN_STAGE_WIDTH = 200` 為什麼是 200 而不是 160 / 240？**
   200 是 jsdom 退化情況下 `offsetWidth = 0` 與「至少能顯示 crop window 比例的 0.6 倍」的最小交集（200 × 0.6 = 120，仍比 icon CROP_WINDOW_SIZE 150 小一點，但 square case 透過 `min(baseContainerW * 0.6, CROP_WINDOW_WIDTH=200)` 保持等於 CROP_WINDOW_SIZE）。這數字要不要寫進 Rule 028 § 12.1 當作 invariant 的「建議值」？→ **要**。feedback #1 已沉澱。

2. **未來 variant 是否會出現 `cropConfig.OUTPUT_HEIGHT === null` 且 `CROP_WINDOW_WIDTH !== CROP_WINDOW_HEIGHT` 的 case？**
   目前只有 logo 是「output height flexible」（`OUTPUT_HEIGHT: null`），但 logo 的 crop window 仍 square。如果未來出現「output height flexible + rectangular crop window」情況（如 banner image with 寬度固定、高度任選），`responsiveCropWindowHeight` 公式 `cropConfig.OUTPUT_HEIGHT !== null ? width × (OUTPUT_HEIGHT/OUTPUT_WIDTH) : width` 會 fall through 到 `width`（非預期）。→ **應該**在 feedback #2 加：「未來 variant 的 `OUTPUT_HEIGHT` 與 `CROP_WINDOW_*` 必須是同個 invariant」。但目前 3 個 variant 都不觸發，可延後。

3. **BackgroundUploader 是否有獨立 Storybook story？**
   沒有。依 Rule 028 § 6.1 與 Plan 1 § 9.2 決策，沿用 MediaAssetUploader story，加 `variant="background"` case。Storybook 版本已對齊 `@storybook/react@^9` + `@storybook/react-vite@^9`。

4. **是否需要為 background variant 寫獨立的 Vitest test file？**
   Plan 1 § 9.5 漏掉了 `MediaAssetUploader.background.test.tsx` 與 `PassCardPreview.background.test.tsx`（見 check list「檔案總覽 → 新建 ~6 檔」中兩個測試檔）。現狀仍是 51 個 test file 通過 321 個 assertion，但 **沒有針對 background variant 的獨立覆蓋**。下一步應該補：
   - `MediaAssetUploader.background.test.tsx`：涵蓋 background variant 的 load → drag → scale → apply → upload mock → store setBackgroundImage call
   - `PassCardPreview.background.test.tsx`：測試有/無 background image 兩種 render path + `?v=` cache-busting
   
   **這不在本次 docs 工作範圍**（Plan 2 是 pure docs），但要列入待辦。

5. **`reset()` 為什麼要 reset version？**
   跨 session 載入舊 template 時，`backgroundImageVersion` 是上一次 session 的 `Date.now()`。重置成 0 確保下一次 `loadSettings` 觸發 `loadBg !== state.backgroundImage` 判斷時，能正常 bump version。否則 user 看到的是「明明換了圖卻顯示舊圖」（cache 沒刷新）。

---

## Cross-link

- Feedback #1：MIN_STAGE_WIDTH Floor → `runs/improvements/feedback/20260901-background-uploader-min-stage-width-floor.md`
- Feedback #2：Variant Config Bundle Pattern → `runs/improvements/feedback/20260901-media-asset-variant-config-pattern.md`
- Feedback #3：useImageCrop Rectangular Support → `runs/improvements/feedback/20260901-use-image-crop-rectangular-support.md`
- Rule 028 § 11.1 Rectangular Crop Window（NEW）
- Rule 028 § 12.1 Stage Width Floor（NEW）
- Rule 028 § 16 Variant Config Bundle Pattern（NEW）
- SKILL saome-image-upload：Stage Height Invariant 補 width floor + 新增 § Variant Config Bundle
- 計畫來源：`.cursor/plans/backgrounduploader_dev_log_+_feedback_撰寫計畫_e3de1b23.plan.md`
- 實作計畫：`.cursor/plans/background_uploader_實作計畫_40e8359c.plan.md`

---

## Verification（per Rule 006）

| 驗證項 | 狀態 | 證據 |
|---|---|---|
| typecheck | ✅ exit 0 | commit message `efeff08` / `09cd641` / `ffcaf28` footer |
| vitest | ✅ 321/321 passed across 51 test files | commit message `09cd641` / `ffcaf28` footer |
| i18n smoke | ✅ namespaces registered en + zh-TW | commit message `efeff08` footer |
| i18n verify | ✅ 0 raw key、雙語對齊 | Phase 4.4 verify 命令 |

本 DEV LOG 屬於 docs + rules 工作，**不重跑 verification**（commit message 已記載各 commit 通過的驗證輸出；新增的 3 個 rule 補章與 SKILL 同步均為 markdown 變更，不影響 runtime）。
