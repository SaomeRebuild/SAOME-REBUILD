# Feedback：Migration Apply Pipeline（2026-08-22）

## 背景

Migration 006 (`expires_at` column + pg_cron job) 放在 `supabase/migrations/` 目錄，但從未 apply 到 production DB。同時 `apps/backend/src/modules/cards/db/templates.ts` 已經大量使用 `expires_at`。結果：所有 Card API 在 production 回 500。

## 根因

`supabase/migrations/` 是一個「有意義」的目錄（migration 放在這裡才會被 Supabase MCP `apply_migration` 認得），但沒有任何 CI/CD pipeline 確保 migration 跟 code 同步。

具體問題鏈：

```
1. Migration 檔案建立（dev machine）
   → supabase/migrations/20260821000001_006_add_templates_expires_at.sql

2. Code 實作（dev machine）
   → templates.ts 加入 expires_at SQL query

3. Commit & push code
   → Migration 檔案也進了 repo，但 CI 從不檢查 migration apply 狀態

4. Production 部署
   → Code 更新了，但 DB migration 從未 apply
   → templates.ts 的 SQL query 了不存在的欄位 → 500
```

## 修法

### 緊急繞過

從所有 SQL queries 和 DTO 移除 `expires_at` 依賴（已完成）。

### 待 revert

Migration apply 後，需把 `expires_at` 加回所有相關程式碼。

## 建議：Migration Apply Pipeline

### Option A：CI check（推薦）

在 GitHub Actions 的 `deploy-backend` job 前，加一個 step 確認 migration apply 狀態：

```yaml
- name: Check migration status
  run: |
    # 比較 migration 目錄與 DB 已 apply migration
    # 如果有未 apply 的 migration，fail build
```

或用 `supabase migration list` 對比。

### Option B：每個 migration require migration apply PR

每個新增 migration 的 PR，都必須同時附上 migration apply 的記錄（如 `ALTER TABLE ...` 直接在 PR description 說明已 apply 或將在哪些環境 apply）。

### Option C：Migration as Code

把 migration 變成 `apps/backend/src/db/migrations/` 並在 backend startup 時 auto-migrate（如 Prisma migrate 或 Drizzle migrate）。

但這對於 Supabase + Hyperdrive 架構可能不適用（migration 需要 Supabase MCP 執行）。

## 觀察

這次是 **CardBuilder feature** 的 migration。未來其他 feature 也會有 migration。如果不解決 pipeline 問題，每次都會遇到同樣的 drift。

## 影響

| 檔案 | 變動 |
|------|------|
| `supabase/migrations/20260821000001_006_add_templates_expires_at.sql` | Migration 最終 apply |
| `apps/backend/src/modules/cards/db/templates.ts` | 需在 migration apply 後 revert `expires_at` 繞過 |

## 自問

- **下次怎麼不犯？** 任何 migration 都必須在 CI pipeline 有 apply 檢查，沒有 apply 記錄的 migration 不準 merge。
- **哪個 test 該加？** `apps/backend/` 的 deployment smoke test，確保 migration apply 後 code 能正常運作。
