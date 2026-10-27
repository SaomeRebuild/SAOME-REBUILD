# Billing Cycle 計算與更新機制

- **日期**：2026-08-09
- **狀態**：**已實作** — Phase 1-4 完成（migration 005 + shared/backend schema + lazy update + cron endpoint）；Phase 5（前端 API contract 對接）已完成於 `usePassNotification.ts` 的 `pass.paidAt` 判讀
- **影響範圍**：`apps/backend/migrations/005_add_billing_columns.sql`、`packages/shared/schemas/auth.ts`、`apps/backend/src/modules/pass/`、`apps/frontend/src/components/business/dashboard/PassNotification/`

> 詳見 Decision Log：runs/decisions/2026-08-09-billing-cycle-hybrid.md

## 背景

在 passes table 上做 billing 週期計算，需處理：
1. 計算起點：從付費日（`paid_at`）起算，還是固定日曆月？
2. 更新機制：billing cycle 遞進由誰觸發？Hybrid（lazy update + cron）
3. 續期提醒 / 試用期提醒 mail 的觸發條件

---

## Phase 1：DB Migration

### Task 1.1：建立 005_add_billing_columns.sql

檔案路徑：apps/backend/migrations/005_add_billing_columns.sql

```sql
ALTER TABLE public.passes
  ADD COLUMN paid_at timestamptz NULL,
  ADD COLUMN billing_cycle_end timestamptz NULL;
```

### Task 1.2：透過 Supabase MCP apply migration

supabase apply_migration

### Task 1.3：確認 production schema

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'passes'
ORDER BY ordinal_position;
```

---

## Phase 2：Backend ↔ Shared Schema

### Task 2.1：更新 packages/shared/schemas/

把欄位加到 packages/shared/schemas/pass.ts（唯一的契約來源）：passSchema 新增兩個 optional 欄位：
paid_at, billing_cycle_end（datetime, optional）

### Task 2.2：更新 apps/backend/src/modules/passes/schemas/

Backend 的 request.ts / response.ts 也要同步更新，
遵守 019-schema-contract-drift.mdc 的四層同步 + conformance test 要求

---

## Phase 3：Backend ↔ Lazy Update Logic

### Task 3.1：新增 apps/backend/src/modules/passes/db/pass.ts

### Task 3.2：在 getPassService 加入 lazy update

### Task 3.3：Unit test for lazy update

---

## Phase 4：Backend ↔ Cron Endpoint

### Task 4.1：新增 cron route：GET /api/cron/billing-cycle

### Task 4.2：建立 advanceAllExpiredCycles service

### Task 4.3：wrangler.jsonc 註冊 cron（每日 UTC 00:00 觸發）

### Task 4.4：Local 測試 cron endpoint

---

## Phase 5：Frontend ↔ API Contract（未來）

---

## 驗收標準

| 項目 | 驗證方式 | 預期結果 |
|---|---|---|
| Migration applied | MCP apply_migration | list_migrations 見 005 |
| Schema correct | execute_sql passes columns | 10 columns |
| Lazy update logic | Unit test | pass |
| Cron endpoint | curl localhost:8787/api/cron/billing-cycle | { updated: N } |
| Conformance test | npm run test | 全綠 |

---

## 依賴關係

Phase 1 (Migration)
  └──→ Phase 2 (Schema)
        └──→ Phase 3 (Lazy update service + test)
        └──→ Phase 4 (Cron endpoint + test)
              └──→ Phase 5 (API contract 對接)

---

Refs: runs/decisions/2026-08-09-billing-cycle-hybrid.md
