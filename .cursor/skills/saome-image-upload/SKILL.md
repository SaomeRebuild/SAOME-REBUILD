# saome-image-upload

> 觸發時機：實作任何圖片上傳元件（LogoUploader、BackgroundUploader、IconUploader 等）。

## 觸發關鍵字

「上傳圖片」「做 uploader」「R2 上傳」「圖片裁切」「LogoUploader」「BackgroundUploader」

---

## 完整流程圖

```mermaid
flowchart TD
 subgraph Step1[Step 1：準備]
 A1[確認 imageType enum 值] --> A2[建立 i18n namespace]
 end

 subgraph Step2[Step 2：Backend]
 B1[POST generate-upload-url] --> B2[aws4fetch 簽署 presigned URL]
 B2 --> B3[GET 圖片 proxy]
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

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { generateUploadUrl } from '../services/generateUploadUrlService';

export const generateUploadUrlRoute = new Hono();

generateUploadUrlRoute.post('/:id/upload-url/:type', async (c) => {
  const id = c.req.param('id');
  const imageType = c.req.param('type') as string;
  const result = await generateUploadUrlService(id, imageType, c.env);
  return c.json(result);
});
```

`generateUploadUrlService` 使用 `aws4fetch` 對 R2 endpoint 簽署 PUT URL：

```typescript
import { S3SignedURL } from 'aws4fetch';

export async function generateUploadUrlService(
  cardId: string,
  imageType: string,
  env: Env,
) {
  const key = `${cardId}/${imageType}/${Date.now()}.png`;
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

詳見 `apps/frontend/src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.tsx`。

### Step 7：Settings merge（在 cardService.update 內）

```typescript
// apps/backend/src/modules/cards/services/cardService.ts
// 必須 fetch → merge → write，禁止直接覆蓋 settings
const updateData = {
  ...existingData,
  settings: { ...existingData.settings, ...input.settings },
};
```

詳見 Rule 027（postgres dynamic query）+ Rule 028 § Settings merge。

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
| 1. 生成 | Worker 用 `aws4fetch` 對 R2 bucket 簽署 PUT URL（有效期 1 小時） |
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
