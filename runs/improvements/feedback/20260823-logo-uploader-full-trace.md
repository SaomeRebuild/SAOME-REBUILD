# LogoUploader 實作 Feedback（Aug 23, 2026）

## Bug 1：拖曳方向與滑鼠方向相反

### 根因

`useImageCrop.ts` 的 `handleDrag` 計算 `focalDx` 時，錯誤地直接除以 `displayWidth`，沒取負值：

```typescript
// ❌ 錯誤
const dx = e.clientX - dragStart.current.x;
const newFocalX = dragStart.current.focalX + dx / displayWidth;
```

滑鼠往右拖（`dx > 0`），focal point 視覺上跟著往右，邏輯正確。但實際上 `displayWidth` 的方向定義與 DOM 座標相反（DOM 原點在左上，往右遞增，往左遞減），直接除以 `displayWidth` 讓值變成 `dx / displayWidth`（正數），而 CSS `transform: translate()` 的正數是往右移。當 `dx` 為正（往右拖）時，正確行為應該是視覺 focal point 跟著滑鼠移動，但坐標計算需要取負號對齊 DOM vs CSS 的方向差異。

真實根因：`displayWidth` 是「容器的寬度」，而 CSS `transform: translate()` 的百分比是相對於**自身**尺寸。兩者的原點與正方向定義不同。

### 修法

```typescript
// ✅ 正確
const dx = e.clientX - dragStart.current.x;
const newFocalX = dragStart.current.focalX - dx / displayWidth;
```

---

## Bug 2：Step 2 找不到 IssuerNameField

### 根因

`CardBuilderEditorWorkspace.tsx` 內的 import path 指向錯誤的 index：

```typescript
// ❌ 錯誤
import { IssuerNameField } from '../Step2CardSettings';
// TypeScript 解析到 Step2CardSettings/index.ts，但 index.ts 沒 export IssuerNameField
```

正確的 export 在 `Step2CardSettings/IssuerNameField.tsx` 本身。

### 修法

```typescript
// ✅ 正確
import { IssuerNameField } from '../Step2CardSettings/IssuerNameField';
```

---

## Bug 3：上傳成功但 settings 被覆蓋

### 根因

`cardService.update()` 內直接拿 input 的 `settings` 欄位覆蓋 DB 既有值：

```typescript
// ❌ 錯誤：直接寫入，忽略既有 settings
const updateData = {
  ...existingData,
  settings: input.settings, // input 只有 issuerLogo，其他欄位全被洗掉
};
```

正確做法：input.settings 必須與 existingData.settings merge 後再寫入。

### 修法

```typescript
// ✅ 正確：fetch → merge → write
const updateData = {
  ...existingData,
  settings: { ...existingData.settings, ...input.settings },
};
```

---

## Bug 4：上傳成功但前端不顯示（lastUploadedLogoKey）

### 根因

上傳完成後馬上讀取 Zustand store，但此時 store 的 `issuerLogoKey` 尚未同步更新（API response 還沒回來，或 React 17 的 concurrent rendering 時序問題）。

### 修法

在 `CardBuilderEditorWorkspace` 內維護 `lastUploadedLogoKey` state，上傳成功後直接寫入該 state，優先於 store：

```typescript
const [lastUploadedLogoKey, setLastUploadedLogoKey] = useState<string | null>(null);

// 在 LogoUploader onSuccess callback 內
setLastUploadedLogoKey(key);
```

---

## Bug 5：R2 CORS 403（三階段修復）

### Stage 1：origin 沒加 production frontend

一開始 `r2-cors.json` 的 `allowed_origins` 只有 `localhost` 與 `http://127.0.0.1:5173`，production 部署後前端 fetch R2 PUT URL 直接 403。

**修法**：加 `https://saome-frontend.pages.dev` 與 `https://saome-frontend-*.pages.dev`。

### Stage 2：origin 沒加 R2 endpoint

即使加了前端 origin，瀏覽器在 R2 PUT preflight（OPTIONS）階段，response header 檢查 `Access-Control-Allow-Origin` 必須與實際 origin 完全匹配。當 `allowed_origins` 沒有包含 `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` 時，preflight 失敗。

**修法**：在 `allowed_origins` 加入 R2 endpoint URL。

### Stage 3：headers 沒加 wildcard

`aws4fetch` 簽署 PUT URL 時，會在 request header 加上 `x-amz-*` 系列 headers（如 `x-amz-content-sha256`、`x-amz-date`）。若 `allowed_headers` 沒有包含這些 headers，preflight 直接被拒。

**修法**：`allowed_headers: ["*"]`。

### 最終修法

`apps/backend/r2-cors.json` 完整版：

```jsonc
{
  "cors": {
    "allowed_origins": [
      "https://saome-frontend.pages.dev",
      "https://saome-frontend-*.pages.dev",
      "https://b370549...r2.cloudflarestorage.com"
    ],
    "allowed_headers": ["*"],
    "allowed_methods": ["PUT", "HEAD"],
    "max_age": 6000
  }
}
```

---

## Decision Log

### Decision 1：R2 presigned URL vs Worker streaming upload

**背景**：需要讓前端直接上傳圖片到 R2，Worker 要在什麼環節介入？

**選項 A：前端直接 PUT 到 R2（presigned URL）**
- Worker 只做：用 `aws4fetch` 生成 presigned PUT URL，回傳給前端
- 前端拿 presigned URL 直接 PUT 到 R2

**選項 B：前端 POST 到 Worker，Worker streaming 到 R2**
- 前端 POST file 到 Worker
- Worker streaming pipe 到 R2

**決定**：選項 A（presigned URL）

**理由**：Cloudflare Worker 有 50ms CPU time budget，streaming 大圖（數 MB）會在 time budget 內來不及處理完並發給 R2。Presigned URL 把頻寬成本 offload 到 R2，Worker 只做簽署，CPU time 用量極低。

---

### Decision 2：Settings merge vs 直接覆蓋

**選項 A**：直接覆蓋 `settings: { issuerLogo: key }`
**選項 B**：fetch → merge → write

**決定**：選項 B

**理由**：`settings` 是 JSONB，其他模組（membership extension、passType 等）也在寫 settings，直接覆蓋會洗掉其他欄位。

---

### Decision 3：Focal point coordinate system 方向約定

**選項 A**：`focalDx = dx / displayWidth`（正數方向）
**選項 B**：`focalDx = -dx / displayWidth`（負數方向）

**決定**：選項 B

**理由**：DOM 座標原點在左上，CSS `transform: translate()` 的正數往右移。當使用者往右拖滑鼠（`dx > 0`）時，視覺上 focal point 應該跟著往右，但坐標值計算時要取負號對齊 CSS transform 的方向約定。

---

## 待做

- [ ] **RN migration：TOKEN storage** — 目前使用 `localStorage` 儲存 R2 presigned URL token（`lastUploadedLogoKey`），RN 無法使用 localStorage。未來 RN 化時需：
  1. 改用 `react-native-mmkv` 或 `@react-native-async-storage/async-storage`
  2. 將 presigned URL 改為 Server-side 生成（避免前端直接持有 Signing Key，直接用 Cookie 儲存 short-lived session token）
- [ ] `BackgroundUploader` — Step 3 的背景圖上傳，pattern 與 LogoUploader 完全相同，可複用
- [ ] 裁切 logic 抽離 Canvas — 目前 `useImageCrop.ts` 依賴 `HTMLCanvasElement`，RN 化時需替換為 `react-native-image-crop-picker`，裁切運算（normalize focal point、crop rect）必須寫在 `packages/shared/logic/` 為純函式

## 觸發的 Rules

| Rule | 觸發點 |
|---|---|
| Rule 025（L2 checklist） | i18n namespace 沒先建立，直接寫進 `cardBuilder` |
| Rule 027（postgres dynamic query） | settings JSON merge 差點踩雷（fetch → merge → write） |
| Rule 017（bundle guard） | deploy 前要先設定 `wrangler.jsonc` 的 `R2_PUBLIC_URL` 與 `R2_ACCOUNT_ID` secrets |
| Rule 023（shared package / i18n namespace） | `logoUpload.*` key 應放在獨立 namespace，未來遷移成本高 |

## 自問

**Q1：為什麼 i18n 放進了 `cardBuilder` namespace？**

A：觸發 L2 checklist（Rule 025）時，流程意識不足。`LogoUploader` 是獨立的 L2 元件，翻譯應該有自己的 component-bound namespace（`logoUpload`），而不是放在 feature namespace（`cardBuilder`）。未來實作 `BackgroundUploader` 時，若需要同樣的翻譯 key，會造成 namespace 耦合。

**Q2：為什麼 presigned URL 不走 Worker streaming？**

A：Worker CPU time budget 50ms 限制，加上 presigned URL 把頻寬 offload 到 R2，Worker 只做簽署，是最乾淨的架構。

**Q3：未來做 BackgroundUploader 還要再做什麼？**

A：1. 在 `shared/constants/card-images.ts` 加 `backgroundImage` enum 值；2. 建立獨立的 `backgroundUpload.*` namespace；3. Backend `generate-upload-url.ts` 已經支援任意 imageType，不需要改；4. Frontend 複製 `LogoUploader` 調整 `imageType` 參數即可。
