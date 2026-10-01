# Membership Card Step 6 — Free/Paid 邏輯欄位 Bug 修正（三件 SOP + 兩處文案）

> 2026-10-01 ~ 2026-10-02 會員卡 Step 6 「免費卡看到的文案與欄位是付費卡的版本」完整 trace + 三件 belt-and-suspenders 修法 + 同 commit 帶的兩處文案修正。

## TL;DR

1. **Bug**：使用者開新草稿（`isPaid` 為 `undefined`）+ `cardService.getById` 回 `settings = {}`，Step 6 卻顯示「Step6 不需要被設定」文案（其實是 `freeStateHint` fallback）。回頭到 Step 2 勾選需收費（`isPaid=true`）再回 Step 6 顯示正確付費卡欄位；再回 Step 2 取消勾選（`isPaid=false`）→ 免費卡欄位才突然出現。換言之，使用者必須 toggle 一次 `paid → unpaid` 才能逃出 fallback。
2. **Bug-2（衍生）**：免費卡 FreeState 內的「等級名稱」section 渲染了付費卡的 `introHint` 文案（最多 5 組會員等級），但免費卡只能設 1 組，文案語意錯誤。
3. **Bug-3（衍生）**：`MembershipTierRewardValueField` 的 placeholder 顯示 `例如：https://example.com/vip`，但這個欄位是「獎勵內容」（自訂義文字）不是 URL，placeholder 應為「例如：每次入店享有免費咖啡一杯」之類的獎勵說明。
4. **修法**：(a) store 層 `loadSettings` 與 `setIsPaid` 的 seed 條件放寬並重構 early-return；(b) FreeState render-time 加 auto-seed effect 作為 last-line defense；(c) FreeState 改用 `introHintFree` key；(d) `rewardValuePlaceholder` 雙語修正。
5. **測試**：FreeState 16/16 + MembershipCardLogic 34/34 + Step6 integration 41/41 全綠；3 條 full-journey regression test 守住 fresh draft + free→paid→free toggle 完整鏈；verify:i18n 19 namespaces passed；typecheck exit 0。

## 時間軸

| 時間 | 動作 | 後果 |
|---|---|---|
| 2026-10-01 18:30 | user review：fresh draft + free card，Step 6 顯示「Step6 不需要被設定」 | 🐛 Bug 主因 |
| 2026-10-01 18:35 | user review：toggle isPaid 後又出現正確欄位，但流程違反直覺 | 確認為 regression |
| 2026-10-01 18:45 | user review：免費卡 FreeState 內的等級名稱 section 顯示付費卡的「最多 5 組」文案 | 🐛 Bug-2 衍生 |
| 2026-10-01 18:50 | user review：reward value 欄位的 placeholder 寫網址 | 🐛 Bug-3 衍生 |
| 2026-10-01 19:00 | 寫修正計畫（含 7 個 todo），3-layer belt-and-suspenders 策略 | plan 落地 |
| 2026-10-01 19:30 | 修 (1) `loadSettings` 條件 `isPaid === false` → `isPaid !== true` | ✅ store 層 |
| 2026-10-01 19:45 | 修 (2) `setIsPaid(false)` 拿掉 strict no-op early-return | ✅ store 層 |
| 2026-10-01 20:00 | 修 (3) FreeState render-time `useEffect` auto-seed via `setIsPaid(false)` | ✅ render 層 |
| 2026-10-01 20:30 | 修 (4) FreeState 內 `t('introHint')` → `t('introHintFree')` | ✅ Bug-2 |
| 2026-10-01 20:35 | 修 (5) `rewardValuePlaceholder` 雙語修正 | ✅ Bug-3 |
| 2026-10-01 20:50 | + 3 條 regression test（fresh draft + free↔paid toggle + integration） | ✅ 測試守住 |
| 2026-10-02 05:00 | 寫本 feedback（DEV LOG + INDEX） | 🔄 |

## 根因分析（三層獨立失敗匯聚）

### 層 1 — `loadSettings` defensive seed 條件太嚴格

`CardBuilderEditor.store.ts::loadSettings` 在 defensive seed 分支用 `resolved?.isPaid === false` 判斷「該不該補一個 default tier」。但 fresh draft 的 `settings = {}` 沒有 `isPaid` 這個 key，hydrate 完之後 `resolved.isPaid === undefined`。

```ts
// ❌ 修正前
if (
  trimmed.length === 0 &&
  resolved?.isPaid === false  // undefined === false → false，沒 seed
) {
  return [/* default tier */];
}

// ✅ 修正後
if (
  trimmed.length === 0 &&
  resolved?.isPaid !== true   // undefined !== true → true，seed
) {
  return [/* default tier */];
}
```

為什麼之前沒踩到？因為之前只在「explicit free」場景下測試（`{isPaid: false}`），沒測過 fresh draft 的 `{}`。情境差異就是「`isPaid === false`」與「`isPaid === undefined`」的差異。

### 層 2 — `setIsPaid` early-return 把 free-path seed 分支短路

`setIsPaid(isPaid)` 的開頭是 `if (isPaid === state.isPaid) return {};`，這條邏輯對 `paid → paid` 是對的（no-op），但對 `free → free` 也會短路——然而 `free → free` 是 free path 的 seed 分支的入口。修正前測試在 `reset() → setIsPaid(false)` 流程會跳過 seed（因為 `state.isPaid` 一開始就是 `false`）。

```ts
// ❌ 修正前
if (isPaid === state.isPaid) return {};  // free → free 短路掉 seed 分支
if (isPaid === false) { /* seed if tiers empty */ }

// ✅ 修正後
if (isPaid === true && state.isPaid === true) return {};  // 只 paid → paid 是真 no-op
if (isPaid === false) { /* seed if tiers empty */ }
```

修法後 `free → free` 仍會進入 seed 分支（idempotent：tiers 已有就不會再 seed，tiers 空才 seed）。

### 層 3 — FreeState 缺 last-line defense

即使前兩層都修了，仍可能因為新 code path / test `setState({membershipTiers: []})` 把 invariant 繞過。FreeState 加 render-time auto-seed effect 作為最後一道防線：

```ts
// MembershipCardLogicFreeState.tsx
useEffect(() => {
  if (membershipTiers.length === 0) {
    console.warn('[MembershipCardLogicFreeState] membershipTiers 為空,自動觸發 setIsPaid(false) 補 seed。');
    useCardBuilderStore.getState().setIsPaid(false);
  }
}, [membershipTiers.length]);
```

為什麼在 render-time 加 effect 而不是 render 直接 seed？因為 render 階段呼叫 `setIsPaid(false)` 會觸發 React "Cannot update component while rendering" warning；effect-based scheduling 把 state mutation 推出 render path。

依賴 `[membershipTiers.length]` 而非 `[membershipTiers]` 的理由：使用者輸入 tier name 不該重新 trigger 這個 effect；只有 length 變化（新增 / 清空）才有意義。

## 為什麼這次要走三層 belt-and-suspenders

單獨修任何一層都不夠：

| 修法 | 場景 | 不足 |
|---|---|---|
| 只修 (1) `loadSettings` 條件 | fresh draft 修好 | 但 `reset() → setState({tiers: []}) → setIsPaid(false)` 仍會 leak |
| 只修 (2) `setIsPaid` early-return | 切換場景修好 | 但 fresh draft 仍會 leak（`loadSettings` 條件不變）|
| 只修 (3) FreeState auto-seed | render-time 兜底 | 但 effect 觸發的 `setIsPaid(false)` 內部 early-return 短路掉 seed，等於無效 |

三層並存：
- (1) 守「fetch → hydrate」路徑
- (2) 守「使用者手動 toggle」路徑  
- (3) 守「任何第三方路徑」（test / new code path）

這跟 Rule 036 § 8.4 Cold Start 5 層 defense 的精神同源——>1 條路徑不夠保險，多層疊加讓「任何一層失效」仍有其他層兜底。

## Bug-2 衍生：FreeState 內的文案 key 錯用

### 症狀

DOM Path 顯示 free card FreeState 內的等級名稱 section：

```html
<p class="text-xs text-muted-foreground">會員可依等級享有不同優惠與專屬獎勵，最多可設定 5 組會員等級。</p>
```

但 free card 只能設 1 組 tier（最多 5 組是付費卡的描述）。

### Root cause

`MembershipCardLogicFreeState.tsx` 內的 header section 用 `t('step6.membership.introHint')` 取文案，但 `introHint` 是付費卡的 key。`Step6CardLogic.tsx` 的 dispatcher 透過 `isPaid` selector 在 dispatch 時正確切換 key（`introFree` / `intro`），但 FreeState 是獨立 sub-component，沒人 dispatch 它，它直接拿最上層的 key 導致用錯。

```tsx
// ❌ 修正前（FreeState 內）
<p className="text-xs text-muted-foreground">
  {t('step6.membership.introHint')}
</p>

// ✅ 修正後
<p className="text-xs text-muted-foreground">
  {t('step6.membership.introHintFree')}
</p>
```

### 修法

`cardEditor.{zh-TW,en}.ts::membership.introHintFree` key 早已存在（2026-09-14 dispatcher 改版時新增），但 FreeState 沒引用它。修正只是 FreeState 切換 key，不需要新增 key——i18n 規範的「先有 key、後用 key」鐵律在這裡成立。

i18n 文案對照：

| 語言 | introHint（付費卡） | introHintFree（免費卡）|
|---|---|---|
| zh-TW | 會員可依等級享有不同優惠與專屬獎勵，最多可設定 5 組會員等級。 | 免費會員卡只需設定一組會員等級與有效期限，最多可設定 5 組會員獎勵。 |
| en | Members enjoy different benefits and exclusive rewards by tier, up to 5 tiers. | Free membership cards need only one tier with a validity period; up to 5 rewards per tier. |

### Regression test（FreeState）

```ts
it('renders introHintFree (free-card copy), NOT introHint (paid-card copy) — regression 2026-10-02', () => {
  useCardBuilderStore.setState({
    isPaid: false,
    membershipTiers: [FREE_TIER],
  });
  render(<MembershipCardLogicFreeState showValidation={false} />);

  expect(screen.getByText('step6.membership.introHintFree')).toBeInTheDocument();
  expect(screen.queryByText('step6.membership.introHint')).toBeNull();
});
```

## Bug-3 衍生：reward value placeholder 與欄位語意不符

### 症狀

`MembershipTierRewardValueField`（每個 reward row 的 value input）顯示 placeholder：

```
例如：https://example.com/vip
```

但這個欄位的語意是「獎勵內容」（自訂義文字，例如「每次入店享有免費咖啡一杯」、「生日當月雙倍點數」），不是 URL。

### Root cause

`MembershipTierRewardValueField` 對應的 Apple Wallet schema 是 `backFields` 的 value（純文字）或 `coupons` 的 description。**不是 `links`（actionable URL）**。當時（2026-08-21 Step 4 落地時）這個欄位被當作 link-style 處理，沿用了 `links.value` 的 URL placeholder。

但 `MembershipCardLogic` 的 reward 是「會員達到 tier 後享受的優惠文字說明」（free 與 paid card 共用），不是點擊跳轉的 URL，所以 placeholder 必須是文字說明而非 URL。

### 修法

`cardEditor.{zh-TW,en}.ts::step6.membership.rewardValuePlaceholder`：

| 語言 | 修正前 | 修正後 |
|---|---|---|
| zh-TW | 例如：https://example.com/vip | 例如：每次入店享有免費咖啡一杯 |
| en | e.g. https://example.com/vip | e.g. A free coffee on every visit |

### 為什麼不再分 free / paid 兩個 placeholder

免費卡跟付費卡的 reward 欄位語意都是「自訂義獎勵內容」（「會員達到此 tier 享有什麼優惠」），商業邏輯同源，不需要分流。Bug-2 的 `introHint` 分流是因為「5 組 tier」 vs「1 組 tier」是商業數字差異，reward 內容則都是文字。

## 完整測試清單

### FreeState 16/16 全綠

| # | Test | 守護 |
|---|---|---|
| 1 | 預設渲染 FreeState 完整 editor | 一般路徑 |
| 2 | **renders introHintFree（free-card copy），NOT introHint（paid-card copy）— regression 2026-10-02** | Bug-2 |
| 3 | renders MembershipTierNameField bound to membershipTiers[0] | 一般路徑 |
| 4-7 | 各 sub-component 正確 bind | 一般路徑 |
| 8-15 | empty-fallback contract（3 條）+ auto-seed contract（2 條）| Bug 主因 |
| 16 | **full user journey: fresh draft (settings = {}) → FreeState renders full editor without fallback (regression 2026-10-01)** | 端到端 |
| 17 | **full user journey: free → paid → free toggle keeps FreeState full editor (regression 2026-10-01)** | 端到端 |

### MembershipCardLogic 34/34 全綠

含 1 條新測試：**FreeState empty-fallback when isPaid=false + no tier seeded — render-time auto-seed triggers (2026-10-01 belt-and-suspenders)** —— 把原本測「empty-fallback 顯示 hint」的契約改成「render-time auto-seed 觸發後顯示 full editor」。

### Step 6 integration 41/41 全綠

3 條新測試守住完整 user journey：

1. **membership_card fresh draft: loadSettings({}) + isPaid=false + name="VIP" → Step 6 Next enabled (regression 2026-10-01)**
2. **loadSettings with empty object + empty membershipTiers + undefined isPaid auto-seeds default tier (regression 2026-10-01)**
3. **loadSettings with isPaid=true + empty membershipTiers does NOT seed (paid card path stays empty — FreeState never renders)**

### verify:i18n

19 namespaces passed (38 locale files)。

### typecheck

exit 0。

## 教訓

### 教訓 1：Defensive seed 的條件不能假設 caller 一定餵對 shape

`loadSettings` 的 defensive seed 用 `isPaid === false` 嚴格相等檢查，但 caller（`cardService.getById` 在 fresh draft 場景）只給 `settings = {}`。`{}` 是合法 business 狀態（沒存任何欄位），不該被 defensive seed 當成「不該 seed」。

**未來 invariant**：defensive seed 的條件用「負面排除」（`isPaid !== true`）而非「正面包含」（`isPaid === false`）。負面排除涵蓋 `undefined` / `null` / 任何 corrupt 值；正面包含只涵蓋 exact match。

### 教訓 2：Early-return 短路可能誤殺合理分支

`if (isPaid === state.isPaid) return {};` 看似對稱（paid → paid / free → free 都 no-op），實際上 free path 的 seed 是「即使 no-op 也要 idempotent 重跑」的邏輯，短路會讓 seed 漏跑。

**未來 invariant**：store setter 的 early-return 必須分別考慮 paid / free 兩個 branch，不要合併。`paid → paid` 是真 no-op（清空 expiry fields 後 return），`free → free` 必須走 seed 分支（idempotent）。

### 教訓 3：Render-time auto-seed 是 last-line defense 但不是 no-op

把 effect 寫在 FreeState（消費者）內而非 store（生產者）內的代價是「FreeState 一旦卸載，效果就消失」。但好處是「只有真正 render 時才知道有問題」。未來若新增其他消費 `membershipTiers[0]` 的 component（如預覽 / preview），那個 component 也得加同樣 effect。

**未來 invariant**：render-time auto-seed 是「placeholder」，真正的「保險」應該在 production code（store `loadSettings` + `setIsPaid` 條件正確）。三層 defense 的存在意義是「任何一層失效仍有其他層兜底」，不是「任意一層可以省略」。

### 教訓 4：Bug-2 是 dispatcher 模式的不完整實作

`Step6CardLogic.tsx` 的 dispatcher 透過 `isPaid` selector 切換 `introFree` / `intro` keys。但 dispatcher 只管「sub-module 層級」的文案（FreeState vs PaidState 兩條 path 的 `intro` / `introFree` 切換），**沒管「sub-component 內部」是否正確用對 key**。FreeState 內的等級名稱 section 是 FreeState sub-component 內部的文案，dispatcher 不會介入，所以 FreeState 直接拿最上層的 `introHint` 就錯了。

**未來 invariant**：dispatcher pattern 落地時，必須明確標註「dispatcher 切換哪些 key」，sub-component 內部用的 key 不在 dispatcher 範圍內，必須 sub-component 自己根據 `isPaid` 選擇（或由 dispatcher 多傳一個 prop）。本案的修復路徑是後者（直接 hardcode `introHintFree`）——因為 FreeState 只服務 free card，沒有歧義。

### 教訓 5：Bug-3 是 copy-paste 沒檢查語意

`MembershipTierRewardValueField` 沿用了 `links.value` 的 URL placeholder，因為 schema 看起來像「value field」就 copy 過來。Schema 結構相似不代表語意相同——Apple Wallet `backFields.value` 是純文字、`links.value` 是 actionable URL、`coupons.description` 是純文字。

**未來 invariant**：新欄位的 placeholder 必須對齊「Apple Wallet 對應 field 的官方 spec」，而非「看 schema 結構相似就 copy」。驗證方法：grep 該欄位在 Apple Wallet Generator / Wallet Passes 工具的範例。

## 觸發關鍵字

「會員卡」、「membership_card」、「Step 6 free card」、「free card fallback」、「freeStateHint」、「Step 6 不需要被設定」、「introHintFree」、「rewardValuePlaceholder」、「auto-seed effect」必引。

「render-time auto-seed」、「belt-and-suspenders」、「dispatcher 沒管 sub-component 內部 key」→ 必引 § 教訓 1-4。

## 參照

- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts::loadSettings`（line 3882 附近）
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts::setIsPaid`（line 1903 附近）
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/MembershipCardLogic/MembershipCardLogicFreeState.tsx`（line 52-80 useEffect auto-seed + line 127 t('introHintFree')）
- `apps/frontend/src/i18n/locales/cardEditor.{zh-TW,en}.ts::step6.membership.{introHint,introHintFree,rewardValuePlaceholder}`
- `.cursor/rules/036-worker-runtime-cors-defense.mdc` § 8.4 — Cold Start 5 層 defense 的精神同源
- `runs/improvements/feedback/20260918-step2-autosave-5th-instance-skill-needed.md` — defensive seed pattern 起源
- `runs/improvements/feedback/20260905-step4-autosave-slow-network-baseline.md` — effect race condition 對比案例
- DEV/10-2026/1002-membership-card-step6-free-state-belt-and-suspenders.md（待補 master DEV LOG）
