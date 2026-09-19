# Step 6 Coupon Card 完工 DEV LOG：第六個 sub-module + Step 3 coupon-only display fields + autosave 補齊

## Metadata

- 日期：2026-09-19 ~ 2026-09-20
- 範圍：CardBuilder Step 6（coupon_card 折價券的折價邏輯）+ Step 3（coupon_card 左右欄位/「會員等級」hide override + 預覽）+ Step 2 卡片有效天數/到期日對 coupon_card 顯示 + autosave 補齊 + Backend mirror（4-layer schema sync，2026-09-20）
- 目標：
  1. 完成 Step 6 dispatcher 對 `coupon_card` 的分流（StampCardLogic / RewardCardLogic / CashbackCardLogic / MembershipCardLogic / DiscountCardLogic 之後的第六個 sibling）
  2. 落地 flat rule 折價券編輯器（單一折扣規則：type radio + 對應金額/% 輸入 + 一次發券張數）
  3. Step 3 coupon_card 左右欄位新增兩個 coupon-only 欄位：`couponRemainingCount`（剩餘張數）/ `couponDiscount`（折扣優惠）
  4. Step 3 coupon_card 隱藏「會員等級」選項（coupon 沒有 tier 概念，避免誤導）
  5. 預覽 header 右側 coupon_card 顯示「有效期限」2-line block（讀 Step 2 的 `passValidDays` / `expiryDate`，與 discount/member 對稱）
  6. 補齊 coupon 欄位 autosave（修「沒按 Next 就關 tab → 設定遺失」回歸）
  7. Backend mirror：補上後端 4 層 schema（修「coupon 欄位送出去 zod silently strip → 沒有回填」回歸）
- Plan ref：coupon_card_step_6_plan_2c626628.plan.md + coupon-card-preview-display_bcbb1a32.plan.md + backend_mirror_for_coupon_schema_constants_wire-up_4190faf4.plan.md
- Conversation summary：本 DEV LOG 涵蓋 Step 6 components + Step 3 preview + Step 2 keep-passValidDays-expiryDate + autosave 補齊 + backend mirror 五大主軸

## 問題與根因

Step 6 dispatcher 已落地 5 個 sub-module（stamp / reward / cashback / membership / discount，2026-09-18），但 `coupon_card` 仍是 ComingSoon placeholder。User 在 session 中明確 4 個需求：

1. **單一規則，非 tiered**：coupon card 是「一張 coupon 一個折扣值」flat rule，不像 discount card 是 tiered-cumulative-spend。
2. **折扣類型 radio 選擇**：使用者要在「現金折扣」與「% 數折扣」之間二擇一（互斥——切換要清空另一邊的 value 欄位）。
3. **新增 couponIssueCount**：一次發給同一個消費者幾張券（最少 1，無上限，user decision 2026-09-19）。
4. **沒有效期限欄位**：coupon 是 per-use，merchant 控制 coupon batch 的 validity window，卡片層級無期限。卡片本身的 `passValidDays` / `expiryDate` 仍由 Step 2 控制（不隱藏，跟 membership_card 不同）。

實作後第一輪 user review 發現 **3 個 preview bug**：

1. **R10折扣 / 1%折扣 / 10元折扣 永遠顯示**：PassCardPreviewBody 沒讀 `couponDiscountType` / `couponDiscountAmount` / `couponDiscountPercent`，rendered hard-coded 字串。% 數切換後 preview 也沒跟著變。
2. **i18n 英文缺少折扣翻譯**：zh-TW 有「折扣優惠」，但 en path 顯示 raw key。
3. **TWD + en 缺貨幣符號**：en + TWD + amount_off 顯示「50 off」沒 NT$ marker。

第二輪 user review 又發現 **2 個後續 bug**：

4. **Coupon 設定沒有回填**：使用者填完折價券設定儲存後，DB 確實收到（rule 032 沒 silently overwrite 是因為欄位剛好對應 db row），但 **重新編輯時 store 沒 hydrate coupon 欄位** —— root cause 是後端 `templateSettingsSchema` + `TemplateSettings` interface **完全缺 coupon 欄位**（Layer 2 + Layer 3 漏掉），zod 預設 `.object()` silently strip unknown keys，前端送出去的全部被丟掉。連帶前端 `loadSettings` 對應的 default fallback 也是 undefined。
5. **設定沒有 autosave**：沒按「下一步」就關 tab，所有 coupon 設定遺失 —— 跟 2026-09-05 Step 4 / 2026-09-18 Step 2 / 2026-09-18 Step 5 同 pattern。

### Coupon 卡 vs Discount 卡：flat vs tiered

| 維度 | discount_card | coupon_card（本 PR）|
|---|---|---|
| 觸發 | 累計消費門檻（多 tier）| 單一 flat rule |
| Tier 結構 | 多 tier（name + thresholdSpend + discountPercent）| 無 |
| Discount type | 永遠 % 折扣 | radio 選：amount_off 或 percent_off |
| 卡片有效期限 | 必填（custom days OR specific date）| 沿用 Step 2 passValidDays / expiryDate（與所有非會員卡共用）|
| 新增欄位 | couponIssueCount（無對應概念）| couponIssueCount（必填 ≥ 1）|

User 在 session 開頭明確：「這張卡相當簡單，只有幾個欄位」——實作上是 DiscountCardLogic 簡化版（去掉 tier list、去掉 Step 6 expiry、新增 type radio + issue count）。

### Backend mirror root cause（Rule 019 § 4.1 四層同步漏洞）

Backend `templateSettingsSchema`（Layer 2）+ `TemplateSettings` interface（Layer 3）**漏了 coupon 4 個欄位**。前端即使把 coupon 設定塞進 PUT 的 `settings` JSONB blob，到後端也被 zod 預設 `.object()` silently strip：

```
前端 PUT payload
  settings.couponDiscountType = 'amount_off'
  settings.couponDiscountAmount = 50
  settings.couponDiscountPercent = null
  settings.couponIssueCount = 3

→ 後端 zod .object().strip() 吃掉 coupon keys（zod 預設 .strip()）
→ DB 只收到 settings（沒有 coupon 子鍵）
→ 再 reload → 前端 loadSettings 沒 coupon 鍵 → store 退回 initialState 預設
→ 使用者看到「沒回填」
```

這是 Rule 019 § 4.1 四層同步鐵律的經典反例：shared schema（Layer 1）加了欄位，但 backend request.ts（Layer 2）+ db templates.ts（Layer 3）沒同步補。

## 實作內容

### 1. 新檔案結構（Step 6 CouponCardLogic sub-module）

```
apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/CouponCardLogic/
├── index.ts                                    ← barrel
├── CouponCardLogic.tsx                         ← 主組件（4 sub-components, ~25 行）
├── CouponCardLogic.types.ts                    ← 5 個 component props
├── CouponCardLogic.test.tsx                    ← composer smoke test
├── CouponDiscountTypeField.tsx                 ← radio group (amount_off | percent_off) Pattern A
├── CouponDiscountTypeField.test.tsx            ← 9 tests（radio + mutual exclusion）
├── CouponDiscountAmountField.tsx               ← 條件 render: amount_off only, currency-aware
├── CouponDiscountAmountField.test.tsx          ← 10 tests（conditional + TWD/ZAR unit placement）
├── CouponDiscountPercentField.tsx              ← 條件 render: percent_off only, integer 1-100
├── CouponDiscountPercentField.test.tsx         ← 10 tests（conditional + range + integer）
├── CouponIssueCountField.tsx                   ← always render, integer ≥ 1, no upper cap
└── CouponIssueCountField.test.tsx              ← 10 tests（range + clear-on-empty + i18n）

packages/shared/constants/coupon-card.ts        ← COUPON_AMOUNT_MIN/PERCENT_MIN/PERCENT_MAX/ISSUE_COUNT_MIN + CouponCardShape
packages/shared/constants/couponPreviewAmounts.ts ← COUPON_PREVIEW_AMOUNTS[currency] (TWD '10元折扣' / ZAR 'R10折扣')
```

### 2. Rule 019 § 4.1 四層 schema sync（2026-09-20 commit `aa884e1`）

| 層 | 檔案 | 內容 |
|---|---|---|
| 1 | `packages/shared/schemas/card.ts` | `couponDiscountType` (enum) + `couponDiscountAmount` (≥1) + `couponDiscountPercent` (int 1-100) + `couponIssueCount` (≥1) |
| 2 | `apps/backend/src/modules/cards/schemas/request.ts` | Mirror 同 4 個欄位（**bug 起點**：這層 2026-09-19 之前完全缺） |
| 3 | `apps/backend/src/modules/cards/db/templates.ts` | `TemplateSettings` interface 加 4 個欄位（**bug 起點**：這層 2026-09-19 之前完全缺） |
| 4 | `schema-conformance.test.ts` | 自動驗證 1+2 層 field set 一致（118/118 pass：91 baseline + 21 coupon structural + 6 defensive）|

Constants wire-up：
- `couponDiscountAmount.min` ← `COUPON_AMOUNT_MIN` (= 1)
- `couponDiscountPercent` ← `COUPON_PERCENT_MIN..COUPON_PERCENT_MAX` (= 1..100)
- `couponIssueCount.min` ← `COUPON_ISSUE_COUNT_MIN` (= 1)
- `couponDiscountType` enum 沒用常數（z.enum 直接寫字串；coupon card 列舉值只有 2 個）

### 3. Store 層（`CardBuilderEditor.store.ts`）

新增 4 個 state field + 4 個 setter + 4 個 init + sanitization：

- `couponDiscountType: CouponDiscountType` 初始 `'amount_off'`（user decision 2026-09-19）
- `couponDiscountAmount: number | null` 初始 `null`
- `couponDiscountPercent: number | null` 初始 `null`
- `couponIssueCount: number` 初始 `1`

Setters（key feature：mutual exclusion via store setter）：

| Setter | 行為 |
|---|---|
| `setCouponDiscountType(type)` | mirror `setRewardType` clear behavior：amount_off → 清空 couponDiscountPercent；percent_off → 清空 couponDiscountAmount（**不**清空另一個 type field）|
| `setCouponDiscountAmount(amount)` | null 允許；number 必須 ≥ 1 且 `Number.isFinite`；無上限 |
| `setCouponDiscountPercent(percent)` | null 允許；number 必須是 integer 在 [1, 100] |
| `setCouponIssueCount(count)` | 必須是 integer ≥ 1，無上限（user decision 2026-09-19）；防 `Number.MAX_SAFE_INTEGER` overflow |

**2026-09-19 fix**：原本 `setCouponDiscountType` **沒**清空另一個 value field，導致使用者切換 type 後 store 同時保留 amount + percent（資料冗餘，且 preview 看到混用值）。修法：mirror `setRewardType` clear behavior，store setter 強制清空（UI 不需要寫清空邏輯）。

`reset()` + `loadSettings()` sanitization：對 4 個欄位 defensive coerce（型別檢查 + 上下界檢查 + null handling）。

### 4. i18n 雙語翻譯（`cardEditor.zh-TW.ts` + `cardEditor.en.ts`）

`step6.coupon.*` 區塊（zh-TW 26 keys + en 26 keys）：

- section titles: `intro` / `introHint`
- discount type radio: `discountTypeTitle` / `discountTypeAmount` / `discountTypePercent` / `discountTypeRequiredError`
- amount field: `amountTitle` / `amountPlaceholder` / `amountUnitTWD` (= `元`) / `amountUnitZAR` (= `R`) / `amountRequiredError` / `amountInvalidError`
- percent field: `percentTitle` / `percentPlaceholder` / `percentUnit` (= `%`) / `percentRequiredError` / `percentInvalidError`
- issue count field: `issueCountTitle` / `issueCountPlaceholder` / `issueCountUnit` (= `張` / `coupons`) / `issueCountHint` / `issueCountRequiredError` / `issueCountInvalidError`
- validation 巢狀物件（**新增 pattern，2026-09-19**）：統一收 `step6.coupon.validation.*` 給 shared zod validation error 對應 i18n key

`step3.fieldsSection.fields.*` 新增 2 keys：
- `couponRemainingCount`: `剩餘張數` / `Remaining Count`
- `couponDiscount`: `折扣優惠` / `Discount Offer`

### 5. Step 3 整合（左右欄位擴充 + 「會員等級」hide）

| 檔案 | 變更 |
|---|---|
| `packages/shared/constants/card-fields.ts` | `CardFieldGroup` 加入 `'coupon'`；CARD_FIELDS 加 `couponRemainingCount` + `couponDiscount`（group: 'coupon'）；`memberLevel` 加 `hideOnCardTypes: ['coupon_card']` |
| `Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE.ts` | 新增 `COUPON_CARD_TYPES = new Set(['coupon_card'])` + filter `group === 'coupon'` 條件；`memberLevel` 多一條 hide 規則（comment 註明 2026-09-19）|
| `Step3CardFields/index.test.tsx` | +4 新 describe block（group isolation + memberLevel hide + 其他卡種無污染 + COUPON_CARD_TYPES 內容契約）|
| `CardPreview/PassCardPreviewBody.tsx` + `PreviewWrapper/PreviewWrapper.tsx` | 新增 4 個 prop：`firstCouponRemainingCount` / `couponDiscountType` / `couponDiscountAmount` / `couponDiscountPercent`（**透傳**到 body，body 解讀 type 選對應顯示）|
| `CardPreview/PassCardPreviewHeader.tsx` | 新增 `COUPON_EXPIRY_PREVIEW_CARD_TYPES` + `shouldShowCouponExpiryPreview` type guard；coupon_card 用 2-line 區塊讀 `passValidDays` / `expiryDate`（Step 2 shared），有資料顯示「YYYY.MM.DD」(zh) / `MM.DD.YYYY` (en)，都空顯示「∞」 |

### 6. Step 6 dispatcher 整合

| 檔案 | 變更 |
|---|---|
| `Step6CardLogic/Step6CardLogic.tsx` | dispatcher 新增 `coupon_card` 分支，render hero intro + `<CouponCardLogic />` |
| `Step6CardLogic/Step6CardLogic.test.tsx` | 新增 `renders CouponCardLogic for coupon_card` test + 把 `coupon_card` 從 ComingSoon 列表移出 |
| `CardBuilderEditorWorkspace.tsx` | `isStep6Valid()` 新增 `coupon_card` 分支 → `isCouponStep6Valid()`（type + 對應 value + issue count）；save payload 新增 coupon 4 欄位（gating by `cardType === 'coupon_card'`）；handleNext step 6 區塊同步 |

### 7. autosave 補齊（2026-09-19 fix）

`CardBuilderEditor.tsx` 新增第 6 個 autosave effect（couponDiscountType / couponDiscountAmount / couponDiscountPercent / couponIssueCount），pattern 跟 Step 4 / Step 5 / Step 2 / isPaid **完全相同**：

| Pattern component | 實作 |
|---|---|
| `couponBaselineArmedRef` | session boundary reset |
| `step4LoadSettledRef` 共用 | 共用 outer-fetch ref（與 Step 4 / Step 5 / Step 2 / isPaid 共享同一個 load timeline）|
| `lastCouponSnapshotRef` | JSON.stringify snapshot diff |
| `couponSaveTimerRef` | 1000ms debounce |
| 欄位 validation gate | type guard + amount guard (null OK，< 1 reject) + percent guard (null OK，out-of-range reject) + issue count guard (≥1 integer) |
| Timer fire | 從 `useCardBuilderStore.getState()` 讀最新值，組裝 `settings.couponDiscountType/couponDiscountAmount/couponDiscountPercent/couponIssueCount` payload 送 `cardService.update()` |
| Cleanup | effect return 時 `clearTimeout(couponSaveTimerRef.current)` |

`CardBuilderEditor.autosave.test.tsx` +5 conformance test：type / amount / percent / issue count 各自 autosave regression；**slow-network regression test**（fetch 延遲 3s，autosave 不應在 fetch 還沒 resolve 前 fire empty defaults——這條若 backend schema 還是漏的話 fetch resolve 後 loadSettings 也不會 hydrate coupon 欄位，是 backend mirror 是否成功的端到端驗證）。

### 8. 預覽 preview chain 補齊

| Bug | Root cause | 修法 |
|---|---|---|
| 永遠顯示 `R10折扣` / `1%折扣` / `10元折扣`，沒讀 store | `PassCardPreviewBody` 沒收 coupon props，rendered hard-coded 字串 | 新增 4 個 prop + 解讀 type：`amount_off` → `COUPON_PREVIEW_AMOUNTS[currency]` + amount input；`percent_off` → `${percent}%折扣` |
| en + TWD + amount_off 顯示 `50 off` 沒 NT$ | `passCard.en.ts` 的 `couponDiscount` 模板是 `{{amount}} off` 沒帶 NT$ marker | 改為 `NT${{amount}} off`（ISO 4217 NT$）；zh-TW 不變（Han suffix 已經表達單位）|
| `% 數切換後 preview 沒變` | body 完全沒接 type prop，rendered 永遠是 amount_off 路徑 | 修完上面就一起解掉 |
| `couponRemainingCount` 顯示裸數字 `5` 沒單位 | body 把 `firstCouponRemainingCount` 當 string 透傳，bypassing i18n | 改為 number，新 i18n 模板 `couponRemainingCount.countFormat`（zh-TW `{{count}}張` / en `{{count}} sheets`）；undefined 時 fallback static demo `1張` / `1 sheet` |

對應 commit：`32e61aa fix(coupon-preview): NT$ prefix on en TWD + count unit on Remaining Count`

### 9. 整合測試覆蓋

`CardBuilderEditorWorkspace.step6-integration.test.tsx` 每個 cardType fixture 補上 coupon 4 個欄位（type default `'amount_off'`，value fields 對非 coupon_card 是 `undefined`）。test 既有 7 個 card type × 4 個欄位 = 28 個新斷言點。

## 衍生 bugs 與後續修正

### Bug A：PassCardPreviewBody 永遠顯示 hard-coded 折扣（user review round 2）

預覽 chain **完全**沒接 coupon 欄位，導致這條看到的是寫死的 `R10折扣` / `10元折扣` / `1%折扣`。原因：PassCardPreviewBody 在 discount_card extension（2026-09-18）時已經被改過，但 coupon_card 的 prop 接線沒做（漏 commit 一個檔）。

**修法**：
- `PreviewWrapper.types.ts` + `PreviewWrapper.tsx`：新增 4 個 coupon prop 透傳
- `PassCardPreview.types.ts` + `PassCardPreview.tsx`：透傳到 body
- `PassCardPreviewBody.tsx`：解析 type 顯示對應字串 + amount/percent 從 store 讀

### Bug B：couponRemainingCount 顯示裸數字沒單位

跟 Bug A 同 PR，但 root cause 不同：`firstCouponRemainingCount` prop 是 string，body 沒做 i18n composition。修法詳 § 8。

### Bug C：R10 vs 10元折扣字串是 hard-coded 不是用 user 輸入

preview 永遠顯示 `10` 沒讀 `couponDiscountAmount` / `couponDiscountPercent`。同上修法。

### Bug D：coupon 設定沒有回填（backend mirror bug）

`runs/improvements/feedback/20260919-coupon-step6-no-backfill-backend-schema-drift.md` 完整 trace。根因：Rule 019 § 4.1 Layer 2 + Layer 3 漏了 coupon 4 個欄位。修法：backend mirror commit `aa884e1`。

## Verification

- typecheck：tsc -b apps/frontend/tsconfig.app.json --noEmit exit 0
- typecheck：tsc -b apps/backend --noEmit exit 0
- lint：oxlint --quiet exit 0（無 warnings）
- frontend tests：npx vitest run apps/frontend 1371+ passed / 5 skipped across 109+ files
- backend tests：npm test 276 passed across 18 files
- i18n smoke：npm run verify:i18n OK（17 namespaces / 34 locale files，無 raw key）
- new tests：CouponDiscountTypeField/AmountField/PercentField/IssueCountField 各自 +9/+10/+10/+10 conformance tests；CouponCardLogic composer +1；Step6CardLogic dispatcher +1；Step3CardFields coupon group isolation +4；PassCardPreviewHeader coupon expiry +10；PassCardPreview coupon pill isolation +2；CardBuilderEditor.autosave Step 6 coupon +5；CardBuilderEditorWorkspace.step6-integration coupon fixture +28；packages/shared/schemas/card.test.ts coupon fields +21 structural +6 defensive = +27 conformance tests

## 參照

- `runs/improvements/feedback/20260919-coupon-step6-no-backfill-backend-schema-drift.md` — backend mirror root cause + 4-layer trace
- `runs/improvements/feedback/20260919-coupon-preview-hardcoded-discount-no-i18n.md` — preview chain 4 bugs (R10/10元/discount format/percent switch)
- DEV/09-2026/0918-step6-discount-card-dev-log.md — sibling（discount_card 是上一個 sub-module）
- apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/CouponCardLogic/ — coupon sub-module
- packages/shared/constants/coupon-card.ts — single source of truth for limits
- packages/shared/constants/couponPreviewAmounts.ts — currency-driven preview values