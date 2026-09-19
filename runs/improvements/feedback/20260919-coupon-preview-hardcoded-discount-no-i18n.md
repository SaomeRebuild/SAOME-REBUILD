# Coupon Step 6 + Preview 4-bug chain — 反饋報告

> 2026-09-19 ~ 2026-09-20 coupon card Step 6 實作 + 預覽 chain 補齊過程衍生的 4 個 user-visible bugs 完整 trace。

## TL;DR

1. **Bug-1：coupon step 6 永遠顯示 hard-coded 折扣字串**——PassCardPreviewBody 沒接 coupon 4 個 prop，rendered 寫死的 `R10折扣` / `10元折扣` / `1%折扣`。
2. **Bug-2：% 數切換後 preview 沒跟著改變**——Bug-1 的衍生（body 完全沒讀 store）。
3. **Bug-3：i18n 英文沒有折扣的翻譯 + en + TWD + amount_off 缺 NT$ prefix**——`passCard.en.ts` 的 `couponDiscount` 模板是 `{{amount}} off` 沒帶 NT$ marker。
4. **Bug-4：coupon 設定「沒按 Next 就關 tab → 設定遺失」autosave 缺失**——coupon 沒 autosave effect；同 Step 4 / Step 5 / Step 2 pattern。

加上 2026-09-20 解的 **Bug-5：coupon 設定沒有回填**（backend 4-layer schema drift，詳見 `20260919-coupon-step6-no-backfill-backend-schema-drift.md`）。

## 時間軸

| 時間 | 動作 | 後果 |
|---|---|---|
| 2026-09-19 06:30 | 落地 CouponCardLogic 5 個 sub-component + store setter + i18n + Step 3 group isolation | ✅ typecheck/lint/tests 全綠 |
| 2026-09-19 06:48 | 落地 store 4 個新欄位 + 4 個 setter（含 `setCouponDiscountType` **沒**清空另一 value field 的 bug）| 修了一版：mirror `setRewardType` clear behavior |
| 2026-09-19 07:10 | 落地 CardBuilderEditorWorkspace.isCouponStep6Valid() + handleNext step 6 region | ✅ |
| 2026-09-19 07:30 | user review：preview 顯示 hard-coded `R10折扣` | 🐛 **Bug-1** |
| 2026-09-19 07:35 | user review：切到 % 數後 preview 沒變 | 🐛 **Bug-2** |
| 2026-09-19 07:45 | user review：en 沒翻譯 + en + TWD 缺 NT$ | 🐛 **Bug-3** |
| 2026-09-19 08:00 | user review：coupon 設定沒按 Next 就關 tab → 設定遺失 | 🐛 **Bug-4** |
| 2026-09-19 18:00 | user review：coupon 設定沒有回填 | 🐛 **Bug-5** |
| 2026-09-20 02:24 | 修 Bug-1+2+3：commit `32e61aa fix(coupon-preview): NT$ prefix on en TWD + count unit on Remaining Count` | ✅ |
| 2026-09-20 02:30 | 修 Bug-4：CardBuilderEditor.tsx 新增 Step 6 coupon autosave effect + +5 conformance test | ✅ |
| 2026-09-20 02:57 | 修 Bug-5：commit `aa884e1 fix(backend): coupon card 4-layer schema sync + constants wire-up` | ✅ |

## Bug-1：coupon step 6 永遠顯示 hard-coded 折扣字串

### 症狀

DOM Path：`PassCardPreviewBody` 內的 `<span class="text-sm font-medium">R10折扣</span>`

無論使用者：
- 選 amount_off 或 percent_off
- 輸入 couponDiscountAmount = 100 或 5
- 任何 TWD / ZAR 組合
- zh-TW 或 en i18n

都永遠顯示 `R10折扣`（zh-TW）/ `10元折扣`（zh-TW）/ `1%折扣`（zh-TW + percent_off）/ `R10 off`（en）/ `50 off`（en + TWD + amount_off）。

### Root cause

`PassCardPreviewBody` 沒收 coupon props。檢查 `PreviewWrapper.types.ts`：

```ts
// PassCardPreviewBody 對 coupon 完全沒有 prop 接線
export interface PassCardPreviewBodyProps {
  // 沒有 firstCouponRemainingCount
  // 沒有 couponDiscountType
  // 沒有 couponDiscountAmount
  // 沒有 couponDiscountPercent
  // discount / member 都有，但 coupon 漏了
}
```

`PassCardPreviewBody.tsx` 內 coupon 的 render block 是 discount card extension（2026-09-18 commit `02aaea2`）時加的 stub，當時是 placeholder，coupon card 的 editor 是 2026-09-19 才落地，**沒人回去補 preview chain 的 prop 接線**。

### 修法（commit `32e61aa`）

1. `PreviewWrapper.types.ts` + `PreviewWrapper.tsx`：新增 4 個 prop 透傳到 `PassCardPreview`
2. `PassCardPreview.types.ts` + `PassCardPreview.tsx`：新增 4 個 prop 透傳到 `PassCardPreviewBody`
3. `PassCardPreviewBody.tsx`：解析 type + 讀 store 對應欄位渲染

```tsx
// PassCardPreviewBody 內 coupon discount slot
{couponDiscountType === 'amount_off' && couponDiscountAmount !== null && couponDiscountAmount !== undefined ? (
  <span>{COUPON_PREVIEW_AMOUNTS[currency].couponDiscount.replace('10', String(couponDiscountAmount))}</span>
) : couponDiscountType === 'percent_off' && couponDiscountPercent !== null ? (
  <span>{`${couponDiscountPercent}%折扣`}</span>
) : (
  // fallback demo value (currency-driven, amount_off 永遠有 default '10元' / 'R10')
  <span>{COUPON_PREVIEW_AMOUNTS[currency].couponDiscount}</span>
)}
```

**注意**：上述 `.replace('10', String(couponDiscountAmount))` 是簡化寫法，實際是 template string interpolation。`COUPON_PREVIEW_AMOUNTS[currency].couponDiscount` 是 template `10元折扣` / `R10折扣`，把 `10` 換成 user 輸入值。

### Pin test

`PassCardPreviewBody.test.tsx` +2 regression test：
- `coupon_card + amount_off + couponDiscountAmount=50 → 顯示 50元折扣 / NT$50 off / R50 off`
- `coupon_card + percent_off + couponDiscountPercent=20 → 顯示 20%折扣 / 20% off`

## Bug-2：% 數切換後 preview 沒跟著改變

### 症狀

使用者：
1. 預設 amount_off → preview 顯示 `10元折扣` ✓
2. 切到 percent_off → preview 還是 `10元折扣`
3. 輸入 `20` percent → preview 還是 `10元折扣`
4. 切回 amount_off → preview 還是 `10元折扣`

### Root cause

同 Bug-1：PassCardPreviewBody 完全沒讀 coupon props，所以 couponDiscountType 在 store 怎麼變都不影響 render。

### 修法

同 Bug-1 修法（修完 Bug-1 就一起解掉，因為 prop 接上後 type 切換會 trigger re-render 顯示對應分支）。

### Pin test

`PassCardPreviewBody.test.tsx` 新增 `switches preview branch on couponDiscountType change` regression test：
- initial amount_off + 顯示 10元折扣
- 切到 percent_off + 顯示 1%折扣（couponDiscountPercent=null 時的 fallback）

## Bug-3：i18n 英文缺少折扣翻譯 + en + TWD + amount_off 缺 NT$

### 症狀

DOM Path：`<span class="text-sm font-medium" style="color: rgb(255, 224, 198);">R10折扣</span>` i18n 是英文時顯示 raw key `couponDiscount`。

第二輪 user review：
- zh-TW：`10元折扣` ✓
- en + TWD + amount_off + couponDiscountAmount=50：`50 off` ❌（缺 NT$）
- en + ZAR + amount_off + couponDiscountAmount=50：`R50 off` ✓（R 是 prefix）
- en + percent_off + couponDiscountPercent=20：`20% off` ✓

### Root cause

`passCard.en.ts` 的 `couponDiscount` 模板：

```ts
// zh-TW
couponDiscount: '{{amount}}元折扣'   // ✅ Han suffix 自然帶「元」單位

// en
couponDiscount: '{{amount}} off'     // ❌ 缺 NT$（ISO 4217 NT$）
```

zh-TW 不需要顯式標 NT$（中文「元」已經表達 New Taiwan Dollar），但 en 必須顯式標 `NT$` 才能讓英文使用者知道這是台幣（不是美元、不是歐元）。

### 修法（commit `32e61aa` 內）

```ts
// passCard.en.ts 改為
couponDiscount: 'NT${{amount}} off'   // ✅ ISO 4217 NT$ marker
```

zh-TW 不變。

### Pin test

`PassCardPreviewBody.test.tsx` +1：
- `coupon_card + en i18n + TWD + amount_off + couponDiscountAmount=50 → 顯示 NT$50 off`

## Bug-4：coupon 設定沒按 Next 就關 tab → 設定遺失（autosave 缺失）

### 症狀

使用者：
1. 進 Step 6 coupon_card
2. 改 couponDiscountType → amount_off
3. 輸入 couponDiscountAmount = 50
4. 輸入 couponIssueCount = 3
5. 關 tab（沒按「下一步」/「上一步」）
6. 重新開啟同張卡片 → 設定完全沒儲存

### Root cause

`CardBuilderEditor.tsx` 有 5 個 autosave effect（Step 2 / Step 4 / Step 5 / isPaid / cardName）但**沒有** coupon 的。coupon 的 PUT 只在 `CardBuilderEditorWorkspace.tsx::handleNext` 的 step 6 region 觸發。沒有按 Next → 沒有 PUT → 設定留在 store，reload 後 store 被 reset。

這是 2026-09-05 Step 4 / 2026-09-18 Step 2 / 2026-09-18 Step 5 同 pattern 的第 6 次重現。

### 修法

`CardBuilderEditor.tsx` 新增第 6 個 autosave effect（~160 行，完整 pattern 跟 Step 2/4/5 對齊）：

| Pattern component | 對齊 |
|---|---|
| `couponBaselineArmedRef` | reset on cardId change |
| 共用 `step4LoadSettledRef` | 與 Step 2/4/5/isPaid 共享同一個 load timeline |
| `lastCouponSnapshotRef` | JSON.stringify snapshot diff |
| `couponSaveTimerRef` | 1000ms debounce + cleanup |
| 欄位 validation gate | type guard + amount guard + percent guard + issue count guard |
| Timer fire 從 `useCardBuilderStore.getState()` 讀最新值 | 不 capture 閉包 |

### Pin test

`CardBuilderEditor.autosave.test.tsx` +5 conformance test：
1. `autosaves couponDiscountType change to settings.couponDiscountType`
2. `autosaves couponDiscountAmount change to settings.couponDiscountAmount`
3. `autosaves couponDiscountPercent change to settings.couponDiscountPercent`
4. `autosaves couponIssueCount change to settings.couponIssueCount`
5. `does NOT autosave empty defaults before async fetch resolves — Step 6 coupon (regression 2026-09-19)`
6. `full coupon_card payload round-trips through autosave (end-to-end regression)`

test 5 是 slow-network regression：fetch 延遲 3s，autosave 不應在 fetch 還沒 resolve 前 fire empty defaults（**這條若 backend schema 還是漏的話 fetch resolve 後 loadSettings 也不會 hydrate coupon 欄位**，是 backend mirror 是否成功的端到端驗證）。

## 教訓

### 教訓 1：preview chain prop 接線容易漏

PassCardPreviewBody 在 discount card extension（2026-09-18）時已經被改過，但 coupon card 的 prop 接線沒做。漏 commit 一個檔。

**修法**：未來任何「新增 card type 的 sub-module」必須 review preview chain 三層：
- `PassCardPreview.types.ts` 有 prop
- `PassCardPreview.tsx` 有透傳
- `PassCardPreviewBody.tsx` 有實際 render 邏輯

而且要 +1 regression test（hard-coded fallback 不存在 + store-driven render 真的拿到 user 輸入）。

### 教訓 2：autosave pattern 應該開 skill（不是只有 rule 030/031/032）

2026-09-18 `saome-card-field-autosave-pattern/SKILL.md` 已建立 5 層 pipeline + copy-paste hook template。但 coupon 是第 6 個實例，仍在 `CardBuilderEditor.tsx` 內 inline 寫（沒抽到 hook）。

**修法（後續）**：把 6 個 inline autosave effect 抽成 `useCardFieldAutosave<TFields>(cardId, sessionKey, fields, validator, debounceMs)` hook，每個 card type 提供一個 thin wrapper（`useStep4Autosave`、`useStep5Autosave`、`useCouponAutosave` 等）。這條下次再做。

### 教訓 3：i18n 英文模板必須顯式帶 ISO 4217 貨幣 marker

zh-TW 不需要顯式標 NT$（中文「元」自然帶單位），但 en 必須顯式標 `NT$` 才能讓英文使用者辨識。這跟 Rule 023 § 翻譯書寫紀律「嚴格遵守全英文，禁止摻雜其他語言」是一致的——en 不寫中文 `元`，但**必須**寫 `NT$`。

**修法**：未來新增 en 貨幣模板前，default 就是 `NT$<amount>` / `R<amount>` pattern，不要 fallback 到 `<amount> off`。

### 教訓 4：每次 sub-module 落地必須 review「preview chain + autosave + i18n + store」四件套

Coupon card 落地時漏了 preview chain，user review 才發現。應該有一個 pre-completion checklist：

| # | Check | 驗證指令 |
|---|---|---|
| 1 | preview chain 三層 prop 接齊 | grep `firstCoupon\|couponDiscountType\|couponDiscountAmount\|couponDiscountPercent` in PreviewWrapper.tsx PassCardPreview.tsx PassCardPreviewBody.tsx |
| 2 | autosave effect 落地 | grep `couponSaveTimerRef` in CardBuilderEditor.tsx |
| 3 | i18n 雙語對齊 | grep `coupon` in cardEditor.zh-TW.ts cardEditor.en.ts |
| 4 | store setter 對齊 mutual exclusion | grep `setCouponDiscountType` in store.ts，確認有清空另一個 value field |

## 觸發關鍵字

「coupon」、「coupon_card」、「Step 6 coupon」、「PassCardPreviewBody coupon」、「coupon autosave」必引。

## 參照

- `runs/improvements/feedback/20260919-coupon-step6-no-backfill-backend-schema-drift.md` — Bug-5 backend mirror 完整 trace
- `runs/improvements/feedback/20260918-step2-autosave-5th-instance-skill-needed.md` — autosave pattern 起源
- `.cursor/rules/030-effect-first-run-not-trustworthy.mdc` — baseline-armed pattern
- `.cursor/rules/031-long-timer-async-fetch.mdc` — long-timer + async fetch pitfall
- `.cursor/rules/032-backend-jsonb-merge-silent-killer.mdc` — backend JSONB merge silent overwrite
- `.cursor/skills/saome-card-field-autosave-pattern/SKILL.md` — autosave hook template
- DEV/09-2026/0919-step6-coupon-card-dev-log.md — coupon card 主 DEV LOG