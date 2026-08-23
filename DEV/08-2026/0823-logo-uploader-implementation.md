# LogoUploader 實作日誌（Aug 23, 2026）

## Metadata

| 欄位 | 值 |
|---|---|
| 日期 | 2026-08-23 |
| 時間 | ~07:00–08:30 UTC+8 |
| 作者 | Cursor Agent + Josh |
| 觸發背景 | Step 3 卡片編輯器需要 issuerLogo 上傳功能 |
| 關聯 commits | `1c6ec4b`, `94f6fe5`, `baca473` |

## 背景

CardBuilder Step 3（卡片預覽）需要讓使用者上傳 issuerLogo。上傳後的圖片 URL 要寫入 `templates.settings.issuerLogo`，並在 `PassCardPreview` / `TemplateCardPreview` 顯示。

技術選型：
- **不走 Worker streaming**（Worker 有 50ms CPU time budget，streaming 大檔會爆）
- **走 R2 presigned URL**：前端直接 PUT 到 R2，Worker 只做簽署

## 實作時間線

### 07:48 — `1c6ec4b` feat: issuer logo upload flow with R2 proxy

核心實作：

**Backend**
- `POST /api/cards/:id/upload-url/:type`：根據 `imageType`（`issuerLogo`）生成 R2 presigned PUT URL
- `GET /api/cards/:id/image/:type`：透過 Hyperdrive 代理讀取 R2 圖片（避免 CORS 問題）
- `generate-upload-url.ts` 使用 `aws4fetch` 對 `R2_ACCOUNT_ID.r2.cloudflarestorage.com` 簽署 PUT URL
- Settings merge：在 `cardService.update()` 內 fetch → merge → write，避免覆蓋其他欄位

**Frontend**
- `LogoUploader` 元件：支援拖曳 focal point、滾輪縮放、裁切預覽
- 使用 `HTMLCanvasElement` 裁切，normalize focal point 寫入 `settings.issuerLogoFocalPoint`
- 上傳成功後寫入 `lastUploadedLogoKey` state（優於直接讀 Zustand store，避免時機問題）
- `PassCardPreviewHeader` / `TemplateCardPreview` 改用 proxy URL `/api/cards/{id}/image/issuerLogo`

**Shared**
- `packages/shared/constants/card-images.ts`：定義 `IMAGE_TYPE` enum（`issuerLogo` | `backgroundImage` | `icon`）
- `packages/shared/constants/r2.ts`：`buildCardImageR2Key()` 統一 R2 key 生成邏輯

**觸發的 rules/skills**
- Rule 025（L2 checklist）：i18n namespace 沒先建立（寫進 `cardBuilder` 而不是獨立 namespace）
- Rule 027（postgres dynamic query）：settings merge 差點踩雷（直接覆蓋 vs fetch-merge-write）

**Bug 在實作中即時修掉**
- Bug-A：Drag direction 與滑鼠方向相反 → 根因 `focalDx = -dx / displayWidth` 的負號
- Bug-B：Step 2 找不到 `IssuerNameField` → import path 指向錯誤的 index
- Bug-C：上傳成功但 settings 被覆蓋 → fetch → merge → write 修法
- Bug-D：上傳成功但前端不顯示 → `lastUploadedLogoKey` state 修法

### 07:58 — `94f6fe5` fix: R2_PUBLIC_URL binding and correct publicUrl path

修復 generate-upload-url.ts 的 presigned URL：
- 原本用 raw R2 URL `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com/<bucket>/<key>` → 前端 CORS 403
- 改用 backend proxy URL `https://saome-backend.josh1989213.workers.dev/api/cards/{id}/image/{type}`
- 同時加 `wrangler.jsonc` `R2_PUBLIC_URL` binding 與 `bindings.ts` `R2_PUBLIC_URL` 型別

### 08:08 — `baca473` fix: expand R2 CORS to allow all SAOME production origins

修復 `r2-cors.json` 最終版：
- `allowed_origins` 包含 production frontend `https://saome-frontend.pages.dev` 與 `https://saome-frontend-*.pages.dev`
- `allowed_origins` 包含 R2 endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`
- `allowed_headers: ["*"]`（aws4fetch 簽署請求帶 `x-amz-*` headers，wildcard 必要）

## 衍生（待做）

- [ ] `BackgroundUploader`：Step 3 的背景圖上傳，pattern 完全相同
- [ ] `IconUploader`：未來可能需要的 icon 上傳
- [ ] **RN migration：TOKEN storage** — 目前使用 `localStorage` 儲存 `lastUploadedLogoKey`，RN 無法使用 localStorage。未來 RN 化時需：
  1. 改用 `react-native-mmkv` 或 `@react-native-async-storage/async-storage`
  2. 將 presigned URL 改為 Server-side 生成（避免前端直接持有 Signing Key，直接用 Cookie 儲存 short-lived session token）
- [ ] 裁切 logic 抽離 Canvas：目前 `useImageCrop.ts` 依賴 `HTMLCanvasElement`，RN 化時需替換為 `react-native-image-crop-picker`，裁切運算（normalize focal point、crop rect）必須寫在 `packages/shared/logic/` 為純函式

## 自問

**Q1：為什麼 i18n 放進了 `cardBuilder` namespace？**

A：觸發 L2 checklist（Rule 025）時，忘記先建立獨立 namespace 就直接寫了。未來任何 L2 元件上傳翻譯都必須先建立自己的 component-bound namespace（如 `logoUpload`），禁止放在 feature namespace（`cardBuilder`）。

**Q2：為什麼不走 Worker streaming upload？**

A：Cloudflare Worker 有 50ms CPU time budget，streaming 大圖（數 MB）會在 time budget 內來不及處理完並發給 R2。Presigned URL 把頻寬成本 offload 到 R2，Worker 只做簽署，CPU time 用量極低。
