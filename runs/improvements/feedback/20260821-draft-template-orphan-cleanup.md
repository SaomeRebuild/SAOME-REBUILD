# Feedback: 卡片草稿定時清理（2026-08-21）

## 任務背景

SAOME `templates` 表累積大量未發布的孤兒草稿（使用者開了編輯器但從未存檔或發布），佔用 DB 空間。需要新增 24 小時 TTL 機制，讓未編輯的草稿自動被 pg_cron 清理。

## 實作摘要

### Migration（`supabase/migrations/20260821000001_006_add_templates_expires_at.sql`）

- 新增 `expires_at TIMESTAMPTZ NULL` 欄位
- 建立 `idx_templates_expires_at` partial index（`WHERE expires_at IS NOT NULL`）
- 啟用 `pg_cron` extension 並 schedule 每小時執行 `DELETE FROM public.templates WHERE status = 'draft' AND expires_at IS NOT NULL AND expires_at < now()`

### Backend Changes

| 檔案 | 變更 |
|------|------|
| `apps/backend/src/modules/cards/db/templates.ts` | `TemplatesRow` + `expires_at?`，`CreateTemplateInput` + `expiresAt?`，`insertTemplate` auto-set `expires_at = now() + 24h`，`updateTemplate` publish 時 auto-clear `expires_at`，新增 `touchExpiresAt()` |
| `apps/backend/src/modules/cards/services/cardService.ts` | `toDto()` 含 `expiresAt`，新增 `touchTemplateService()` |
| `apps/backend/src/modules/cards/schemas/response.ts` | `TemplateDto` + `expiresAt?` |
| `packages/shared/schemas/card.ts` | `templateDtoSchema` + `expiresAt` |
| `apps/backend/src/modules/cards/routes/touch.ts` | 新檔案：`PATCH /api/cards/:id/touch` |
| `apps/backend/src/modules/cards/index.ts` | 掛載 `touchCardRoute` |

### Frontend Changes

| 檔案 | 變更 |
|------|------|
| `apps/frontend/src/config/api.ts` | `cardTouch(id)` path helper |
| `apps/frontend/src/services/httpClient.ts` | 新增 `.patch()` method |
| `apps/frontend/src/services/cardService.ts` | 新增 `touch(id)` 方法 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx` | 新增 `touch()` auto-save keep-alive（每 5 分鐘一次） |

### TTL 機制邏輯

```
新建草稿 → insertTemplate → expires_at = now() + 24h
使用者正常編輯 → 每 5 分鐘 auto-save → cardService.touch() → expires_at 重置為 now() + 24h
使用者發布卡片 → updateTemplate(status='published') → expires_at = NULL
pg_cron 每小時 → DELETE WHERE status='draft' AND expires_at < now() → 孤兒草稿自動清理
```

## 驗證流程（手動）

```sql
-- 1. 確認 cron job 存在
SELECT * FROM cron.job WHERE jobname = 'cleanup_expired_draft_templates';

-- 2. 手動跑一次 DELETE 模擬 cron 行為
DELETE FROM public.templates WHERE status = 'draft' AND expires_at < now();

-- 3. 建立測試草稿驗證 TTL 正確
SELECT id, created_at, expires_at, expires_at - created_at AS ttl
FROM public.templates WHERE status = 'draft' ORDER BY created_at DESC LIMIT 5;
```

## 觀察與衍生問題

1. **TTL 多久**：目前設定 24 小時。是否需要調整？（太短：使用者編輯中途中斷會被清；太長：孤兒草稿佔用空間更久）
2. **Migration _apply_ 方式**：目前用 Supabase MCP `apply_migration` 工具。Production deploy 需要 CI/CD pipeline 自動化。
3. **Touch 頻率**：目前每 5 分鐘一次。是否太頻繁？（API call 增加；太長：使用者編輯途中被清了都不知道）

## 未來優化方向

- 考慮加 `last_touched_at` 欄位（區分 `updated_at` 與主動 touch），方便 DEBUG
- 考慮在 template list API 回傳 `ttlRemaining`（`expires_at - now()`），讓前端顯示「草稿將於 X 小時後過期」
- 考慮加 cleanup notification（在草稿快過期前發 email 提醒使用者）

## 同步狀態

- 本地 commit: `TBD`
- Remote sync: `TBD`
