# Decision：`payment_status` 加 `'not_required'` 第 4 個 enum 值

## 背景

2026-10-18 SAOME-REBUILD 用戶回報：他在 stamp card 公開頁填完 4 個欄位、按下「Get Pass」、註冊成功，但後台 `public.pass_holders` 那筆 row 的 `payment_status` 一直是 `'pending'`、`payment_provider` / `paid_amount` / `currency` / `selected_tier_index` / `membership_tier_snapshot` 全部 `NULL`。

使用者問題：「這是一張 stamp 卡，本來就不需要付費下載，這樣合理嗎？」

### 根因

`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.helpers.ts::resolvePaymentFields` 對所有非 paid template 一律回傳 `{ paymentStatus: 'pending' }`：

```ts
export function resolvePaymentFields(state, currency) {
  if (state !== 'paid') {
    return { paymentStatus: 'pending' };   // ← stamp cards 永遠落這裡
  }
  return { paymentProvider, paymentStatus: 'completed' };
}
```

而 `supabase/migrations/20261016000001_023_add_pass_holder_payment_fields.sql` 把 `payment_status` 設成：

```sql
payment_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'completed', 'failed'))
```

所以這個 column 同時承載了兩種完全不同的語意：
1. **付費 template、等待真實 gateway callback**（合理）
2. **非付費 template、根本沒有付款概念**（這張 stamp card 的情況）

後果是任何「找出所有未完成付款的 holder」的 production query 都會把 stamp card / free reward / free cashback / free coupon / free multipass / free gift / free membership 全部撈出來當 false positive。

## 選項

### 候選 A — 維持現狀，文件加註解

- 0 改動
- DB 語意混雜，query 受限（永遠要在 WHERE 多加 `template.isPaid = true` 過濾）

### 候選 B — DB CHECK 加 `'not_required'` 第 4 值；前端 helper 改送這個值；backend zod 加 cross-field refine

- 1 個 migration（CHECK constraint drop + recreate）
- 1 行 frontend helper 改動
- 1 個 zod cross-field refinement
- conformance tests（backend x3 + frontend x1）
- 影響範圍小，CHECK 擴展不需 data backfill

### 候選 C — DB migration 把 `payment_status` 改 nullable；前端 omit 整個欄位

- 1 個 migration（NOT NULL → NULL）
- 1 個 frontend helper 改動
- backend zod 加 refinement
- 但失去「付費中」這個語意（變成「有值=有付款事件 / 沒值=沒付款事件」，付費中的暫態概念丟失）
- NOT NULL→NULL migration 在 production 已有 rows 雖然容易，但要重新審視所有「IS NULL 當 false 處理」的查詢邏輯

## 決定

**候選 B** — DB 加 `'not_required'` enum 值 + 前端 helper 改送 + backend zod cross-field refine（per user AskQuestion「direction=B_full_fix」）。

理由：
1. 維持 `NOT NULL DEFAULT 'pending'` 約束，避免「欄位沒值」這種模糊情況。
2. CHECK constraint 擴展（drop + recreate）比改 NOT NULL→NULL 安全，production 既有 row 不用動。
3. 前端 helper 改一行就解決（`{ paymentStatus: 'pending' }` → `{ paymentStatus: 'not_required' }`）。
4. 之後 production query 可以清楚區分「真正 pending 付款中」vs「不需付款」vs「已完成付款」。
5. backend cross-field refine 提供一層安全網：未來即使前端送錯組合（`completed` 沒 provider 或 `not_required` 帶 provider），backend 會在 zod parse 階段拒絕，不會讓不一致狀態寫進 DB。

### 影響範圍

| 影響 | 對象 |
|---|---|
| Backend | `apps/backend/src/modules/pass-templates/schemas/request.ts` — `passHolderPaymentStatusSchema` 加 `'not_required'`，`passHolderRegisterPayloadSchema` 加 `.superRefine` |
| Shared | `packages/shared/types/passHolder.ts` — `PassHolderPayload.paymentStatus` union 加 `'not_required'` |
| Frontend | `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.helpers.ts::resolvePaymentFields` — 非 paid 分支回傳 `'not_required'` |
| Migration | `supabase/migrations/20261018000001_024_add_not_required_payment_status.sql`（NEW）— DROP + ADD CHECK constraint |
| Tests | `apps/backend/src/modules/pass-templates/tests/register.test.ts` — +3 條 cross-field refine conformance test<br>`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx` — 更新既有 assertion + 新增 1 條 `'not_required'` conformance test |

### Legacy data（out of scope）

**已 commit 的 `'pending'` rows（migration 023 之後新增）** 不會自動 backfill。理由：
- 區分「真的 pending」vs「fake pending」需要 join `templates.settings->>'isPaid'`，且 production 資料量未知。
- Backfill 是破壞性變更（會改既有 row 的值），應單獨 commit + 跑維運審視。

這部分 deferred 到 follow-up。如果 product 之後要 backfill，可以跑：

```sql
UPDATE public.pass_holders ph
   SET payment_status = 'not_required'
  FROM public.templates t
 WHERE ph.template_id = t.id
   AND ph.payment_status = 'pending'
   AND ph.payment_provider IS NULL
   AND COALESCE((t.settings->>'isPaid')::boolean, false) = false
   AND COALESCE(jsonb_array_length(t.settings->'membershipTiers'), 0) = 0;
```

（schema-conformance test 也建議加：query 出所有 `payment_status = 'pending'` 且 `payment_provider IS NULL` 的 row，數量應隨 backfill 遞減。）

### Out of scope

- 真實 Payfast / Ecpay SDK 整合（P3 from 2026-10-16 feedback）
- 將 `isPaidTemplate` boolean 重構成 discriminated union
- Legacy rows backfill（見上）