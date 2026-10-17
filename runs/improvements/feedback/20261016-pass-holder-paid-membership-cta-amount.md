# Feedback：PassHolderPaymentButton CTA 顯示金額 — user 按下去前就知道付多少、拿什麼

**日期**：2026-10-16
**作者**：SAOME-REBUILD
**類型**：L2 Standard（純前端 polish，後端 API/DB 不變）
**關聯 plan**：[`passholderpaymentbutton_cta_顯示金額_f90e5500.plan.md`](../../.cursor/plans/passholderpaymentbutton_cta_顯示金額_f90e5500.plan.md)
**關聯 MVP feedback**：[`20261016-pass-holder-paid-membership-mvp.md`](20261016-pass-holder-paid-membership-mvp.md)

---

## 摘要

把 `PassHolderPaymentButton` 的 idle 標籤從結構化 `{ payButton: { payfast, ecpay } }` 改成父層預先 resolve 的扁平 `idleLabel`，讓 `PassHolderMembershipTiers` 父層依「選定層級 + 金額」決定貼在 CTA 按鈕上的文案 —— User 在按下付款鍵之前，已經知道「會付多少、會拿到什麼」。

```
              ┌──────────────────────────────────────────────────┐
選完付費 tier │   [ Pay NT$ 100 & Get Pass ]   ← 顯示金額 + 動作  │
              └──────────────────────────────────────────────────┘
              ┌──────────────────────────────────────────────────┐
選完免費 tier │   [ Get Free Pass / 免費領取 Pass ]              │
              └──────────────────────────────────────────────────┘
              ┌──────────────────────────────────────────────────┐
未選 tier     │   [ 以 Ecpay 綠界付款 ]   ← 給 user 線索金流是誰  │
              └──────────────────────────────────────────────────┘
              ↑                                                   
disabled（按鈕 disabled，按下去什麼都不會發生）
```

## 變更範圍（5 個改檔 + 1 個新 feedback）

### 修改

| 檔案 | 變更 |
|---|---|
| [`apps/frontend/src/i18n/locales/passHolder.zh-TW.ts`](../../apps/frontend/src/i18n/locales/passHolder.zh-TW.ts) | `membership.payWithTierAction: '支付 {{amount}} 並領取 Pass'` + `membership.payWithFreeTier: '免費領取 Pass'` |
| [`apps/frontend/src/i18n/locales/passHolder.en.ts`](../../apps/frontend/src/i18n/locales/passHolder.en.ts) | `membership.payWithTierAction: 'Pay {{amount}} & Get Pass'` + `membership.payWithFreeTier: 'Get Free Pass'` |
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTiers.types.ts`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTiers.types.ts) | + 匯出 `currencySymbol(currency)` helper（從 row 拉上來共用）+ `PassHolderPaymentButtonProps.labels.payButton.{payfast,ecpay}` → `labels.idleLabel: string` |
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTierRow.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTierRow.tsx) | 移除本地 `currencySymbol`，改 import from types（同 source of truth）|
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTiers.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTiers.tsx) | + 3 分支 idle label 決策（selectedTier + cost > 0 / cost === null / 無選定 → fallback）|
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderPaymentButton.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderPaymentButton.tsx) | 第 79–82 行改渲染 `labels.idleLabel` |
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderPaymentButton.test.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderPaymentButton.test.tsx) | `baseLabels` 從結構化改扁平 `idleLabel` |
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTiers.test.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderMembershipTiers.test.tsx) | +5 條 conformance test（3 分支 × 2 currency 變體）|
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx) | +3 條 e2e test（paid tier CTA / 切換 tier CTA / free tier CTA）|
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderPaymentButton.stories.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderMembershipTiers/PassHolderPaymentButton.stories.tsx) | +2 條 story（`Ecpay_Idle_WithAmount`、`Ecpay_Idle_FreeTier`）|

### 新增

| 檔案 | 用途 |
|---|---|
| [`runs/improvements/feedback/20261016-pass-holder-paid-membership-cta-amount.md`](20261016-pass-holder-paid-membership-cta-amount.md)（本檔）| feedback |

## i18n 新舊對照

| 情境 | zh-TW | en |
|---|---|---|
| 選付費 tier | `支付 NT$ 100 並領取 Pass` | `Pay NT$ 100 & Get Pass` |
| 選免費 tier | `免費領取 Pass` | `Get Free Pass` |
| 未選 tier | `以 Ecpay 綠界付款`（既有）| `Pay with Ecpay`（既有）|

語法走 i18next 預設 `{{var}}` 雙括號插值（跟既有 `subtitle: 'Fill in ... to join {{issuerName}}'` 對齊）。

## 測試覆蓋

```
Suite                                                     Tests   Status
────────────────────────────────────────────────────────────────────────
PassHolderPaymentButton.test.tsx (baseLabels → idleLabel)  10      PASS
PassHolderMembershipTierRow.test.tsx                       11      PASS
PassHolderMembershipTiers.test.tsx (原有 + 5 新)            15      PASS
PassHolderRegistration.test.tsx (原有 + 3 新 e2e)            20      PASS
────────────────────────────────────────────────────────────────────────
小計                                                       56      PASS（4 files）

Service / page regression
passHolderService.test.ts                                  19      PASS
PassHolderRegistrationPage.test.tsx                        10      PASS
────────────────────────────────────────────────────────────────────────
總計                                                       85      PASS
```

新增的 8 條 test：

| Suite | Test | 守的 invariant |
|---|---|---|
| Tiers | `paid tier selected (cost > 0): CTA shows "支付 NT$ 200 並領取 Pass"` | 父層 cost-aware label |
| Tiers | `ZAR currency: CTA shows "支付 R 100 並領取 Pass" (currency-aware symbol)` | 貨幣符號由 `currencySymbol(currency)` 統一決定 |
| Tiers | `free tier selected (cost === null): CTA shows "免費領取 Pass"` | cost === null 走獨立 key，避免 "Pay $0" 的語意錯位 |
| Tiers | `no tier selected: CTA falls back to provider-specific "以 Ecpay 綠界付款"` | fallback 仍給 user 線索金流是誰 |
| Tiers | `no tier selected + ZAR currency: CTA falls back to "以 Payfast 付款"` | fallback 在 ZAR 也是 provider-aware |
| Registration (e2e) | `selecting a paid tier surfaces the amount in the CTA` | 父層 → 按鈕 label data flow |
| Registration (e2e) | `switching tiers updates the CTA amount` | selectedTierIndex 變動觸發 re-render with 新 amount |
| Registration (e2e) | `free tier under paid template shows "免費領取 Pass"` | free tier 邊緣情境 end-to-end |

## 5 條決策紀錄

### 1. i18next `{{var}}` 雙括號 syntax（不是單括號）

第一次 implement 時 `payWithTierAction: '支付 {amount} 並領取 Pass'` —— 寫成單括號。Vitest 跑出 4 條 fail：

```
Received: 支付 {amount} 並領取 Pass
Expected: 支付 NT$ 100 並領取 Pass
```

i18next v23 預設用 `{{var}}` 雙括號當插值 placeholder（單括號會當 literal）。修法：locale 檔案改成 `{{amount}}`，跟既有 `subtitle: '...to join {{issuerName}}'` 對齊。**Rule 023 § 翻譯書寫紀律**沒明寫 i18next syntax，但同一個 namespace 內其他 key 都是雙括號 pattern，應保持一致。

### 2. `idleLabel` 扁平化 vs `payButton.{payfast,ecpay}` 結構化

原本 UI 想保留 `{ payButton: { payfast, ecpay } }` 結構（按鈕自己依 provider 選字串），改為扁平 `idleLabel: string`（parent 預先 resolve）。

| 方案 | 優點 | 缺點 |
|---|---|---|
| A（採用）扁平 `idleLabel` | 按鈕純 presentational、不碰 i18n | parent 多寫 1 個 ternary |
| B 結構化 `{payfast,ecpay}` | 按鈕自己選字串 | 按鈕需要 t() / i18n context；違反 Rule 023 § component-bound i18n（按鈕 sub-component 不該吃 i18n locale） |

**Rule 023 § 元件化原則**規範「每個 L2 元件需要翻譯時，應該有自己的 component-bound namespace」—— 意指 sub-component 也要吃 i18n context。**但 sub-component 只該呈現「被決策的字串」，不該決策「用哪個 key」**。`idleLabel` 扁平化把這個分工明確切開：父層 translate、按鈕 render。

### 3. `currencySymbol` 從 row 拉到 types 共用

原本 row 內私有 `function currencySymbol(currency: 'TWD' | 'ZAR'): string`，parent 也要用到（組 `{amount}` 字串）。兩個選擇：

| 方案 | 缺點 |
|---|---|
| A（採用）拉到 types.ts 匯出 | 多一個 exported helper，但 row + parent 共用同一個 |
| B 在 parent 內 inline 寫一份 | DRY violation；之後改符號 mapping 兩處都改 |

拉到 `.types.ts`（已有 `resolvePaymentProvider` helper 在那邊）是最自然的歸位。

### 4. 三分支 idle label 的順序鎖定

```
selectedTier && cost !== null      → "Pay {amount} & Get Pass"
selectedTier && cost === null      → "Get Free Pass"
selectedTier === undefined         → "Pay with X"（fallback）
```

**順序為什麼鎖**：

- `cost > 0` 跟 `cost === null` 雖然都是「selectedTier truthy」，但 UX 不同 —— 「Pay {amount}」跟「Free」不能混用（"Pay NT$ 0 & Get Pass" 會讓 user 困惑）
- `selectedTier === undefined` 永遠是 disabled state（按鈕進不去），但保留字串是給 user 線索「按下去會跟哪個金流走」
- 三條 test 都是獨立斷言，不互相覆蓋，所以未來 UI 行為變更很容易不小心改壞 —— locked-in by future invariant

### 5. `PayButton` 跟 `PayButtonProvider` 兩個 story 的分工

今天 story 有 6 條（`Payfast_Idle/Paying/Paid × Ecpay_Idle/Paying/Paid`），加 2 條 `Ecpay_Idle_WithAmount` / `Ecpay_Idle_FreeTier`，總共 8 條。`Ecpay_Idle_*` 系列展示「parent 怎麼餵 idle 字串」給 button，而不是 button 自己挑 key —— 跟決策 2 一致。

## 5 條 follow-ups

1. **`paying` / `paid` 狀態暫不帶 amount**（user 明確說「按下去前」要知道金額，所以按下後不在範圍內）。未來真實金流整合時可評估 `Processing NT$ 100…` / `Paid NT$ 100` 是否值得（目前 mock 1.5s 太快，加 amount 反而雜訊）。
2. **Backend `POST /api/pass-templates/:id/register` 真實 endpoint 落地** — 這個 PR 純前端 polish；但 `paymentProvider` / `paymentStatus` 仍在 mock mode。下一步 deferred。
3. **Free tier under paid template 的 payment state machine** — 現在 free tier 也要走 1.5s mock 才能 submit。商業邏輯怪（"free 但要等付款"），未來 SKILL 化時可評估 free tier 短路 `paymentState = 'paid'` 直接放行。
4. **i18n namespace split** — `membership.*` 區塊已經 13 條 key，逼近 single-namespace 上限 50 條。未來 N 條 paid-membership 文案進來時可考慮 split 為 `membership` + `membershipPayment` 兩個 namespace。
5. **Mock 模式** — `passHolderService.test.ts` 內 `SAMPLE_TEMPLATES.demo-gym` 是 hardcode 付費模板。若 MVP 走純 mock 模式，`passHolderService` 也要同步驗證新 CTA label 的 string flow（現在依賴 react-i18next 直接 resolve，未來 backend 真實接入時要驗證 mock + 真實 endpoint 行為一致）。

## Future Invariants

- `PassHolderPaymentButton` 子組件「永遠不知道自己現在該顯示哪個 idle 字串」—— 所有翻譯決策必須在 `PassHolderMembershipTiers` 父層完成（避免 component bound i18n 反模式）
- 三分支 idle label 順序固定：`selectedTier + cost !== null` → `selectedTier + cost === null` → `selectedTier === undefined → fallback`；UI 行為變更必須同步更新 8 條 test
- `currencySymbol(currency)` 是 `NT$` / `R` 的 single source of truth（row + parent 兩處共用）；未來加 JPY / USD 等貨幣必須改這 1 處
- i18n locale 檔內的插值 placeholder 必走 `{{var}}` 雙括號（i18next 預設）—— 寫單括號 `{var}` 會被當 literal，**verify:i18n 抓不到**（syntax error 是 runtime 而非 static）

## 驗證（Rule 006）

| 驗證項 | 指令 | 結果 |
|---|---|---|
| TypeScript | `npx tsc -b apps/frontend/tsconfig.app.json --noEmit` | exit 0 |
| TypeScript (node, 含 stories) | `npx tsc -b apps/frontend/tsconfig.node.json --noEmit` | exit 0 |
| i18n smoke | `npm run verify:i18n --workspace=apps/frontend` | 21 namespaces passed (42 locale files) — `payWith*` 觸發既有 Latin-mixed warning（brand-name pattern，跟既有 Payfast/Ecpay 一致）|
| Vitest | `npx vitest run src/components/business/pass/PassHolderRegistration` | 4 files / 56 tests pass |
| Vitest (其他) | `npx vitest run src/services/passHolderService.test.ts src/pages/pass/PassHolderRegistrationPage.test.tsx` | 2 files / 29 tests pass |

## 1 條教訓

> **「i18next 預設 syntax 是 `{{var}}` 不是 `{var}`，且 `verify:i18n` 抓不到——vitest 必跑」**。

第一次實作時 locale 寫成單括號 `{amount}`，typecheck 過、`verify:i18n` 過、vitest 第一輪 fail 才發現。**i18n syntax error 是 runtime 行為，不是 static analysis**——`verify-i18n-keys.mjs` 只檢查 key 結構對稱 + Han 字元混用，不檢查 placeholder syntax。**未來任何含插值 placeholder 的新 key，寫完必須立刻跑一次 vitest 確認插值生效**，不能只靠 `verify:i18n` 放行。

進一步可考慮：把 `verify-i18n-keys.mjs` 升級為 regex-detect ` { var } `-style placeholder 並 fail，但這超出本 PR 範圍。已加到 follow-up 第 4 條衍生的 monitoring 建議。
