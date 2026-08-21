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
|---|---|
| `templates.ts` | `TemplatesRow.expires_at` → 移除；`CreateTemplateInput.expiresAt` → 移除；所有 SQL RETURNING/SELECT → 移除 `expires_at` |
| `cardService.ts` | `toDto()` → 移除 `expiresAt` |
| `response.ts` | `TemplateDto.expiresAt` → 移除 |
| `packages/shared/schemas/card.ts` | `templateDtoSchema.expiresAt` → 移除 |

## 待辨事項

- [ ] Migration 006 尚未 apply（`supabase/migrations/20260821000001_006_add_templates_expires_at.sql`）
- [ ] Migration 006 apply 後，需要把 `expires_at` 加回所有相關程式碼（revert 這個繞過）
- [ ] 建議：將 migration apply 自動化，避免未來 drift

## 驗證

- [x] `GET /api/cards/drafts` → 200 ✅
- [x] `PATCH /api/cards/:id/abandon` → 200 ✅
- [x] `POST /api/cards` → 201 ✅

## 觸發條件

帳號已有 draft template → 點「從頭建置」→ 選擇「放棄草稿」

## 受影響的 API endpoints

| Endpoint | 之前 | 之後 |
|---|---|---|
| GET /api/cards/drafts | 500 (expired_at missing) | 200 ✅ |
| POST /api/cards | 正常 | 正常 |
| PATCH /api/cards/:id/abandon | 正常 | 正常 |
| GET /api/cards | 500 (expired_at missing) | ✅ |
| PUT /api/cards/:id | 500 (expired_at missing) | ✅ |
| PATCH /api/cards/:id/touch | 500 (expired_at missing) | ✅ |

## 預防措施

新增 migration 時：
1. 立即 apply 到 production（避免 drift）
2. 或在 migration 檔案加 TODO 標記，並在 pipeline 加 check
