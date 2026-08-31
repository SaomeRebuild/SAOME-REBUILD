# IconUploader 實作紀錄（2026-08-31）

## TL;DR

把既有 `LogoUploader`（332 行）**重構**為 `MediaAssetUploader`，透過 `variant: 'logo' | 'icon'` 切換 namespace / crop config / validator / settings field。新增 IconUploader 完整鏈（schema 4-layer sync + Zustand store + Step 3 整合 + PhoneFrame 推播預覽）。

## 為什麼選 Refactor → MediaAssetUploader 而非平行 IconUploader

| 選項 | 代價 | 評估 |
|---|---|---|
| **平行 IconUploader** | 重新 887 行 hook chain + 7 sub-component + 既有 mobile fix 全部重做 | ❌ 高風險,違反 Rule 000 § A.3 |
| **Refactor LogoUploader → MediaAssetUploader**（採用）| 既有的 332 行主組件變體化、crop config 由 prop 注入 | ✅ 共用同一 hook chain、既有 5 輪 mobile fix 自動繼承 |

`LogoUploader` 經過 5 輪 mobile fix（stale closure / chain min-w-0 / iPhone 12 padding / drag stutter / landscape stage）才穩定。**重構而非複製** 是唯一路徑。

## Icon 規格決策（Passcreator push notification spec）

| 項目 | 值 | 來源 |
|---|---|---|
| 輸出尺寸 | **720×720 PNG** | Passcreator push notification icon 最小 |
| 最小輸入寬度 | 720px | 同上 |
| 最大檔案 | 5MB | 與 logo 一致 |
| 允許 MIME | PNG / JPG | PNG 強制(transparency) |
| R2 命名 | `{tenantId}/{templateId}/icon.png` | 固定 `.png`,避免 backend 再做格式轉換 |

## 4-Layer Schema Sync（Rule 019 § 4.1）

| Layer | 檔案 | 變更 |
|---|---|---|
| 1 — shared schema | `packages/shared/schemas/card.ts` | `templateSettingsSchema.iconImage: z.string().optional()` + `backgroundImage` 預留 |
| 2 — backend request | `apps/backend/src/modules/cards/schemas/request.ts` | mirror Layer 1 |
| 3 — backend DB interface | `apps/backend/src/modules/cards/db/templates.ts` | `TemplateSettings.iconImage?: string` + `backgroundImage?: string` |
| 4 — backend service | (auto-covered via `Partial<TemplateSettings>`) | — |
| Conformance test | `apps/backend/src/modules/cards/tests/schema-conformance.test.ts` | 新建,5 assertions 通過 |

## Phase 7b 關鍵 Bug Fix（IconUploader 33% over-scale）

**Bug**：`useImageCrop.web.ts` 硬寫 `MAX_LOGO_SIZE = LOGO_CROP_CONFIG.OUTPUT_WIDTH`（永為 960）。若 icon variant 用同一 hook,即使 `outputWidth: 720, outputHeight: 720`,Canvas 仍輸出 960×960 PNG——違反 Passcreator 規範、浪費 33% 頻寬。

**修法**：

```ts
// Before
const MAX_LOGO_SIZE = LOGO_CROP_CONFIG.OUTPUT_WIDTH;
canvas.width = MAX_LOGO_SIZE;
canvas.height = MAX_LOGO_SIZE;

// After
export type CropImageFn = (
  image: HTMLImageElement,
  cropState: CropState,
  cropWindowSize: number,
  baseCanvasWidth: number,
  outputWidth: number,        // ← 新參數
  outputHeight: number | null,
) => Promise<Blob>;

// canvas.width = outputWidth; canvas.height = outputHeight ?? outputWidth;
```

驗證：`useImageCrop.web.test.ts` 兩個 case（logo: 960×NH / icon: 720×720）皆 pass。

## PhoneFrame 推播預覽（Phase 9）

**使用者確認**：icon 是 push notification 用,**不出現在 PassCardPreview（卡片 mockup 本身）**。

實作位置：`PreviewWrapper/PushNotificationMockup/`（L2 sub-component）。
**明確不動**：
- `PhoneFrame` (L1 generic SVG shell,Rule 022 禁止 L2 改 L1)
- `PassCardPreview` / `PassCardPreviewHeader` / `PassCardPreviewStrip`（卡片模板本身）

URL 構造遵守 Rule 028 § 13 / § 14：
```ts
const iconUrl = `${api.baseUrl}${api.paths.cardImage(cardId, 'icon')}`
              + `?token=${encodeURIComponent(getAccessToken() ?? '')}`
              + `&v=${iconImageVersion}`;
```

## i18n 動態切換 namespace 的解法

`MediaAssetUploader` 是單一元件服務多 variant,需切換 `useTranslation` namespace（`logoUpload` vs `iconUpload`）。Rule 023 § 元件化原則要求 component-bound namespace,但這裡兩個 namespace 共享同一個元件。

**解法**：**動態 `useTranslation(config.i18nNamespace)`**,不違反 namespace 規範。

```tsx
const config = MEDIA_ASSET_CONFIG[variant]!;
const { t } = useTranslation(config.i18nNamespace);
```

## MediaAssetUploader 結構

```
components/business/dashboard/CardBuilderEditor/MediaAssetUploader/
├── MediaAssetUploader.tsx               ← 主組件(variant-agnostic,~340 行)
├── MediaAssetUploader.types.ts           ← SupportedMediaAssetVariant
├── MediaAssetUploader.test.tsx           ← 19 tests (logo 16 + icon 3)
├── MediaAssetUploader.chain.test.tsx
├── MediaAssetUploader.momentum.test.tsx
├── MediaAssetUploader.touch-drag.test.tsx
├── index.ts
├── Preview/                              ← variant-agnostic（原 LogoPreview）
├── CropStage/                            ← variant-agnostic
├── ScaleControl/
├── CropActions/
├── UploadError/
├── UploadPrompt/
└── UploadingIndicator/
```

主組件 340 行超 Rule 000 § A.2 的 100 行門檻（**已 ticket**——下一輪再拆,本期先 ship functional）。

## Verification 輸出

| 項目 | 結果 |
|---|---|
| `npx tsc -b --noEmit` | exit 0 |
| `npm run lint` | exit 0（pre-existing warnings only） |
| `npm test` | **279 passed / 5 skipped / 0 failed** |
| `npm run verify:i18n` | 15 namespaces / 30 locale files OK |
| backend `vitest run schema-conformance` | 5 passed |

## 已知技術債 / 後續工作

| # | 項目 | 處理優先 |
|---|---|---|
| 1 | MediaAssetUploader.tsx 主組件 340 行 > Rule 000 § A.2 100 行門檻 | 中（功能穩定後拆） |
| 2 | CropStage 內部 testid `logo-crop-outer`/`logo-crop-stage`/`logo-crop-frame-layer` 含 "logo" prefix | 低（純測試用） |
| 3 | CropImageFn signature 含 `HTMLImageElement`（RN 化障礙）| 低（獨立 RN-migration PR） |
| 4 | BackgroundUploader 實作（`backgroundImage` schema 已預留）| 下一個 plan |
| 5 | Smoke test（Playwright）需要真實 backend 才能完整驗證 | 上線前必跑 |

## Self-improvement

### 衍生的 pending action

- [ ] MediaAssetUploader 主組件拆 sub-component（> 100 行 → 100 行內）
- [ ] CropStage testid 重命名為 variant-agnostic
- [ ] BackgroundUploader 計畫

### 寫進 INDEX.md

詳見 `runs/improvements/INDEX.md` 的 IconUploader 條目。
