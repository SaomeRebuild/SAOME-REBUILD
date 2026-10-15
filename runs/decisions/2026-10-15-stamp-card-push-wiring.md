# Decision: Stamp / Multipass 卡模板 Push 派發讀 0.png

## 背景

2026-10-13 stamp card 圖片合成管線上線(`stamp-images/services/uploadStampImage.ts` +
前端 `StampCardImageComposer`)後,CardBuilder Step 8 會在 publish 前先將空模板的
`0.png`(含背景圖 + stamp grid + 已蓋章 icon)寫入 R2,key 為
`tenants/{tenantId}/templates/{templateId}/stamp-{fillCount}.png`。

但 Passcreator push 端從未讀取這個檔案 — `passTemplateMapping.ts` 的 `images` IIFE
只讀 `settings.backgroundImage`,所以 Passcreator 收到的 strip 永遠是租戶上傳的背景圖
(常缺席),0.png 完全沒被推到 Apple Wallet / Google Wallet 的 strip slot。

這次修法把「0.png 是 stamp_card / multipass 的 strip background」寫進派發邏輯,並
新增公開 R2 proxy 讓 Passcreator(V2 server-to-server client,無 JWT)能 fetch。

## 選項與決定

### 選項 A — 改用 0.png 當 strip;其他卡種維持 settings.backgroundImage

- **做法**:在 `passTemplateMapping.ts` 加 cardType 派發;`stamp_card` /
  `multipass` 用 `template_stamp_card_images` 的 0.png,其他卡種繼續走既有路徑
  (settings.backgroundImage → `/api/pass-templates/:id/background` proxy)。
- **新檔**: `apps/backend/src/modules/pass-templates/routes/getTemplateStampImage.ts`
  (對應 `GET /api/pass-templates/:id/stamp-image/:fillCount`)。
- **理由**:Passcreator 把 strip 圖片放進 `images.background` slot;
  0.png 已經是「租戶背景 + 蓋章 grid + 客戶真實可見內容」,直接當 strip 最直觀。
- **限制**:multipass 的 grid 細節(fillCount=0 + multipass 專屬 icon)目前未實作,
  後續 follow-up;本次只確保 push 派發讀得到 0.png,設計與 multipass UI 共用
  `buildZeroFillStampInput` 入口。

### 選項 B — 0.png 當額外的 strip variant,settings.backgroundImage 維持優先

- **做法**:在 `images` IIFE 同時 emit `background` 與 `backgroundVariant`,
  Passcreator 自動選優先序。
- **缺點**:Passcreator V2 schema 不支援多個 strip 變體;要 fork `images.background`
  之外的 key,會破壞既有 `backgroundDifferentForEachPass` 行為。

### 選項 C — 不推到 Passcreator,在 SAOME iOS/Android App 內自行渲染 strip

- **缺點**:PassKit spec 強制 strip 圖必須由 template 提供(Apple Wallet
  在 PassKit render 階段就拿 strip),App 渲染無法繞過;SAOME 也不維護
  native app 的 strip 渲染邏輯。

### **決定**:選項 A。

- 對應用戶原話:「記住,只有Stamp跟Multipass卡的模板推送需要用這種圖當背景,
  其他卡種一樣使用租戶原來上傳的背景圖。」
- cardType 派發在 backend `passTemplateMapping.ts` images IIFE,前端不感知派發邏輯。
- Multipass 的 grid UI 與 icon 細節是 follow-up;這次只確保 push 端能讀到 0.png,
  並確保 Step 8 的 pre-render 也會在 multipass 模板觸發。

## 影響

### 改動檔案

| 檔案 | 改動 |
|---|---|
| `apps/backend/src/modules/pass-templates/routes/getTemplateStampImage.ts` | 新檔 — 公開 R2 proxy,GET `/:id/stamp-image/:fillCount` |
| `apps/backend/src/modules/pass-templates/index.ts` | mount 新 route |
| `apps/backend/src/modules/stamp-images/db/stampImages.ts` | 新增 `findStampImageAudit` JOIN helper |
| `apps/backend/src/modules/pass-templates/services/passTemplateSync.ts` | 加 `sql: Sql` arg;讀 stamp image row;thread `stampImageKey` |
| `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` | `MapTemplateToPasscreatorArgs.stampImageKey` 新欄位;`r2KeyToPublicUrl` 加 `'stamp'` type + `fillCount?`;images IIFE 加 cardType 派發 |
| `apps/backend/src/modules/cards/services/cardService.ts` | 把既有 `sql` 傳給 `syncTemplateToPasscreator` |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step8Save/Step8Save.hooks.ts` | `cardType === 'stamp_card'` → `\|\| cardType === 'multipass'`;`buildZeroFillStampInput` 加 `templateId` 參數,內部把 `state.backgroundImage`(R2 key)解析成 public proxy URL |
| `packages/shared/constants/stampCard.ts` | `STAMP_DEFAULT_CANVAS` 從 `{1024, 640}` 改成 `{1860, 738}`(對齊 Passcreator strip spec) |
| `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.stamp-image.test.ts` | 新檔 — 8 條 conformance test |
| `apps/backend/src/modules/pass-templates/tests/getTemplateStampImage.test.ts` | 新檔 — 7 條 conformance test |

### 對其他卡種的影響

- **membership_card / reward_card / cashback_card / discount_card / coupon_card
  / gift_card**:`stampImageKey` 永遠是 null,push 派發讀 `settings.backgroundImage`
  → `/api/pass-templates/:id/background`,行為完全不變。
- Conformance test (`passTemplateMapping.stamp-image.test.ts`) 對這六種卡種各
  pin 一條「stamp dispatch 不生效」的 test,防止未來誤把其他卡種也走 stamp 路徑。

### 對前端 CardBuilder preview 的影響

- `state.backgroundImage`(R2 key)以前被 CardBuilderEditorPreview.tsx
  用 `${api.baseUrl}/api/cards/${cardId}/image/background?token=...` 包成 auth URL。
  改完後 Step8Save 的 composer 改用 public proxy URL(`/api/pass-templates/${id}/background`)
  — 因為 R2 key 是 raw path string,`fetch()` 必須有可解析 URL 才能載入背景,
  不然會 fallback 成白色。
- Step 3 preview 的 auth URL 路徑不變(由 `CardBuilderEditorPreview.tsx`
  的 `backgroundImageUrl` 自己組),所以 preview 行為不受影響。

### 對 compose 流程的影響

- 之前:`buildZeroFillStampInput` 把 `state.backgroundImage`(R2 key)直接塞給
  `input.background.url` → composer `fetch(R2 key)` 視為相對路徑 404 →
  fallback 白色。
- 之後:`buildZeroFillStampInput(state, templateId)` 透過 `resolveBackgroundImageUrl`
  把 R2 key 轉成 public proxy URL → composer `fetch(httpsURL)` 成功 → 背景圖進到 0.png。

### 對 deploy 的影響

- 沒新 DB migration,沒新 secret,沒新 env var。
- Backend deploy 後即可生效(`wrangler deploy`)。
- 前端 bundle 增加的常數(1860×738)+ helper function < 1KB gzip。
- Cloudflare Pages 部署後必跑 grep localhost(per Rule 017)確認沒漂移。

## 觸發 Rules

- Rule 001 § Decision Log — 新 DB table(`template_stamp_card_images`)被 Push pipeline 讀取,
  屬 P0 架構改動,必須進 Decision Log。
- Rule 011 § 必填 commit footer — `Refs:`(此 Decision)、`Sync:`(GitHub commit SHA)、
  `Self-improvement:`(feedback)。
- Rule 017 § Production Bundle Guard — deploy 後 grep localhost。
- Rule 019 § Schema Contract Drift — `MapTemplateToPasscreatorArgs.stampImageKey` 是契約,
  必加 conformance test。
- Rule 035 § Migration Apply Pipeline — 本次無新 migration,跳過。
- Rule 037 § MCP Tool Call Pattern — 本次無 MCP 呼叫,跳過。