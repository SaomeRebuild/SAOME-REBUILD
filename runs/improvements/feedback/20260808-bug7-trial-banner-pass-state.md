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

> 撰寫者：cursor-agent ｜ 時間：2026-08-08
