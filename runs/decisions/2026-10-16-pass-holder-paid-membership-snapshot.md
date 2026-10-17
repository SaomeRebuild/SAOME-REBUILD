# Decision：Pass-holder 付費會員卡 — 擴充 `pass_holders` 欄位（paid-membership snapshot）

**日期**：2026-10-16
**作者**：SAOME-REBUILD
**Scope**：L2 Standard（純前端 feature + 1 個 DB migration，後端真正 endpoint 落地 deferred 至 next session PR）

---

## 背景

`/pass/{templateId}` 公開頁目前只收集 4 個 pass-delivery 欄位（name / phone / birthday / email），用於 wallet card end-user（Pass Holder）。**當模板是付費會員卡（`isPaid: true`）時**，user 應可在同一頁：

1. 看到租戶設計的會員方案（`membershipTiers[]`，每個 tier 帶 `name` / `rewards` / `monthlyCost` / `yearlyCost` / `durationType`）
2. 選擇方案（Radio Card）
3. 模擬付費（依 `template.currency` 顯示 Payfast logo（ZAR）或 Ecpay logo（TWD），點擊按鈕 1.5s 切換到「已付款」視覺）
4. 解鎖 Submit；Submit 端把 `selectedTierIndex` + `membershipTierSnapshot` + `paymentProvider` + `paymentStatus` + `paidAmount` 一起送出

目前 `public.pass_holders` table 沒有任何欄位能存這些 payment-snapshot 資料（migration 019 只有 4 個 pass-delivery 欄位 + `created_at` / `updated_at` / UNIQUE constraint）。前端 `PublicPassTemplate` 型別也沒有 `isPaid` / `membershipTiers` / `currency`。

需要做的決定：**這些欄位要存在哪裡、怎麼存**。

---

## 選項與決定

### 候選 A — 擴充 `pass_holders`（決定 ✅）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `selected_tier_index` | `INTEGER` | nullable | 0-based index 對應 `template.membershipTiers[]` |
| `membership_tier_snapshot` | `JSONB` | nullable | 註冊當下的 tier 快照（name / durationType / paidAmount / currency）— 防範日後 tier 內容被改時回查失真 |
| `payment_provider` | `TEXT` CHECK IN ('payfast', 'ecpay') | nullable | 真實金流串接前一律 mock，欄位保留 |
| `payment_status` | `TEXT` CHECK IN ('pending', 'completed', 'failed') DEFAULT 'pending' | NOT NULL | mock 階段只有 `'completed'`，預留 `failed` 給未來 |
| `paid_amount` | `NUMERIC(10, 2)` | nullable | 對應 monthlyCost / yearlyCost |
| `currency` | `TEXT` CHECK IN ('TWD', 'ZAR') | nullable | 跟 template currency 對齊；backfill 現有 row 為 TWD |

**優點**：
- 一個 row 一個 transaction — 沒有跨表 join，register flow 是 atomic
- 查詢簡單：dashboard 看「付費會員註冊列表」直接 `SELECT * WHERE payment_status = 'completed'`
- 對現有 migration 019 破壞最小（ADD COLUMN nullable + CHECK）

**缺點**：
- 當 refund / partial refund 需求進來時，會在 pass_holders 累積一堆 `refund_*` 欄位（→ next session 重構）
- 沒有獨立 `payments` 表的事件流（每筆 payment 就是 pass_holders 的一個 row，沒有 audit log）

### 候選 B — 新增獨立 `public.payments` 表

```sql
CREATE TABLE public.payments (
  id UUID PRIMARY KEY,
  pass_holder_id UUID REFERENCES public.pass_holders(id),
  provider TEXT, status TEXT, amount NUMERIC, currency TEXT,
  tier_snapshot JSONB,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);
```

**優點**：
- 完整的 payment event log（多筆 payment → 一個 pass_holder）
- 重構 refund / partial refund / subscription renewal 不動 `pass_holders`

**缺點**：
- 註冊流程變成 2 個 table write（transaction 複雜度 ↑）
- mock 階段沒有真實金流，獨立表是 over-engineer
- 未來真實金流整合時，`payments` 表 schema 還會再改一次（e.g. 加上 `external_transaction_id`），提早建表浪費

### 候選 C — 單一 JSONB `pass_holder_payment_snapshot` 欄位

把整個 payment snapshot 塞進一個 JSONB 欄位（含 provider / status / amount / tier_snapshot）。

**優點**：
- 最低 schema 變更（1 個欄位）
- 彈性最高（將來加欄位不用 migration）

**缺點**：
- 沒辦法用 SQL CHECK constraint 驗 `payment_provider` enum
- 沒辦法用 SQL INDEX on `payment_status`（dashboard 查詢慢）
- 違反 Rule 019 § 1「DB 結構必對應 zod schema」精神 — query 時反序列化成本高

### 決定

**A — 擴充 `pass_holders` 6 個欄位**（user 已於 plan 階段確認）

理由：

- 對 user 而言「選擇方案 + 模擬付款 → 註冊」是一個 atomic 流程，沒有 partial refund / 多次付款的當前需求
- 6 個欄位（含 CHECK constraints）讓 SQL query / dashboard 顯示都直接
- mock 階段 schema 演進成本最低，後端真正 endpoint 落地時直接 INSERT 這 6 個欄位
- 當 future refund 需求進來時，再開 Decision Log 重評遷移到候選 B

---

## 影響

| 範圍 | 影響 |
|---|---|
| `supabase/migrations/20261016000001_023_add_pass_holder_payment_fields.sql` | 新增 ALTER TABLE，加 6 個欄位 + CHECK constraints + defensive backfill（既有 row currency → TWD）|
| `supabase/migrations/.applied-migrations.json` | append entry via MCP（Rule 035 § 1-7）|
| `packages/shared/types/passHolder.ts` | 擴充 `PublicPassTemplate`（加 `currency?` / `isPaid?` / `membershipTiers?`）+ 新增 `PublicMembershipTier` + `MembershipTierSnapshot` + `PassHolderPayload` 4 個 optional field |
| `apps/frontend/src/i18n/locales/passHolder.{zh-TW,en}.ts` | 新增 `membership.*` 區塊（Radio Card 標題 / Pay button label / 3 段 payment state 文案 / 免費 / per-month / per-year / rewards label）|
| `apps/frontend/src/components/business/pass/PassHolderRegistration/` | 新增 `PassHolderMembershipTiers/` 資料夾（主組件 + Radio Card sub + Payment Button sub + tests + stories）；主組件 `PassHolderRegistration.tsx` 整合 tier selection state + payment state + submit 鎖定 |
| `apps/frontend/src/services/passHolderService.ts` | `demo-gym` 加 `isPaid: true` + `currency: 'TWD'` + 2 個 tier（跟 user 提供的 1:1 對齊）；新增 `demo-gym-zar`（ZAR + Payfast）|
| `apps/backend/src/modules/pass-templates/` | **本 PR 不動**（deferred — 真正 endpoint 落地等 next session）|
| Rule 019 § 4.1 | 本 PR 只動第一層（shared types）；後續 backend PR 必補第二三四層，commit footer 標示「`deferred: backend mirror, see decision log 2026-10-16`」|

### Future Reconsideration Trigger

**當以下任一條件成立時，重新開 Decision Log 重評**：

| Trigger | 觀察方式 |
|---|---|
| 出現 refund / partial refund 需求 | 新增 `refunds` table 或 `payment_refunded_at` column |
| 同一個 pass_holder 出現多筆 payment（subscription renewal）| `pass_holders` row 出現 `payment_count > 1` |
| 出現 SaaS billing 需求（recurring charge）| 新增 `subscriptions` table 計畫 |
| 真的金流整合（Payfast / Ecpay API）| 新增 `external_transaction_id` / `webhook_event_id` 欄位 |

---

## 計畫 Steps（reference）

| # | Step | 必跑 rule |
|---|---|---|
| 1 | **本 Decision Log** | Rule 001 § Decision Log |
| 2 | Migration `20261016000001_023_add_pass_holder_payment_fields.sql` + `apply_migration` + append `.applied-migrations.json` | Rule 035 |
| 3 | `packages/shared/types/passHolder.ts` 擴充 | Rule 019 § 4.1 第一層 |
| 4 | i18n `passHolder.{zh-TW,en}.ts` 擴充 `membership.*` 區塊 | Rule 023 / 025 |
| 5 | `PassHolderMembershipTiers/` 資料夾（TDD）| Rule 000 § A.1 + 003 TDD |
| 6 | `PassHolderRegistration.tsx` 接線 + submit 鎖定 | Rule 000 § A.2（≤ 100 行） |
| 7 | `passHolderService.ts` mock 擴充 + test 擴充 | Rule 003 TDD |
| 8 | 完工驗證（typecheck / lint / test / i18n / build / check-migrations）| Rule 006 |
| 9 | DEV LOG + feedback + runs/improvements/INDEX.md 同步 | Rule 011 |
| 10 | (Deferred) Backend endpoint 落地 | Rule 019 § 4.1 二三四層 + 027 + 032 |
