# 2026-10-27 — 免費會員卡 tier snapshot 補齊 + 快照改為後端推導

> 實作 `runs/decisions/2026-10-27-membership-tier-snapshot-server-derived.md` 的完整 trace。
> 本篇記錄「過程中撞到什麼、為什麼這樣改」，決策本身在 Decision Log。

## 起因

前一版計畫（`plan_v3-pass_欄位值表現方式_—_拜訪次數單位_+_會員卡_member_level`）的 B 段寫著「免費會員卡沒有 tier snapshot，簽發時 fallback 到範本第一個 tier 名稱」。使用者指出：

> 免費會員的模板也是有填寫會員等級名稱的，雖然只會有一個層級，但還是有等級名稱。也就是說對於免費會員卡註冊而言，還沒有做 membership_tire_snapshot，這個要先做。

查證後發現：問題不是「fallback 寫錯地方」，而是**免費會員卡註冊從來沒產生過任何 snapshot**。三處限制串起來的結果：

```
getPublicService.projectOptionalFields
  └─ 只有 row.is_paid 為真才回傳 membershipTiers
       └─ 免費卡 is_paid = false → 公開頁 template.membershipTiers = undefined
            └─ buildRegisterPayload 只在 isPaidMembership 時組 snapshot
                 └─ 免費卡送 undefined
                      └─ registerService 照單透傳 → DB membership_tier_snapshot = NULL
```

## 順帶查出的既有弱點

**付費會員卡的 snapshot 也是前端自報的。** 前端送 `name` / `durationType` / `paidAmount` / `currency`，後端 `membershipTierSnapshotSchema` 只驗型別與長度，不跟範本重算——client 可以自稱租戶從未開出的等級名稱，或報一個租戶從未設定的價格。

這跟 2026-10-23 贈品卡決策「價格一律後端重算、不信 client」是同一條原則的兩次應用。贈品卡那次修好了贈品卡，會員卡這條路一直漏著。

**Layer 1 契約檔缺 validator。** `apps/backend/src/modules/pass-templates/schemas/request.ts` 檔頭宣稱 Layer 1 是 `packages/shared/schemas/passHolder.ts`，但 `membershipTierSnapshotSchema` 只存在後端；shared 套件只有 TypeScript interface 沒有 runtime validator，兩邊可以無聲漂移。本次把 schema 補進 shared 並讓後端引用。

## 過程中的三個實作陷阱

### 1. 編輯器切換付費 → 免費不清成本欄位

原本以為「免費卡的 tier 一定是 `durationType: null`」，實測不成立。store 的 `setHasExpiry(false)` 只清 `durationType`：

```ts
// CardBuilderEditor.store.ts::setHasExpiry
// false → clear durationType ONLY (preserve all cost fields)
membershipTiers: state.membershipTiers.map((tier) => ({
  ...tier,
  durationType: null,
})),
```

所以一張曾經是付費卡的免費卡，tier row 上還留著 `durationType: 'monthly'` 與 `monthlyCost: 200`。若 server 照抄 tier row，免費持有人會被記成「月付 200 元」——一個他們從未支付過的價格。

修法：`resolveMembershipTierSnapshot` 加明確的 `mode: 'paid' | 'free'` 參數，`'free'` 時 `durationType` 與 `paidAmount` 一律 null，與 tier row 殘留什麼無關。

### 2. `??` 對「強制清空」無效

免費卡要把 `payment_provider` 清成 undefined（`not_required` 不得搭配 provider），第一版寫成：

```ts
paymentProvider: tierPurchase?.paymentProvider ?? payload.paymentProvider,
```

`tierPurchase.paymentProvider` 正是 `undefined`，`??` 於是往右 fallback，把 client 的 `'ecpay'` 原樣放行——測試直接抓到。改成以 `paymentStatus` 為判斷鍵：

```ts
paymentProvider:
  tierPurchase?.paymentStatus === 'not_required'
    ? undefined
    : payload.paymentProvider,
```

教訓：**「強制清空某欄位」不能用 `??` 表達**，因為要清空的值本身就是 `undefined`。判斷鍵必須是另一個非空欄位。

### 3. `memberLevel: undefined` 仍然是「有這個 key」

`PassIssueHolderData` 加了 `memberLevel?: string` 後，service 傳 `memberLevel`（值為 undefined）進 `issuePass`。`v3-pass.ts` 裡的 `...(holder.memberLevel !== undefined ? {...} : {})` 讓 wire body 正確省略，但 service 端 `issuePass(..., { memberName, ..., memberLevel })` 這個物件**仍然帶著 `memberLevel` 這個 key**（值 undefined）。

測試用 `expect(holderArg).not.toHaveProperty('memberLevel')` 抓到了。修法是在 service 端也用條件展開：

```ts
...(memberLevel !== undefined ? { memberLevel } : {}),
```

`toHaveProperty` 檢查的是 key 存在性，不是值是否 undefined——這跟 `Object.keys()` 的語意有關，值得記。

## 4. 平行 session 的 `git checkout` 會吃掉未提交的變更

實作途中，repo 內**另一個 session** 為了 bisect 一個前端測試失敗，跑��：

```powershell
Move-Item packages/shared/logic/membershipTier.ts <temp>   # 把本次新增的檔案搬到 temp
git checkout HEAD -- apps/backend/.../request.ts apps/backend/.../registerService.ts ...
```

結果本次改到一半的 `registerService.ts` 被還原成 HEAD 版本（新增的 `deriveMembershipTierSnapshot` 消失），而 shared 套件的檔案因為不在 `git checkout` 的清單裡所以存活。

**後果**：改到一半的檔案被還原，需要重做。**緩解**：把本次工作切成小步、每步後立刻 `git status` 確認；跨多檔的改動盡早 commit（即使尚未完成）以降低被還原的範圍。

這不是本次功能的問題，是同一 repo 內多 session 平行工作的協作風險，值得記一筆。

## 驗證

- `packages/shared`：843 tests 通過（新增 `logic/membershipTier.test.ts` 25 條 + `schemas/passHolder.test.ts` 13 條）
- `apps/backend`：806 tests 通過（新增 `register.test.ts` 8 條 + `register.runtimeValues.test.ts` 2 條 + `v3-pass.test.ts` 3 條）
- `apps/frontend`：既有斷言更新（付費卡 payload 不再含 `membershipTierSnapshot`）
- `tsc --noEmit`：shared / backend / frontend 三個 workspace 全綠

## 教訓

1. **「fallback 到範本值」是掩蓋 bug 的遮羞布。** 上一版計畫察覺到免費卡沒有 snapshot，於是在簽發時 fallback 到範本第一個 tier 名稱——那看起來能出結果，但真正的問題（snapshot 從未被建立）被藏起來了。遇到「某個狀態缺資料」時，先問「這個資料為什麼會缺」，而不是「缺了之後怎麼補」。
2. **server-derived 是不變量的函數。** 快照的語意是「把租戶的設定凍結成收據」，那它的來源就必須是租戶的設定，不是 client 轉述的版本。
3. **「強制清空」與「條件省略」在 JS 裡是兩種不同的語意。** `undefined` 既是「沒有值」也是「有這個 key 但值是 undefined」——`??` 與 `toHaveProperty` 各看其中一面。
4. **同一 repo 內的平行 session 會互相踩。** `git checkout HEAD -- <paths>` 是破壞性的，未提交的工作會消失。切小步 + 勤 commit 是唯一的防線。
