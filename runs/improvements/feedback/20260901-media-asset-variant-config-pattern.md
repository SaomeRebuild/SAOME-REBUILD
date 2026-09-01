# MediaAssetUploader Variant Config Bundle Pattern — `MEDIA_ASSET_CONFIG[variant]` 5 維 bundle

> 日期：2026-09-01
> 來源 commit：`09cd641` refactor(mediaAssetUploader): add background variant support
> 修法位置：`packages/shared/constants/card-images.ts` L228–244（MEDIA_ASSET_CONFIG map）
> 對齊 rule：Rule 028 § 16 Variant Config Bundle Pattern（NEW）

## 背景

原本 MediaAssetUploader 內用 5 條 `variant === 'logo' ? ... : variant === 'icon' ? ...` 三元運算串接 5 個維度：

| 維度 | logo | icon | （缺）background |
|---|---|---|---|
| i18n namespace | 'logoUpload' | 'iconUpload' | — |
| crop config | LOGO_CROP_CONFIG | ICON_CROP_CONFIG | — |
| settings field | 'issuerLogo' | 'iconImage' | — |
| card image type | 'logo' | 'icon' | — |
| store action | setIssuerLogo | setIconImage | — |

Background 加入時：

1. **三元鏈爆增**：每個維度都從 2-arm 變 3-arm，5 處地方都要改
2. **TypeScript union 問題**：`LogoCropConfig` 是 `CROP_WINDOW_SIZE: number`，`BackgroundCropConfig` 是 `CROP_WINDOW_WIDTH/HEIGHT: number`，union 後要 `as unknown as {...}` 才能讀
3. **新 variant SOP 模糊**：未來加 `membershipCard` 或其他變體時不曉得從哪裡著手

## 根因

Variant-driven 概念沒沉澱成資料結構。當資料散落在 5 個 `if-else` chain 時，每個變體的「所有差異」都散在元件程式碼裡，加新變體要 grep 整個檔案。

**正確的設計**是「**差異集中在 config map，元件讀 config**」：

```
MEDIA_ASSET_CONFIG[variant] = { i18nNamespace, cropConfig, settingsField, cardImageType }
↓ 元件
const config = MEDIA_ASSET_CONFIG[variant]!;  // 一行拿到所有差異
```

## 修法

`packages/shared/constants/card-images.ts` 新增 `MEDIA_ASSET_CONFIG` map 與 `MediaAssetVariantEntry` 型別：

```ts
export type MediaAssetVariantEntry = {
  i18nNamespace: string;
  cropConfig: MediaAssetCropConfig;
  settingsField: string;
  cardImageType: CardImageType;
};

export const MEDIA_ASSET_CONFIG: {
  readonly [K in MediaAssetVariant]?: MediaAssetVariantEntry;
} = {
  logo: {
    i18nNamespace: 'logoUpload',
    cropConfig: LOGO_CROP_CONFIG,
    settingsField: 'issuerLogo' as const,
    cardImageType: 'logo' as const,
  },
  icon: {
    i18nNamespace: 'iconUpload',
    cropConfig: ICON_CROP_CONFIG,
    settingsField: 'iconImage' as const,
    cardImageType: 'icon' as const,
  },
  background: {
    i18nNamespace: 'backgroundUpload',
    cropConfig: BACKGROUND_CROP_CONFIG,
    settingsField: 'backgroundImage' as const,
    cardImageType: 'background' as const,
  },
};
```

元件從 5 個三元鏈變成「讀 config」：

```ts
const config = MEDIA_ASSET_CONFIG[variant]!;
const cropConfig = config.cropConfig;
// 4 個維度全部從 config 讀，零分支
```

剩下唯一保留的 ternary 只有 **store action setter**（因為 setStoreField 是 React hook selector，必須 ternary），但這是合理的 escape hatch。

## 學習

### 未來新 variant SOP checklist

1. **新 `Xxx_CROP_CONFIG` 加進 `card-images.ts`**（含 `OUTPUT_WIDTH/HEIGHT`、`MIN_INPUT_*`、`CROP_WINDOW_WIDTH/HEIGHT`、`BASE_CANVAS_WIDTH`、`MIN_SCALE/MAX_SCALE`）
2. **加 `MEDIA_ASSET_CONFIG.xxx` entry**（5 維 bundle）
3. **加 `xxxUpload` i18n namespace + `cardEditor.stepN.xxxSection`**（Section header 跟隨 § 15 Variant Header Pattern）
4. **store 加 `setXxx` + `xxxVersion`**（用 `set({ xxx, xxxVersion: Date.now() })` 觸發 cache busting）
5. **CardBuilderEditorWorkspace 補 render branch**（section wrapper + `<MediaAssetUploader variant="xxx" showHeader={false}>`）
6. **PassCardPreview 補 render branch**（組 URL + 傳給 `PassCardPreviewStrip`）
7. ⚠️ **加 background stage width floor**（見 feedback #1：`MIN_STAGE_WIDTH = 200` 必須確認）
8. ⚠️ **加 rectangular crop 公式**（見 feedback #3：`cropWindowWidth/Height` 而非 `cropWindowSize`）

### 為什麼 `MediaAssetCropConfig` 用 union 而非 intersection

兩個 candidate shape：

```ts
// A. intersection（全部都要有）
type MediaAssetCropConfig = LogoCropConfig & IconCropConfig & BackgroundCropConfig;

// B. union（任一即可）
type MediaAssetCropConfig = LogoCropConfig | IconCropConfig | BackgroundCropConfig;
```

選 **union**。理由：

- intersection 強迫每個 variant config 都實作所有欄位（包括別人不用的），導致 LOGO_CROP_CONFIG 也要有 `CROP_WINDOW_WIDTH/HEIGHT` 這種沒意義欄位
- union 讓每個 variant config 只實作自己需要的欄位；讀時用 structural cast 處理（見 MediaAssetUploader.tsx L122–128 的 `cropWindowLike as unknown as {...}`）

### 為什麼 `MEDIA_ASSET_CONFIG` 是 optional map（`?:` 而非 required）

```ts
readonly [K in MediaAssetVariant]?: MediaAssetVariantEntry;
```

未來新增 variant 時（如 `membershipCard`），可以**先在 `MediaAssetVariant` union 加成員，再分階段補 MEDIA_ASSET_CONFIG entry**。如果用 required map，加 union 成員時 TypeScript 會立刻報錯「missing entry」，迫使原子性 commit，違背增量開發節奏。

Optional map 容許 **union 增加** 與 **config entry 補完** 分兩個 commit，避免巨型 PR。

## Rule update

Rule 028 § 16 新增「Variant Config Bundle Pattern」：

- 5 維 bundle 結構（i18nNamespace / cropConfig / settingsField / cardImageType）
- 新 variant SOP checklist（8 步）
- union 而非 intersection 的設計理由
- Optional map 而非 required map 的節奏考量

## Cross-link

- Master DEV LOG：Round 2 第 1–4 點 — `DEV/08-2026/0901-background-uploader-implementation.md`
- Rule 028 § 16 Variant Config Bundle Pattern（NEW）
- Rule 028 § 12.1 Stage Width Floor（feedback #1 同步）
- Rule 028 § 11.1 Rectangular Crop Window（feedback #3 同步）
- SKILL saome-image-upload § Variant Config Bundle（NEW）
