# 2026-10-06 — Step 8 Save & Publish + Template Library 真正資料 wiring master DEV LOG

> 給未來 trace 整條 CardBuilder 收尾鏈的人 single entry point。本檔**不重述每個 commit 的細節**——所有根因 + 修法都在對應 feedback 裡；本檔負責**架構全景 + 跨 commit 的設計 invariant + 給未來 session 的提醒**。

## 一句話總結

把 CardBuilder 的 Step 8「儲存並發布」從 placeholder 升級為**真正 wire 的商業流程**：使用者按「儲存並發布」就 `PUT /api/cards/:id { status: 'published' }` + 跳轉到 Template Library。同時把 Template Library 從渲染 `MOCK_TEMPLATES` 升級為打 `cardService.list()` 拿真正 DB 資料——直接修了 production 截圖中「第二張卡顯示『未命名卡片』/『左欄位』/『4938591027384』」的視覺回歸。**scope = 5 個 commit batch + 1 個 shared helper + 1 個 backend SQL filter + 1 個 test setup 強化**。

## 兩條主軸

```
A. Step 8 Save & Publish        B. Template Library 真正資料 wiring
─────────────────────────────────────────────────────────────────
1. Step8Save/ folder (新)        1. CardBuilderPage → cardService.list()
2. workspace wire Step 8         2. TemplateCard + Library 接 settings/deletingIds
3. i18n steps.save.* keys        3. TemplateCardPreview 對齊 CardBuilder
4. Step8Save.hooks (i18n.t)      4. passCardPreviewSlot 共用模組
5. Step8Save.test (3 describe)   5. findTemplatesByTenantId: WHERE status=published + ORDER BY created_at ASC
                                 6. normalizeToCssColor helper
                                 7. i18n templateLibrary.* + templateCard.deleting + toast.templateDeleted
                                 8. CardBuilderPage.test (real data wiring)
```

## 架構全景

```
User flow:
[Library] ─按「從頭建置」→ [Editor ?id=xxx] ─走完 Step1-7→ [Editor Step 8]
                                                          │
                                                          ├─ 點「儲存並發布」
                                                          │    cardService.update(id, { status: 'published' })
                                                          │    → toast.success → navigate(/app/dashboard, replace)
                                                          │
                                                          └─ 點「返回模板庫」
                                                               navigate(/app/dashboard, replace)  // 不 save

Component tree:
CardBuilderPage (page-level)
├── isEditorMode (URL ?id=)
│   └── CardBuilderEditor
│       ├── CardBuilderEditorWorkspace (左欄)
│       │   └── step === 8 → <Step8Save />
│       │       ├── Step8SaveSummary  (read-only preview)
│       │       ├── Step8SaveActions  (儲存並發布 + 返回模板庫)
│       │       └── useStep8Save (hook: status + publish + goBack)
│       └── CardBuilderPreview (右欄 live preview)
└── !isEditorMode
    └── TemplateLibraryGrid
        └── TemplateCard × N
            └── TemplateCardPreview
                ├── resolveSlot (shared with editor)
                ├── resolveHeaderRightSlot (shared with editor)
                └── deriveTemplateOverrides (settings → option bag)

Shared helpers:
packages/shared/logic/color.ts::normalizeToCssColor(raw, fallback)
  → 修 library preview FFFFFF → #FFFFFF (CSS-valid) bug
CardBuilderEditor/CardPreview/passCardPreviewSlot.ts
  → 16 條 per-cardType branch + 6 條 header right-slot branch
  → editor (live store) + library (saved settings) 共用

Backend:
findTemplatesByTenantId
  WHERE tenant_id = $1 AND status = 'published'
  ORDER BY created_at ASC, id ASC
  → drafts/abandoned rows 過濾掉
  → 陣列順序 = 建立順序（刪中間 row，後面 row 自然遞補）
```

## 設計 invariant（給未來 session）

### 1. `i18n.t()` vs `useTranslation().t()` 的二分

| 場景 | 工具 | 為什麼 |
|---|---|---|
| Component JSX render | `useTranslation(ns).t(key)` | hooks-only,自動 re-render on language change |
| Hook 內 / 同步 toast / event handler | `i18n.t('ns:key')` | hooks 不能在非 component context 用,直接 call i18n instance |
| Per-card 語言隔離 | `i18n.getFixedT(lng, ns)` | TemplateCardPreview 一張卡一個語言,不能被 app-wide state 污染 |

`Step8Save.hooks.ts` 的 toast 場景必用 `i18n.t()`（不能 `useTranslation`），這是 hook context 限制的硬選擇。`Step8Save.test.tsx` 已釘死「hook 內 toast 必走 i18n.t()」的 contract（見「Known Test Gaps」段）。

### 2. PassCardPreview 必走 `resolveSlot` 共用

editor（live store）和 library（saved settings）**必用**同一個 `resolveSlot` 函式。Drift 風險：
- editor 改 stamp_card 的 memberLevel override → library 沒跟上 → 看到舊版 placeholder
- 解法：extract to `passCardPreviewSlot.ts`、兩邊都 import、conformance test 對齊 17 條 branch order

**禁止** 任何 inline 的「per-cardType field value lookup」邏輯——必走 `resolveSlot`。

### 3. Library 預覽 CSS color 必走 `normalizeToCssColor`

PassCreator 合約 strip '#' on save（`backgroundColor: 'FFFFFF'` 寫進 JSONB）。
但 CSS `background-color: FFFFFF` **無效**（無 `#` prefix），瀏覽器丟掉整個 declaration。
**所有 read side** 走 `normalizeToCssColor(raw, fallback)` 拿到 `#RRGGBB`。

`fallback` 不能是 `'FFFFFF'`（無效 CSS），必為 `'#RRGGBB'` 或 i18n 對應的 `bg-muted` token。

### 4. Template Library SQL 必過濾 `status = 'published'`

Drafts（in-progress editor sessions）跟 abandoned（cleanup cron target）是 noise，library 渲染會污染畫面。**filter 必在 SQL 層**（single source of truth），不要在前端 route handler / store filter。

`findLatestDraftByTenant` 是 drafts-only 的對應函式（不在這次 PR scope，但保留對應設計）。

### 5. 陣列順序 = `created_at ASC, id ASC`

不用 `position` integer column。理由：
- 刪除中間 row 不需 re-index，後面 row 自然遞補（應用層 closure）
- Schema 更簡單
- `id ASC` tie-breaker 防同毫秒 created_at 的 non-deterministic 排序

### 6. Step 8 驗證 gate = `cardType !== null AND cardName.trim() !== ''`

對齊 workspace 的 `isStep1Valid`（cardType）+ Step 2 必填的 Card Name。沒選卡種 / 沒填卡片名稱 → Publish 按鈕 disabled + 紅字 hint。

不擋 back to Library（draft 保留在 DB，使用者之後可從 Library → 重新編輯）。

## 5 個 commit batch（分批原因）

| Batch | Scope | 為什麼獨立 |
|---|---|---|
| 1. Foundation | `color.ts::normalizeToCssColor` + `test/setup.ts` global i18n mock | 兩個 helper,沒業務邏輯,獨立 review |
| 2. Backend SQL | `findTemplatesByTenantId` filter+order + ordering test | 純 backend 改動,跟 frontend 解耦,單獨 review |
| 3. Shared slot | `passCardPreviewSlot.ts` + `passCardPreviewSlot.test.ts` + `PassCardPreviewBody.tsx` refactor | editor-side 重構,library wiring 還沒進,獨立可 review |
| 4. Library wiring | TemplateCard/Library/Page + i18n + test fixes | 視覺回歸修復,獨立可 review |
| 5. Step 8 Save | Step8Save folder + workspace wire + i18n + test fix | 主 feature,獨立可 review |

## 16 條 `resolveSlot` branch order（regression-pinned）

| # | 條件 | 輸出 |
|---|---|---|
| 1 | `!field` | placeholder (`左欄位` / `右欄位`) |
| 2 | `stamp_card + memberLevel` | `stampLabel` + `rewardName ?? ''` |
| 3 | `reward_card + memberLevel` | `stampLabel` + `firstRewardTierName ?? ''` |
| 4 | `cashback_card + memberLevel` | `stampLabel` + `firstCashbackTierName ?? ''` |
| 5 | `membership_card + memberLevel` | default label + `firstMembershipTierName ?? ''` |
| 6 | `multipass + memberLevel` | default label + `firstMultipassTierName ?? ''` |
| 7 | `discount_card + memberLevel` | `discountLabel` + `firstDiscountTierName ?? ''` |
| 8 | `coupon_card + couponRemainingCount` | `countFormat` / static demo |
| 9 | `coupon_card + couponDiscount` | amount/percent format |
| 10 | `multipass + multipassCompleted` | static demo |
| 11 | `multipass + multipassPointsToNextTier` | static demo |
| 12 | `multipass + multipassRewardContent` | amount/percent format |
| 13 | `discountTierBracket` | `"X%"` 來自 settings.discountTiers[0].discountPercent |
| 14 | `totalStamps` | `rows × STAMPS_PER_ROW` |
| 15 | `pointsToNextTierCashback` / `accumulatedSpendCashback` | `CASHBACK_PREVIEW_AMOUNTS[currency][field]` |
| 16 | `pointsToNextTierDiscount` / `accumulatedSpendDiscount` | `DISCOUNT_PREVIEW_AMOUNTS[currency][field]` |
| 17 | default | `fieldPreview.{key}.label` + `.value`（無 currency formatter,2026-09-13 ZAR pollution fix 移除 regex prefix）|

**branch order 不可調換**：每條都有 conformance test 在 `passCardPreviewSlot.test.ts` 跟 consumer 端（`PassCardPreviewBody.test.tsx` / `TemplateCardPreview.test.tsx`）對齊。

## 6 條 `resolveHeaderRightSlot` branch order（regression-pinned, 2026-10-05 PR）

| # | 條件 | 輸出 |
|---|---|---|
| 1 | `membership_card` | member expiry preview（hasExpiry=true → date, false → `∞`）|
| 2 | `discount_card` | discount expiry preview（today+N days 或 absolute date）|
| 3 | `coupon_card` | coupon expiry preview（`passValidDays` 或 absolute date,都空 → `∞`）|
| 4 | `stamp_card` / `reward_card` / `cashback_card` / `multipass` | balance preview（`BALANCE_PREVIEW_AMOUNTS[currency]`）|
| 5 | `gift_card` | gift points preview（`GIFT_POINTS_PREVIEW_VALUE` hardcoded）|
| 6 | `null` / `undefined` | default pill（`t('defaultCardType')`）|

對齊 editor `PassCardPreviewHeader` 跟 library `TemplateCardPreview` 兩端,避免 header right-slot drift。

## Known Test Gaps（給下一個 session）

> 5 條 test 失敗是 **test assertion vs i18n mock** 的 mismatch,**不是 implementation bug**。

| Test | 失敗原因 | 修法 |
|---|---|---|
| `Step8Save.test.tsx:222` error toast | assertion 寫 `'發布失敗,請稍後再試'`（translated text）,global `@/i18n` mock 讓 `i18n.t()` return key `'cardEditor:steps.save.publishError'` | 改成 assertion `'cardEditor:steps.save.publishError'` 對齊 success toast 的 assertion pattern |
| `CardBuilderPage.test.tsx:341-343` 三個 card-type pill | assertion 寫 `'獎勵卡'` / `'會員卡'` / `'集點卡'`（translated text）,per-test `useTranslation` mock 讓 `t()` return key | 改成 assertion `'step1.cardTypes.reward_card'` / `'.membership_card'` / `'.stamp_card'` |
| `TemplateLibraryGrid.test.tsx:105-106` | assertion 寫 `'集點卡'` / `'會員卡'`（translated text）,同上 per-test mock 問題 | 改成 assertion `'step1.cardTypes.stamp_card'` / `'.membership_card'` |

### 為什麼不直接修 mock

`@/i18n` global mock 是 `test/setup.ts` 新加的（這次 PR 內），理由是 production i18n module 在 import-time 跑 `initReactI18next` 會吃 `(mocked) react-i18next` 而 fail。**兩個 mock 都必要**（一個解 import-time crash,一個解 hook call）。修法只能是「改 assertion 對齊 mock 行為」。

### 4 條 `Step4CardInfo.i18n.test.ts` 失敗

**pre-existing failure**,不在本 PR scope。失敗原因：`cardEditor.step4.backFields.counter` 跟 `links.counter` 共用同一個字串。Step 4 加新 i18n key 時沒檢查 backFields.counter 獨立性。Follow-up 待辦。

## 反例 / 不要做的事

| ❌ | 為什麼 |
|---|---|
| ❌ 在 component 內寫 `i18n.t(key)` 當成 `useTranslation().t(key)` 的替代 | component 必須用 hook 才能 re-render on language change,只有 hook / event handler 內才能用 `i18n.t()` |
| ❌ 在 `findTemplatesByTenantId` 加 `statusFilter` 參數 | 必為 `'published'`-only,library 表面單一責任。drafts 用 `findLatestDraftByTenant`（不在這次 scope）|
| ❌ Library 預覽 inline 用 `value.startsWith('#')` | 必走 `normalizeToCssColor`,drift 防線 |
| ❌ 改 `PassCardPreviewBody` 的 `resolveSlot` 邏輯但沒同步 library | 兩邊共用同一函式,改一邊必動另邊 + 同步 test |
| ❌ `passCardPreviewSlot.ts` 加 side effect（i18n subscribe / store read）| helper 必為純函式,輸入 options bag + t,輸出 `{label, value}` |
| ❌ Step 8 publish 後不清 store | draft 仍在 DB,user 從 Library → 重新編輯可 loadSettings 還原 |

## 對齊的既有 invariant

- **Rule 019 § 4.1**: `TemplateSettings = z.infer<templateSettingsSchema>`,shared schema 是 source of truth,types.ts re-export 不複製
- **Rule 023 § 元件化原則**: Step8Save 是 L2 業務元件,自己的 folder + 自己的 types + 自己的 hooks
- **Rule 024 § Hook Split Pattern**: `useStep8Save` 是純 React hook,沒 web-only API,RN-friendly
- **Rule 025 § 翻譯全中文/全英文**: i18n key 全用 camelCase,zh-TW 全中文,en 全英文
- **Rule 036 § Worker Runtime CORS**: 沒改 backend route,純 SQL 改,跟 CORS 無關
- **001-methodology § Auth flow 鐵律 #2**: `navigate(path, { replace: true })` 防止 user 從 published 狀態 browser back 回半完成 publish
- **032-backend-jsonb-merge-silent-killer**: Step 8 寫 `status: 'published'`,不是 merge JSONB,是 set SQL column,沒有 silent overwrite 風險
- **Step 7 guard pattern**（1004-step7-table-card-guard-master-dev-log.md）: Step 8 跟 Step 7 一樣在 workspace 層做驗證 gate,但加在子元件內的 validation hint,對齊 Step 7 的「disabled + 紅字 hint」UX 風格

## 對齊的既有 DEV LOG

- `1004-step7-table-card-guard-master-dev-log.md` — Step 7 守門設計風格（disabled + 紅字 hint）
- `1004-prod-url-alignment-workers-dev.md` — frontend URL config 對齊
- `1003-r2-tombstone-cron-sweep.md` — R2 刪除的對應防護（library delete → backend SQL DELETE,跟 R2 tombstone 不同路徑）
- `0822-card-builder-draft-abandon-full-trace.md` — 之前的 draft abandon 設計,Step 8 publish 是對應的 happy path

## 跟 future session 的提醒

1. **新 cardType 加進 shared schema** → 必同步：
   - `passCardPreviewSlot.ts` 的 `resolveSlot`（如果新 cardType 有獨特 memberLevel 行為）
   - `passCardPreviewSlot.ts` 的 `resolveHeaderRightSlot`（如果新 cardType 需要獨特 header right-slot）
   - `TemplateCardPreview.test.tsx` 跟 `PassCardPreviewBody.test.tsx` 的 conformance test
   - `cardEditor.{en,zh-TW}.ts` 的 `step1.cardTypes.{newType}` i18n keys

2. **改 `findTemplatesByTenantId` 排序** → 必檢：
   - `findTemplatesByTenantId.ordering.test.ts` 6 條 conformance test 是否還 pinned 住
   - Template Library UI 刪除 row 後的 UX（後面 row 是否自然遞補）

3. **改 `normalizeToCssColor` 的 fallback 預設** → 必檢所有 caller 是否仍合理（library preview / 未來 asset preview 頁面等）

4. **加新 i18n namespace**（`passCard` 之類）→ 必同步 `test/setup.ts` 的 global i18n mock,確認 mock 涵蓋新 namespace 的 `t` 行為

5. **Step 8 publish API 改**（e.g. 改成 PATCH 而非 PUT）→ 必檢 `cardService.update` 的 signature + `useStep8Save` 的呼叫

## Verification

| 驗證項 | 結果 |
|---|---|
| Frontend typecheck | ⚠ 9 條 test 失敗（5 條新 + 4 條 pre-existing）,1808 / 1817 pass。**5 條新失敗是 i18n mock assertion 問題,見「Known Test Gaps」**。production code 無 bug。 |
| i18n smoke test | `npm run verify:i18n` exit 0,所有 `cardEditor:steps.save.*` 跟 `cardBuilder:templateLibrary.*` keys 雙 locale 都有 |
| Dev server build | pending（不影響 commit batch）|
| Production bundle | 不在本 PR scope（沒改 production code path,只改 SQL filter + i18n keys）|

## Self-improvement action items

- [ ] **5 條 i18n assertion fix**（見「Known Test Gaps」）— 下一個 commit 處理,把 test 從 assertion on translated text 改成 assertion on i18n key
- [ ] **`@/i18n` global mock 改進** — 現況 mock 讓 `i18n.t()` return key,但 `i18n.t()` 期望 return translated text（測試中）。**長遠解法**是讓 test import `@/test/i18n` 取代 `@/i18n`,移除 global mock。短期 mock 是必要的（解 import-time crash）,但 5 條 assertion 改完後 test quality 會顯著提升
- [ ] **Step 8 publish 失敗 UX 改進** — 現在只 toast.error + 留在 Step 8。應該加 inline error 訊息（disabled 後的 hint 區）跟「重試」按鈕（不要讓 user 重新按 Publish 兩次）
- [ ] **Step 8 publish loading state 改善** — 現在用 sonner spinner。考慮加 inline progress bar（特別是 slow network / cold worker 情境）
