# 2026-08-22 draft abandon→create 500 Bug

## 事故症狀

用戶點「從頭建置」時，如果已有 draft → 選擇「放棄」→ 失敗：
`SaomeApiError: API error`

## 根因分析

### 技術根因

`findLatestDraftByTenant` (GET /api/cards/drafts) 的 SQL query 了 `expires_at` 欄位：

```sql
SELECT id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
  FROM templates
 WHERE tenant_id = $1 AND status = 'draft'
 ORDER BY updated_at DESC LIMIT 1
```

但 `supabase/migrations/20260821000001_006_add_templates_expires_at.sql`（Migration 006，新增 `expires_at` 欄位）尚未 apply 到 production DB，導致 `SELECT expires_at` 失敗，回 500 Internal Server Error。

### Schema drift 原因

Migration 006 的 `expires_at` 欄位定義在 `supabase/migrations/` 但從未 apply 到 production。同時 `apps/backend/src/modules/cards/db/templates.ts` 已經大量使用 `expires_at`，這些變更未被及時 apply。

## 修復

從所有 SQL queries 和 DTO 移除 `expires_at` 依賴（作為繞過，直到 migration 完成）：

| 檔案 | 變動 |
|------|------|
| `templates.ts` | `TemplatesRow.expires_at` → 移除；`CreateTemplateInput.expiresAt` → 移除；所有 SQL RETURNING/SELECT → 移除 `expires_at` |
| `cardService.ts` | `toDto()` → 移除 `expiresAt` |
| `response.ts` | `TemplateDto.expiresAt` → 移除 |
| `packages/shared/schemas/card.ts` | `templateDtoSchema.expiresAt` → 移除 |

### Migration 已 apply

Migration 006 已手動 apply 到 production DB。`expires_at` 欄位現在存在。

### 待 revert 繞過

Migration apply 後，需把 `expires_at` 加回所有相關程式碼（目前的繞過 state）。

## 變更：Abandon 從 UPDATE 改為 DELETE

### 變更背景

原本「放棄草稿」的實作是 `UPDATE status='abandoned'`（留 record）。討論後改為直接 `DELETE row`，因為「放棄草稿」不需要留 record。

### 實作變更

- `PATCH /api/cards/:id/abandon` route → **已移除**
- Frontend `handleAbandonDraft` → 改為 `DELETE /api/cards/:id`
- 刪除後清除 local state 並重新抓 draft list

### pg_cron 不受影響驗證

pg_cron 清理條件：

```sql
DELETE FROM public.templates
 WHERE status = 'draft'
   AND expires_at IS NOT NULL
   AND expires_at < now()
```

Abandon 後 ROW 已經刪除，不會被 pg_cron 影響。✅

## 驗證

| Endpoint | 之前 | 之後 |
|----------|-------|------|
| GET /api/cards/drafts | 500 (`expires_at` missing) | 200 ✅ |
| POST /api/cards | 正常 | 正常 |
| DELETE /api/cards/:id | — | 200 ✅ |
| GET /api/cards | 500 (`expires_at` missing) | 200 ✅ |
| PUT /api/cards/:id | 500 (`expires_at` missing) | 200 ✅ |
| PATCH /api/cards/:id/touch | 500 (`expires_at` missing) | 200 ✅ |

## 觸發條件

帳號已有 draft template → 點「從頭建置」→ 選擇「放棄草稿」

## 預防措施

1. **Migration apply pipeline**：每個 `supabase/migrations/` 的 migration 都需要 pipeline apply step，或加 CI check 確保 migration 狀態與 code 一致
2. **立即 apply**：新增 migration 後立即 apply 到 production（避免 drift）
3. **Code review**：任何 `expires_at` 相關 SQL 的 PR 需要有 migration apply 記錄

## 衍生

詳見 `DEV/08-2026/0822-card-builder-draft-abandon-full-trace.md` 完整事件鏈。
