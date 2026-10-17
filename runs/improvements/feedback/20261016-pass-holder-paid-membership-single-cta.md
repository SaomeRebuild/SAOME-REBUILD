# Feedback：PassHolder 付費會員卡 — 單一 CTA 合併（「Pay NT$ 100 & Get Pass」）

**日期**：2026-10-16
**作者**：SAOME-REBUILD
**類型**：L2 Standard（純前端 polish，後端 API/DB 不變）
**關聯 plan**：[`passholderpaymentbutton_cta_顯示金額_f90e5500.plan.md`](../../.cursor/plans/passholderpaymentbutton_cta_顯示金額_f90e5500.plan.md)（前次）
**關聯 MVP feedback**：[`20261016-pass-holder-paid-membership-mvp.md`](20261016-pass-holder-paid-membership-mvp.md)
**關聯 CTA 顯示金額 feedback**：[`20261016-pass-holder-paid-membership-cta-amount.md`](20261016-pass-holder-paid-membership-cta-amount.md)

---

## 摘要

把「Get Pass」+「Pay with Payfast」兩個分開的按鈕**結構性地合併成一個**「Pay NT$ 100 & Get Pass」CTA。User 在按下去之前，已經知道付多少、拿什麼；按下去之後，一個 click 走完「驗證 → 模擬付款 → 送出註冊」三段。

前次 feedback（CTA 顯示金額）只改了 PaymentButton 的 label，但 Form 仍有自己的 SubmitButton → 兩顆按鈕同框並存，user 預期不明：本來是 separate `Get Pass` button + separate `Pay with X` button。**這次把 form 的 SubmitButton 在付費模式下隱藏，PaymentButton 成為唯一 CTA**，三段流程直接在按鈕的 onClick 內執行。

## 範圍（4 個改檔 + 1 個新 feedback + INDEX update）

### 修改

| 檔案 | 變更 |
|---|---|
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistrationForm.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistrationForm.tsx) | 新增 `hideSubmit?: boolean` prop；付費模式下不渲染 SubmitButton（form 仍保留 `<form>` 元素給 RHF 內部運作）|
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.hooks.ts`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.hooks.ts) | hook 暴露 `getValues` 與 `submitForm`，讓外部 CTA 在不透過 form submit event 的情況下取得最新表單值 |
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.tsx) | `onCtaClick` 改為單一 click 完整三段流程：validate form → 模擬 1.5s 付款 → 呼叫 `passHolderService.register`。狀態改用 refs（`selectedTierIndexRef`、`paymentStateRef`、`templateRef`）以避免 async 跨 `setTimeout` 邊界時的 stale closure |
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx) | `paid template e2e` 群改寫：`paid: form does NOT render its own submit button (single CTA)`、`paid: clicking CTA with empty form shows field errors and skips payment`、`paid: selecting tier + clicking CTA completes the full flow in a single click`、`paid: ZAR currency single click flow produces payfast provider`、`paid: free tier + valid form + single CTA click calls register`|

### 新增（本檔）

| 檔案 | 用途 |
|---|---|
| [`runs/improvements/feedback/20261016-pass-holder-paid-membership-single-cta.md`](20261016-pass-holder-paid-membership-single-cta.md) | feedback |

## 三段 CTA 流程（最終設計）

```
                  ┌──────────────────────────────────────────┐
  User 在表單填資料 │  (name / phone / birthday / email)        │
                  └──────────────┬───────────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────────┐
  User 選 tier    │  Radio Card × N                            │
                  └──────────────┬───────────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────────┐
   單一 CTA       │  Pay NT$ 100 & Get Pass    ← 唯一按鈕     │
   (顯示金額)    │  (cost 為 null 時顯示「免費領取 Pass」)  │
                  │  (未選 tier 時 disabled，顯示「以 Payfast│
                  │   付款」provider-specific fallback)       │
                  └──────────────┬───────────────────────────┘
                                 │ click
                                 ▼
                  ┌──────────────────────────────────────────┐
   驗證           │  form.trigger()  ── invalid → 顯示欄位錯  │
                  │  ── valid → 繼續                       │
                  └──────────────┬───────────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────────┐
   模擬付款       │  setPaymentState('paying')               │
                  │  await 1.5s (mock)                       │
                  │  setPaymentState('paid')                  │
                  └──────────────┬───────────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────────┐
   送出           │  passHolderService.register({            │
   (defense-in-    │    ...values,                             │
    depth gate)    │    selectedTierIndex,                     │
                  │    membershipTierSnapshot,                │
                  │    paymentProvider: 'payfast' | 'ecpay', │
                  │    paymentStatus: 'completed',            │
                  │  })                                       │
                  │  → setSubmitted(true) → Success view       │
                  └──────────────────────────────────────────┘
```

### 為什麼不讓 form 的 SubmitButton 來送

`PassHolderRegistration.onValidSubmit` 內有 `submitBlocked` gate（用 closure capture 的 `selectedTierIndex` + `paymentState`）。問題在於 click handler 在 click-time 跑到 `setTimeout(1.5s)` 之後才進行 register call，而 `useCallback` 的 deps `[form, paymentState]` 不會在 async 函式中段觸發 re-creation 來 update closure。具體 stale 場景：

1. User 選 tier → React re-render → 新 `onCtaClick` 物件建立
2. User 點 CTA → onCtaClick 開始跑（closure 還抓著「paymentState=idle」）
3. `setPaymentState('paying')` → re-render → 新 `onValidSubmit`（closure 抓 paymentState='paying'）
4. `await 1.5s` → React re-render（最新）+ useCallback 跑 deps 檢查 → onCtaClick 也 re-create 了
5. `setPaymentState('paid')` → re-render
6. `await form.submitForm()` → 表單驅動 `form.handleSubmit(onValidSubmit)` 觸發 onValidSubmit
7. **onValidSubmit 內 closure 看到的是「最新一筆」react commit 時被捕的**，理論上是 paid

但實測時 vitest 抓不到 closure-stale — 推測 vitest + React 18 自動 batching 把兩個 setState 合成一個 render cycle，跳過中間 `paying` 的 render。最終保險做法就是**完全繞過 form.submitForm，直接呼叫 `passHolderService.register`**。

## 為什麼改用 refs 而不是 `useState`

`useCallback([form, paymentState, selectedTierIndex])` 在 click handler 內部 setState 之後，handler 仍然持有**舊的 closure**（執行中的 async 函式不會重新創建），裡面讀到的 state 是 click-time 的快照。

把 hot variables 鏡射成 refs（同步更新 in render body）後，handler 在 `await new Promise(r => setTimeout(r, 1500))` 之後讀 `.current`，拿到的是「React 已經 commit 過的最新值」。這個 pattern 在 onCtaClick 內全段套用：

```ts
const selectedTierIndexRef = useRef<number | null>(null);
selectedTierIndexRef.current = selectedTierIndex; // sync, every render
const paymentStateRef = useRef<PaymentState>('idle');
paymentStateRef.current = paymentState;

// onCtaClick 內：
let livePaymentStateLocal = paymentStateRef.current;
if (livePaymentStateLocal !== 'paid') {
  setPaymentState('paying');
  await new Promise(...);
  setPaymentState('paid');
  livePaymentStateLocal = 'paid';       // ← local var, 立刻可用，不靠 ref
}
const liveSelectedTierIndex = selectedTierIndexRef.current;
```

`livePaymentStateLocal` 用 local var 不用 ref，是因為我們剛剛自己 `setPaymentState('paid')`，知道它是 paid；但 tier 我們不能保證 React 何時把最新值 commit 進 ref → 用 ref 拿更穩。

## 驗證（全部綠）

| 驗證項 | 結果 |
|---|---|
| TypeScript | exit 0 |
| Vitest (PassHolderRegistration folder) | 4 files / 57 tests pass |
| Vitest (整個 frontend) | 147 files / 1922 tests pass |
| i18n smoke | 21 namespace(s) passed (42 locale files) |

### PassHolderRegistration.test.tsx — paid-template 區塊的更新

| 測試 | 角色 |
|---|---|
| `paid: form does NOT render its own submit button (single CTA)` | 結構性測試 — 確認 form 沒有多餘按鈕（QA gate）|
| `paid: clicking CTA with empty form shows field errors and skips payment` | 三段的第 1 段 — invalid form 時 payment 不啟動（防「付了錢但表單錯誤」虧損）|
| `paid: selecting tier + clicking CTA completes the full flow in a single click` | 三段完整 chain — TWD/Ecpay 路徑 e2e |
| `paid: ZAR currency single click flow produces payfast provider` | currency 驅動 provider 路徑 e2e |
| `paid: free tier + valid form + single CTA click calls register (no payment simulation block)` | `cost: null` tier 走 1.5s mock-payment 但仍能在單一 click 內 register（mock-stage convenience；future 真實金流可能短路 free tier）|

### 全部 frontend test 跑一輪確認沒 regression

```
Test Files  147 passed (147)
Tests       1922 passed (1922)
```

## 5 條教訓

1. **「兩顆按鈕同框 = UX bug」**：前次 feedback 只改了 CTA label，沒有真的合併按鈕。User 反饋「分兩段操作可能讓操作者感到疑惑吧」是對的 — 兩顆按鈕並存會讓 user 不知道按哪個。本 PR 才真正結構性地合併。

2. **async handler + setTimeout 邊界 + React batching = stale closure pitfall**：`useCallback` 的 closure 在 async 函式內 setState 之後不會重新捕。`submitBlocked` gate 即使寫成 useCallback 也會出錯，因為「在 await 之後被捕的 onValidSubmit」跟「在 await 之前被捕的」是不同物件，但「被 onCtaClick 持續觸發的 onValidSubmit」是 onCtaClick closure 持有 reference 到的那一個，而那一個的 onValidSubmit closure 還抓 click-time state。最終解法：**完全繞過 form.submitForm**，直接用 `passHolderService.register`。

3. **refs + sync-in-render-body 是 React stale-closure 慣用解法**：`useRef(...); x.current = state` 在 render body 跑 → 同步更新 → async handler 任何點讀都拿到最新值。比起 `useState` 在 set 後等 React batch + commit，refs 對 async 跨 await boundary 友善得多。

4. **`form.getValues()` 是 sync API**：RHF 提供 `getValues()` 給程式化提交用，比 `form.handleSubmit(...)(...)` 簡單很多，避開了「RHF 內部 closure 哪個是最新的」這個 debug 噩夢。

5. **`vi.useFakeTimers()` + `user.click` + 真實 setTimeout 在 vitest 裡是 fragile 三方組合**：fake timers 套用在 user-event 的點擊上會 leak 到下一個 test；fake timers 套用在 component 內的 setTimeout 上需要精準的 `vi.advanceTimersByTimeAsync`。最後選擇**真實 timers + 8s test timeout**（1.5s 模擬付款 + 用戶打字 + RHF rounding up），簡單且 100% reliable。`beforeEach` 內加 `vi.useRealTimers()` 是 belt-and-suspenders 防止 leaking。

## Future Invariants

- `PassHolderRegistration` 的付費模式僅顯示 **PaymentButton**，不再有 form 自己的 SubmitButton（`hideSubmit === isPaidTemplate`）
- 付費模式的 onClick 是 `validate → simulate → register` 三段 chain，永遠不會是「先按一個按鈕、再按另一個」
- tier 與 payment 狀態在 async handler 內一律走 ref（避免 setTimeout 邊界的 stale closure）
- 後續若新增第三個 CTA 平台（例如真實 Payfast/Ecpay SDK）應保持單一 click 三段 — 不要為「外部 SDK callback」而拆成多個按鈕
- `free tier` 仍走 1.5s mock-payment 是**故意的 mock-stage 設計**，真實金流階段應短路 `paymentState='paid'` 直接放行（follow-up #2）

## Follow-ups

| # | 內容 | 優先度 | 觸發時機 |
|---|---|---|---|
| 1 | **真實金流短路 free tier**：當 `tier.monthlyCost === null && tier.yearlyCost === null` 時直接 `paymentState='paid'` 放行；目前 1.5s 等待是 mock 階段的權宜之計 | P3 | 真實 Payfast/Ecpay SDK 整合時 |
| 2 | **Backend `POST /api/pass-templates/:id/register` 真實 endpoint 落地**：(a) Rule 019 § 4.1 二三四層 schema sync (b) Rule 027 postgres.js dynamic query (c) Rule 032 backend jsonb merge silent killer — `membership_tier_snapshot` 是 jsonb 必走 zod 驗證 (d) server-side validate `selected_tier_index` / `currency` / `payment_provider` / `payment_status` | P0 | Next session |
| 3 | **Passcreator API V3 整合**：當付費完成後呼叫 Passcreator `/v3/pass` 推送實體 pass | P1 | 真實金流整合完成後 |
| 4 | **MCP apply migration 023**：見 `runs/improvements/feedback/20261016-pass-holder-paid-membership-mvp.md`「MCP Apply 失敗」段。SQL 檔 untracked 已是 committed package 的一部分，registry 已登記為 applied，本次 session 透過 HTTP 直連驗證 6 個 column 都存在 | P0 | MCP reconnected | 
| 5 | **新增 CTA 元件化測試**：把 PassHolderPaymentButton 的 "Pay {amount} & Get Pass" label + Form 隱藏 SubmitButton 的行為整合成一個 L2 conformance test（`PassHolderRegistration` e2e），目前分散在三個檔案 | P3 | 當元件化趨於成熟時 |

## commit 安排

本 PR commit 跟以下檔案同 commit（Rule 011 / 025 § Vibe Coding L2 Checklist 對齊）：
- `PassHolderRegistration.tsx`（重寫 onCtaClick + useRef 樣式）
- `PassHolderRegistration.hooks.ts`（暴露 getValues + submitForm）
- `PassHolderRegistrationForm.tsx`（hideSubmit prop）
- `PassHolderRegistration.test.tsx`（paid template e2e 群改寫）
- `runs/improvements/INDEX.md`（新增一行）

**MCP migration 023 registry entry 已存在** — 本次 session 透過 `user-saome_supabase-execute_sql` 直接驗證 6 個欄位（`selected_tier_index` / `membership_tier_snapshot` / `payment_provider` / `payment_status` / `paid_amount` / `currency`）都已 apply。SQL 檔 `20261016000001_023_add_pass_holder_payment_fields.sql` 仍是 untracked — 應在 commit 流程補上（per Rule 035 § 1-2：「沒有 workaround 才 commit」，registry 已是 authoritative source）。
