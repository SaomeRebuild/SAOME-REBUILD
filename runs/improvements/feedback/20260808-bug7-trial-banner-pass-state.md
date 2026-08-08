# Bug-7 TrialBanner — Two Hidden Root Causes in One Bug

## 背景

使用者回報 `ppp@hotmail.com`（gold plan）登入後 dashboard 沒有顯示 TrialBanner，
且「連本地環境都沒出現橫幅」。一開始懷疑是 deploy gap / CI / Mixed Content，
後來確認本地也壞，確定是代碼邏輯問題。

## 根因

### Root Cause 1：useAuth.refresh() 漏寫 pass（技術性 bug）

`authService.refresh()` 回傳完整的 `AuthSessionWithTenant`（含 `pass`），
但 `useAuth.refresh()` 只寫了 `accessToken` / `expiresAt` 到 state：

```ts
// BUG — pass was returned but silently dropped
const refresh = useCallback(async () => {
  const refreshed = await authService.refresh();
  setStateRaw((s) => ({
    ...s,
    accessToken: refreshed.accessToken,
    expiresAt: Date.now() + (refreshed.expiresIn ?? 28800) * 1000,
    // ← 沒有 pass！
  }));
}, []);
```

後果：page reload → AuthProvider mount → mount-time `refresh()` →
state 仍是 `pass: null` → TrialBanner `visible = false`。
`pass` 存在於 backend response 內，但從未進入 frontend state。

修法：加 `pass: refreshed.pass ?? s.pass`。

### Root Cause 2：TrialBanner plan filter 是錯誤的商業邏輯假設

`useTrialBanner.visible` 原本只接受 `plan === 'green'`：

```ts
const visible =
  pass !== null &&
  pass.plan === 'green' && // ← gold/platinum 全被擋掉
  pass.status === 'active' &&
  daysLeft > 0;
```

`ppp@hotmail.com` 的 plan 是 `gold` → 邏輯上「正確」地被隱藏，
但商業邏輯確認：所有 plan 都有 14 天試用期，gold/platinum 也該顯示。

修法：改為接受 `green | gold | platinum`。

## 修法

| commit | 描述 |
|--------|------|
| `c76d992` | `useAuth.refresh()` 加 `pass: refreshed.pass ?? s.pass` |
| `a39a379` | `useTrialBanner.visible` 接受全部三個 plan；移除 `plan` prop from `TrialBanner` |

## 學習

### 1. authService 回傳值 ≠ AuthProvider state

兩者不是自動同步的。`authService` 回傳什麼，不代表 `useAuth` state 有什麼。
每次改 `authService` 回傳值時，**必須**同步檢查所有 `useAuth.tsx` 內使用它的 consumer。

**預防**：建議在 `000-modular-design.mdc` 加一條慣例：
> Hono service / BFF service 回傳的 DTO，每個 field 都必須在 consumer 內被實際使用。
> 如果某個 field 存在於回傳值但從未寫入 state，這是 drift 而非 feature——應視為 bug。

### 2. 商業邏輯不能自己推斷，要問

`pass.plan === 'green'` 隱藏了「我假設只有 green plan 有試用期」的錯誤假設。
這種假設從程式碼看不出來，只有跟使用者確認才能發現。

**預防**：寫任何「只有某種情境才 render」的商業邏輯前，先問：「這個邏輯對所有 plan/role/情境都適用嗎？」

### 3. 資料庫是事實的來源（Source of Truth）

一開始花了時間懷疑 Mixed Content / deploy gap / CI build failure，
最後是靠 Supabase MCP `execute_sql` 直接查 `passes` table 才確認：
- `ppp@hotmail.com` 有 `pass_id`，`plan='gold'`，`status='active'`，`end_date='2026-08-22'`
- `aaa@bbb.com` 有 `pass_id`，`plan='green'`，`status='active'`

資料庫不會說謊。遇到「邏輯看起來沒問題但就是不行」，立刻查 DB。

### 4. 三層次排除法（由快到慢）

遇到「看起來對但不行」的 bug 時：
1. **CI deploy** — 看 Cloudflare Builds list 確認最新 commit 是否 deploy 完成
2. **本地邏輯** — 在本機重現，避免等 CI；這次本地也壞 = 代碼問題
3. **DB data** — 用 MCP 查實際資料，排除「假設跟現實不符」

順序：CI → 本地 → DB

---

## 附記：RegisterForm Step 3 的值得記錄的 Pattern（2026-08-08）

### Pattern 1：簡單選擇 UI 不需要 react-hook-form

Step 3 是 pure UI 選擇（3 個 plan card 點選），不需要 validate，
所以用 component state (`useState<PricingTier | null>`) 而不是 RHF。

這是正確的選擇——RHF 的價值在複雜 validation，不在「有 input 就用」。

### Pattern 2：multi-step handoff 靠 sessionStorage，不靠 props

Step 1 → Step 2 → Step 3 時，所有資料寫入 `sessionStorage`：
```ts
sessionStorage.setItem('saome.reg.tenant', JSON.stringify(values)); // step 1
sessionStorage.setItem('saome.reg.account', JSON.stringify(values)); // step 2
```

Step 3 submit 時一次性組裝：
```ts
const tenant = JSON.parse(sessionStorage.getItem('saome.reg.tenant'));
const account = JSON.parse(sessionStorage.getItem('saome.reg.account'));
const payload = { ...tenant, ...account, plan: selectedPlan };
```

好處：步驟之間完全不耦合，back/forward 行為自然。

### Pattern 3：PlanSelector 違反 shared package 邊界

`PricingTier` 型別定義在 `@/components/pricing`（frontend app 層），
但 `PlanSelector` 從那裡 import。如果 React Native 以後要遷移，這個型別會綁在 app 層。

**建議**：遷移到 `packages/shared/types/pricing.ts`，`PlanSelector` 和 `RegisterForm` 都從 shared import。

### Pattern 4：`as RegistrationPayload` 是 schema drift 訊號

```ts
const payload: RegistrationPayload = {
  ...tenant, ...account, invoiceAddress: ..., plan: selectedPlan,
} as RegistrationPayload;
```

`as` 強轉 = TypeScript 在告訴你「兩個型別的 shape 不完全 match，
你在繞過型別檢查」。根因是 `RegistrationPayload` 的 field set 跟
`TenantInfoInput + AccountInfoInput` 的 union 不完全對齊（e.g. `invoiceAddress`
是 optional 但 payload 必填）。

這是 rule 019 schema contract drift 的經典訊號，未來應該統一 schema。

---

> 撰寫者：cursor-agent ｜ 時間：2026-08-08
