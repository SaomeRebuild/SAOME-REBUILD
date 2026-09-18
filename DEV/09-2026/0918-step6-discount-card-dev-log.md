# Step 6 Discount Card 完工 DEV LOG：第四個 sub-module + Step 3 「折扣等級」/ 折扣預覽欄位

## Metadata

- 日期：2026-09-18
- 範圍：CardBuilder Step 6（discount_card 折扣卡的折扣邏輯）+ Step 3（折扣卡左右欄位/會員等級 override + 預覽）
- 目標：
  1. 完成 Step 6 dispatcher 對 `discount_card` 的分流（StampCardLogic / RewardCardLogic / CashbackCardLogic / MembershipCardLogic 之後的第五個 sibling）
  2. 落地 tier-based 折扣編輯器（最多 5 個 tier；每個 tier = name + thresholdSpend + discountPercent 三欄）+ 必填有效期限（custom days OR specific date, 二擇一, 無 toggle）
  3. Step 3 折扣卡的「會員等級」override 成「折扣等級」（i18n 獨立 key，避免跟 stamp/reward/cashback 的「獎勵」語意混淆）
  4. 折扣預覽：memberLevel slot 顯示第一個 discount tier 名稱；新增 `discountTierBracket`（discountPercent%）/ `pointsToNextTierDiscount` / `accumulatedSpendDiscount` 三個新欄位
  5. 預覽 header 右側 discount_card 顯示「有效期限」2-line block（zh-TW `2026.10.30` / en `10.30.2026`）
- Plan ref：`c:\Users\user\.cursor\plans\discount_card_step_6_implementation_e30942eb.plan.md`
- Conversation summary：本 DEV LOG 涵蓋 Step 6 components + Step 3 preview + Step 2 hide PassValidDays/ExpiryDate 三大主軸

## 問題與根因

Step 6 dispatcher 已落地 4 個 sub-module（stamp / reward / cashback / membership, 2026-09-13），但 `discount_card` 仍是 ComingSoon placeholder。User 需求：折扣卡要可設定「依累計消費門檻給不同折扣%」（cashback pattern），加上卡片層級有效期限，且必須選一個（不然就用 cashback 卡就好）。

### Discount 卡 vs Cashback 卡：語意對稱

| 維度 | cashback_card | discount_card（本 PR）|
|---|---|---|
| 觸發 | 累計消費門檻 | 累計消費門檻（完全相同）|
| 結果 | % **回饋**（事後退點 / 退金）| % **折扣**（即時減價）|
| Tier 結構 | name + thresholdSpend + cashbackPercent | name + thresholdSpend + **discountPercent** |
| threshold=0 語意 | 「預設 tier」人人有回饋 | 同樣「預設 tier」人人有折扣（語意對稱）|
| 卡片有效期限 | 無 | **必填**：customDays OR specificDate（無 toggle）|

實作幾乎是 `CashbackCardLogic` 的 clone + rename，但 effective expiry 是必修差異（cashback 沒有效期限欄位）。

### User clarification（2026-09-18 session 衍生）：有效期限是必填

原始 plan 將 discount card 有效期限設為「選填」（與 cashback 卡相同）。User 在 session 中衍生 3 條變更：

1. **位置**：把卡片有效期限放在「卡片邏輯說明」與「折扣級距之間」（不是排在 tier 之後）。
2. **必填語意**：「他不該是選填，應該是必填其中之一，不然的話去設計Cashback卡就好」——若使用者不要期限，直接去做 cashback 卡就好。
3. **文案**：`兩欄位擇一填寫。留空表示無期限（與現金回饋卡相同）` 改為符合新語意的版本。

實作：
- `DiscountExpiryFields.tsx` 新增 `expiryBothNullError` i18n key（zh-TW `兩欄位皆未填，請至少填寫一項（不要設定期限請改用現金回饋卡）` / en `Both fields are empty. Fill at least one (use Cashback Card if you don't want an expiry)`）。
- `isDiscountStep6Valid()` 加第 2 條 gate：「`discountCustomExpiryDays` 與 `discountSpecificExpiryDate` 必有其一非 null」，否則 `Next` 按鈕 disabled。
- 位置 swap：`DiscountCardLogic.tsx` 把 `DiscountExpiryFields` 放在 `DiscountTierList` **之前**（位於卡片描述與 tier 之間）。

### Step 3 衍生：折扣卡的「會員等級」改成「折扣等級」

User 變更 Step 3 dropdown：

1. **dropdown label**：`會員等級` (stamp/reward/cashback 為「獎勵」語意 — `memberLevelStamp` key) → `折扣等級` (`memberLevelDiscount` key，獨立 i18n，**不**沿用 stampLabel)
2. **新增 3 個 discount-group 欄位**：
   - `pointsToNextTierDiscount`（到下一級還差）→ `DISCOUNT_PREVIEW_AMOUNTS[currency][field]` (例 TWD `234元` / ZAR `R234`)
   - `discountTierBracket`（折扣級距）→ store-derived `discountTiers[0].discountPercent + '%'`（例 `10%`，非 i18n、非 currency）
   - `accumulatedSpendDiscount`（累積消費）→ `DISCOUNT_PREVIEW_AMOUNTS[currency][field]`
3. **Card type label**：原 `會員等級` 改為 `有效期限`（header pill 右側 2-line block 顯示，zh-TW `2026.10.30` / en `10.30.2026`）

實作：
- `packages/shared/constants/card-fields.ts` 新增 `'discount'` group + 3 keys
- `packages/shared/constants/discountPreviewAmounts.ts` 新增 currency × field → value 對照表（與 cashbackPreviewAmounts 同 pattern）
- `Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE.ts` 新增 `DISCOUNT_CARD_TYPES = { 'discount_card' }` + filter logic
- `Step3CardFields/index.tsx` 的 `resolveOptionLabelKey()` 加 `discount_card → memberLevelDiscount` 獨立分支（與 `memberLevelStamp` 並存，避免耦合）
- `PassCardPreviewBody.tsx` 新增 `discount_card + memberLevel` → `discountLabel` + `firstDiscountTierName` override；新增 `discountTierBracket` field
- `PassCardPreviewHeader.tsx` 新增 `DISCOUNT_EXPIRY_PREVIEW_CARD_TYPES = { 'discount_card' }` + 2-line discount expiry block（`today + N days` 計算 + locale-aware `formatExpiryDate`）
- `PreviewWrapper.types.ts` 新增 `firstDiscountTierName?: string` prop

## 實作內容

### 1. 新檔案結構（Step 6 DiscountCardLogic sub-module）

```
apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/DiscountCardLogic/
├── index.ts                                 ← barrel
├── DiscountCardLogic.tsx                    ← 主組件（DiscountExpiryFields + DiscountTierList，expiry 在前）
├── DiscountCardLogic.types.ts               ← 7 個 component props
├── DiscountCardLogic.test.tsx               ← composer smoke test
├── DiscountExpiryFields.tsx                 ← 卡片有效期限 section（互斥 handler, both-null error inline）
├── DiscountExpiryFields.test.tsx            ← 14 tests（互斥 + both-null + 日期/天數 UI）
├── DiscountCustomExpiryDaysField.tsx        ← 有效天數輸入框（number input 1-3650, 無效值 red border）
├── DiscountSpecificExpiryDateField.tsx      ← 到期日 date picker（min=today via getTodayIsoDate()）
├── DiscountTierList.tsx                     ← tier list + Add button + max=5 cap hint
├── DiscountTierList.test.tsx                ← 5 tests（新增/上限/empty state）
├── DiscountTierRow.tsx                      ← 3-col grid (name | threshold | percent) + Remove button
├── DiscountTierNameField.tsx                ← text input + 40 char counter + 必填檢查
├── DiscountTierThresholdField.tsx           ← 累計消費 number input, currency-aware unit (TWD/EN/ZAR)
└── DiscountTierThresholdField.test.tsx      ← 7 tests（currency 元/NT$/R × always-show-zero）

packages/shared/constants/discount-card.ts   ← MAX_DISCOUNT_TIERS=5 + DiscountTierShape + 上下界
```

### 2. Rule 019 § 4.1 四層 schema sync

| 層 | 檔案 | 內容 |
|---|---|---|
| 1 | `packages/shared/schemas/card.ts` | `discountTiers` array (max 5) + `discountCustomExpiryDays` (int [1,3650] nullable) + `discountSpecificExpiryDate` (ISO nullable) |
| 2 | `apps/backend/src/modules/cards/schemas/request.ts` | Mirror 同 3 個欄位 |
| 3 | `apps/backend/src/modules/cards/db/templates.ts` | `TemplateSettings` interface 加 3 個欄位 |
| 4 | `schema-conformance.test.ts` | 自動驗證 1+2 層 field set 一致（91 tests passed）|

### 3. Store 層（`CardBuilderEditor.store.ts`）

新增 7 個 setter + 2 個 init 欄位 + sanitization：

- `discountTiers: Array<DiscountTierShape & { id: string }>` 初始值 1 row `{id: 'default-discount-tier', name: '', thresholdSpend: 0, discountPercent: 1}`
- `discountCustomExpiryDays: number | null` 初始 null
- `discountSpecificExpiryDate: string | null` 初始 null

Setters：

| Setter | 行為 |
|---|---|
| `addDiscountTier` | MAX=5 時 no-op，預設值同 initial |
| `removeDiscountTier(id)` | filter；若陣列變空 → 自動補 1 個 default（永遠 ≥ 1 row）|
| `updateDiscountTier(id, patch)` | name slice 40、thresholdSpend ≥ 0、discountPercent [1,100] integer |
| `sortDiscountTiers` | 依 thresholdSpend ASC（threshold=0 預設 tier 在最前）|
| `setDiscountCustomExpiryDays(days)` | clamp [1, 3650]、拒絕 NaN/小數 |
| `setDiscountSpecificExpiryDate(date)` | 驗證 `/^\d{4}-\d{2}-\d{2}$/` |

**Mutual exclusion 不在 store**，在 `DiscountExpiryFields` 的 handler 層級強制（`handleDaysChange` 設值時清空 date，反之亦然）—— store setters 是 pure function，方便測試單獨設定其中一個。

`reset()` + `loadSettings()` sanitization 與 cashbackTiers 對稱：defensive coerce 每個 tier 的 3 個欄位 + 防呆 ISO date。

### 4. i18n 雙語翻譯

`apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts` + `cardEditor.en.ts` 新增 `step6.discount.*` 區塊（32 keys）：

- section titles: `intro` / `introHint` / `tiersTitle` / `tiersHint` / `addTier` / `removeTier` / `maxTiersReached` / `expiryTitle` / `expiryHint` / `expiryBothNullError`
- expiry fields: `customExpiryDaysTitle` / `customExpiryDaysPlaceholder` / `customExpiryDaysUnit` / `customExpiryDaysRangeError` / `specificExpiryDateTitle` / `specificExpiryDateHint` / `specificExpiryDatePastError`
- tier fields: `tier.nameTitle` / `namePlaceholder` / `nameCounter` / `nameRequiredError` / `thresholdTitle` / `thresholdUnitTWD` / `thresholdUnitZAR` / `thresholdPlaceholder` / `thresholdInvalidError` / `thresholdHelper` / `percentTitle` / `percentPlaceholder` / `percentUnit` / `percentRequiredError` / `percentInvalidError` / `percentTooLargeError`

`Step3CardFields` override：新增 `step3.fieldsSection.fields.memberLevelDiscount` key（zh-TW `折扣等級` / en `Discount Tier`）—— **不**沿用 `memberLevelStamp`（避免混淆 stamp/reward/cashback 的「獎勵」語意）。

### 5. Step 3 + 預覽整合

| 檔案 | 變更 |
|---|---|
| `Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE.ts` | 新增 `DISCOUNT_CARD_TYPES = new Set(['discount_card'])` + filter `group === 'discount'` |
| `Step3CardFields/index.tsx` | `resolveOptionLabelKey()` 新增 `discount_card → memberLevelDiscount` 獨立分支 |
| `CardPreview/PassCardPreviewBody.tsx` | `discount_card + memberLevel` override（label = `discountLabel`）+ 新增 `discountTierBracket` field + 接受 `firstDiscountTierName` prop |
| `CardPreview/PassCardPreviewHeader.tsx` | 新增 `DISCOUNT_EXPIRY_PREVIEW_CARD_TYPES` + 2-line discount expiry block（zh-TW `2026.10.30` / en `10.30.2026`）|
| `PreviewWrapper/PreviewWrapper.types.ts` | 新增 `firstDiscountTierName?: string` prop |
| `packages/shared/constants/discountPreviewAmounts.ts` | 新增 `DISCOUNT_PREVIEW_AMOUNTS[currency][field]`（TWD: `123元` / ZAR: `R123`）|

### 6. 整合層

| 檔案 | 變更 |
|---|---|
| `Step6CardLogic/Step6CardLogic.tsx` | dispatcher 新增 `discount_card` 分支，render hero intro + `<DiscountCardLogic />` |
| `Step2CardSettings/index.tsx` | 新增 `isDiscount = cardType === 'discount_card'`；`PassValidDaysField` + `ExpiryDateField` 對 discount_card 也隱藏（避免兩個 editor）|
| `CardBuilderEditorWorkspace.tsx` | `isStep6Valid()` 新增 `discount_card` 分支 → `isDiscountStep6Valid()`（tiers + 必填 expiry + out-of-range 防呆）；save payload 加 `discountTiers`（sort by threshold ASC + strip id）+ `discountCustomExpiryDays` + `discountSpecificExpiryDate` |

## 測試結果

| 檔案 | 測試數 | 結果 |
|---|---|---|
| `DiscountCardLogic.test.tsx` | composer smoke | passed |
| `DiscountTierList.test.tsx` | 5 | passed |
| `DiscountTierThresholdField.test.tsx` | 7 | passed |
| `DiscountExpiryFields.test.tsx` | 14 | passed |
| `CardBuilderEditorWorkspace.step6-integration.test.tsx` | 29 (含 discount) | passed |
| `CardBuilderEditor.store.test.ts` | discount setters | passed |
| `schema-conformance.test.ts` (backend) | 91 | passed |
| **Total vitest** | **1286 passed (1291)** | ✅ |

i18n verify: `OK · 17 namespace(s) passed (34 locale files)`

typecheck (frontend + backend + shared): exit 0

## Conformance test 修復（衍生）

`CardBuilderEditorWorkspace.step6-integration.test.tsx` 因 store `membershipTiers` 預設值從 `[]` 變為 1 個 default-membership-tier（2026-09-18 regression fix for `MembershipCardLogicFreeState`），加上 save payload 多 3 個 discount fields，導致 6 個既有測試的 `toHaveBeenCalledWith` diff 失敗。

修法：`afterEach` 在 `reset()` 之後額外 `setState({ membershipTiers: [], rewardTiers: [], cashbackTiers: [], discountTiers: [], discountCustomExpiryDays: null, discountSpecificExpiryDate: null })`，讓每個測試從乾淨 multi-tier 狀態開始（與 discount card 的 default 1 row seed 解耦）。

## 衍生議題

1. **Live preview 組件**：本 PR 沒做 `DiscountCardLogicPreview`（cashback 對應的 live scenario preview）—— user 在 session 沒要求，plan 列為「skip」，未來可加。
2. **Tier sorting on UI**：`sortDiscountTiers` 只在 save 時自動呼叫，UI 列表順序隨使用者新增順序；threshold=0 預設 tier 預設在 index 0，但後續新增的 tier 不會自動 reorder。需要時可加 drag-and-drop 或自動 sort。
3. **Expiry 兩欄位的清除時機**：當使用者從 days 改為 date 時，date picker UI 會 show 已存的 date（即使已清空）。可在切換時加 explicit clear button。
