# Feedback: Stamp / Multipass 0.png Push Pipeline Fix

> Stamp card image composition pipeline — Passcreator push wiring v15。

## 症狀(由 user 回報,2026-10-15)

User 觀察一個已上線 stamp_card 模板的 R2 路徑
`tenants/efb3fbbc-.../templates/7d472cfa-.../stamp-0.png` 後,回報三個症狀:

1. **他沒有被 push 到 Passcreator** — 0.png 已經在 R2,但 Passcreator 拿不到;
   deployed pass 的 strip 圖是租戶上傳的 backgroundImage(可能缺失或不是用戶預期的)。
2. **沒有吃到背景圖** — 0.png 的背景是純白,看不到租戶在 Step 3 上傳的背景圖。
3. **Grid 沒有上下左右置中** — 0.png 的 grid 在 Passcreator 部署的 strip 上看起來
   偏一邊,不是 CardBuilderEditor 預覽的位置。

## 根因分析

### Issue 1:Passcreator 派發不讀 0.png

`apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts::images` IIFE
(line 752–754,v14)只讀 `settings.backgroundImage`,從未查詢
`template_stamp_card_images` 表。Passcreator 把 0.png 完全忽略。

Stamp card 圖片合成管線(`stamp-images/services/uploadStampImage.ts`,v13 2026-10-13)
已經成功把 PNG 寫到 R2,Passcreator 端就是「有資料但沒人讀」的孤兒狀態。

### Issue 2:R2 key 不能直接 fetch

`state.backgroundImage`(Zustand store)是 **R2 key**,**不是** URL — 從
`MediaAssetUploader.tsx::setStoreField(key)` 的呼叫端看很清楚。CardBuilder
預覽是靠 `CardBuilderEditorPreview.tsx` 把 key 重新包成 auth URL
(`${api.baseUrl}/api/cards/${cardId}/image/background?token=...`)再餵給 `<img>`,
所以預覽看得到背景圖。

但 `composeStampCardImage.web.ts::loadImageBitmap(url)` 是直接 `fetch(url)` — 給 R2 key
會被瀏覽器視為相對路徑,結果 404 → catch 後 fallback 成白色畫布。所以上傳的
背景圖完全沒進到 0.png。

### Issue 3:Canvas 比例不對齊 Passcreator strip

`STAMP_DEFAULT_CANVAS = { width: 1024, height: 640 }`(16:10 寬螢幕),但 Passcreator
V2 期望 strip 是 1860×738(2.52:1,見
`packages/shared/constants/card-images.ts::BACKGROUND_CROP_CONFIG` line 140)。

`computeStampGridLayout` 在 16:10 畫布下把 grid 算成「置中」沒錯,但 Passcreator
會把 16:10 的圖縮放/裁切到 2.52:1,grid 在 strip 上視覺偏移。

對 5×4 grid + padding=8 + gap=4,在新 1860×738 畫布下重算:
- cellSize = min((722-12)/4, (1844-16)/5) = min(177.5, 365.6) = **177**
- gridWidth = 177×5 + 4×4 = **901**
- gridHeight = 177×4 + 4×3 = **720**
- offsetX = 8 + floor((1844 - 901)/2) = 8 + 471 = **479**
- offsetY = 8 + floor((722 - 720)/2) = 8 + 1 = **9**
- left/right margin 各 479/480(±1px floor 差異)、top/bottom margin 各 9 — **置中**。

## 修法(2026-10-15 v15)

詳見 `runs/decisions/2026-10-15-stamp-card-push-wiring.md`。4 個 Phase:

### Phase 1:Backend — 0.png 進入 Passcreator push

- 新增 `apps/backend/src/modules/pass-templates/routes/getTemplateStampImage.ts`
  公開 R2 proxy。`findStampImageAudit` JOIN `templates` + `template_stamp_card_images`
  一次查詢 tenant_id + r2_key(atomic)。
- `passTemplateSync.ts` 加 `sql: Sql` arg,讀 0.png row,thread `stampImageKey`。
- `passTemplateMapping.ts` 加 `MapTemplateToPasscreatorArgs.stampImageKey`;`images` IIFE
  派發 `cardType === 'stamp_card' || cardType === 'multipass'` → 用 0.png;其他卡種
  維持 `settings.backgroundImage`。
- `r2KeyToPublicUrl` 加 `'stamp'` type + optional `fillCount` 參數,emit
  `${r2PublicUrl}/api/pass-templates/${templateId}/stamp-image/${fillCount}`。

### Phase 2:Frontend — Step8Save 加入 multipass 派發

- `Step8Save.hooks.ts` 把 `if (cardType === 'stamp_card')` 改成
  `if (isStampish)`(`cardType === 'stamp_card' || cardType === 'multipass'`)。
- `buildZeroFillStampInput(state, templateId)` 多吃 `templateId`,內部用
  `resolveBackgroundImageUrl` 把 R2 key 轉成 public proxy URL。

### Phase 3:Shared — Canvas 1860×738

- `STAMP_DEFAULT_CANVAS` 從 `{1024, 640}` 改成 `{1860, 738}`。
- `computeStampGridLayout` 不需改 — 已吃任意 (w, h);新尺寸下 grid 自動置中
  (計算見上)。

### Phase 4:Frontend — Background URL 改成 public proxy

- `buildZeroFillStampInput` 內部用 `resolveBackgroundImageUrl(r2Key, templateId)`
  把 R2 key 解析成 `${apiBaseUrl()}/api/pass-templates/${templateId}/background`。
- 該 URL 與 Passcreator 推送時讀的是同一條公開 proxy,沒有過期問題。

## Conformance Tests(8 + 7 條)

### `passTemplateMapping.stamp-image.test.ts`(8 條)

1. stamp_card + stampImageKey → `out.background` = `${r2}/.../stamp-image/0`,**不**是
   `settings.backgroundImage`
2. multipass + stampImageKey → 同 #1
3. stamp_card + `stampImageKey = null` → fallback `settings.backgroundImage`
4. stamp_card 沒傳 `stampImageKey` → fallback(向後相容)
5. 其他六種卡種即使傳 `stampImageKey` → 仍走 `settings.backgroundImage`(防誤用)
6. stamp_card + stampImageKey + 沒 `settings.backgroundImage` → `out.background`
   還是 stamp URL
7. stamp_card 仍 emit `backgroundDifferentForEachPass = true`(v14 default-on 保留)
8. icon / logo 不受 stamp dispatch 影響

### `getTemplateStampImage.test.ts`(7 條)

1. 沒上傳 0.png → 204
2. template 找不到 → 204
3. r2_key 不 match → 204 silent 防 cross-tenant probing
4. r2_key match + R2 hit → 200 + cache headers
5. r2_key match + R2 miss → 204 silent
6. UUID 格式錯 → 404(不 500,避免吸引 retry)
7. tenant_id NULL → 204(corrupted row defense)

## 設計取捨

| 選擇 | 原因 |
|---|---|
| `findStampImageAudit` JOIN 取代兩段 SELECT | 一次查詢,避免 route 端兩次 SQL 來回;atomic snapshot |
| Public proxy 走 `/api/pass-templates/:id/stamp-image/{fillCount}`(不是 `/:id/image/:stamp-0`) | 對齊既有 `getTemplateImage` 的 `/:id/{type}` pattern,前端 `r2KeyToPublicUrl` 改一個地方 |
| Multipass 的 grid UI 細節不在這次 scope | user 確認「該走這條鏈」但沒要求 multipass grid 細節;follow-up 處理 |
| `state.backgroundImage` 仍存 R2 key(不存 public URL) | DB 端 schema 是 key(string),改 store 型別會影響其他下游;用 `resolveBackgroundImageUrl` helper 在 Step 8 出口轉換 |
| 公開 proxy 不帶 `backgroundDifferentForEachPass = false` | v14 行為對 stamp_card 也保留(`true`);Passcreator 仍能 per-pass 覆寫 |

## 觸發 Rules

- Rule 001 § Decision Log 觸發範圍 → 寫 Decision Log(必填)
- Rule 011 § 必填 commit footer → 寫 feedback
- Rule 019 § Schema Contract Drift → 新 arg `stampImageKey` 必加 conformance test
- Rule 035 § Migration Apply Pipeline → 本次無新 migration,跳過
- Rule 037 § MCP Tool Call Pattern → 本次無 MCP 呼叫,跳過

## Self-Improvement Action Items

| # | Action | Priority |
|---|---|---|
| 1 | 後續 StampImage 1..15.png 的 Scanner 整合(Plan Phase 3)上線時,沿用 `findStampImageAudit` + `r2KeyToPublicUrl(... 'stamp', n)` 路徑,不要複製新一條 dispatch | P2 |
| 2 | multipass 的 grid UI 與專屬 icon(現在兩種卡都會跑 0.png pre-render,但 multipass 的 grid 設計與 stamp 不同) | P3 |
| 3 | `Step8Save.hooks.ts::buildZeroFillStampInput` 目前與 `MediaAssetUploader` 的背景 URL 處理走兩條路(後者用 auth URL,前者用 public proxy);若未來要統一,先把 `CardBuilderEditorPreview` 的 auth URL 也換成 public proxy | P3 |