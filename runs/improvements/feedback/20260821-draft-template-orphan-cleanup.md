# Feedback: 卡片草稿定時清理（2026-08-21）

## 任務背景

SAOME `templates` 表累積大量未發布的孤兒草稿（使用者開了編輯器但從未存檔或發布），佔用 DB 空間。需要新增 24 小時 TTL 機制，讓未編輯的草稿自動被 pg_cron 清理。

## 實作摘要

### Migration（`supabase/migrations/20260821000001_006_add_templates_expires_at.sql`）

- 新增 `expires_at TIMESTAMPTZ NULL` 欄位
- 建立 `idx_templates_expires_at` partial index（`WHERE expires_at IS NOT NULL`）
- 啟用 `pg_cron` extension 並 schedule 每小時執行 `DELETE FROM public.templates WHERE status = 'draft' AND expires_at IS NOT NULL AND expires_at < now()`

### Migration（`supabase/migrations/20260821000002_007_nullable_card_type.sql`）

- `templates.card_type` 從 NOT NULL 改為 nullable
- CHECK constraint 更新為允許 NULL：`CHECK (card_type IS NULL OR card_type = ANY (ARRAY[...]))`
- 目的：區分「使用者從未選擇卡種的 orphan draft」與「正常草稿」，analytics 可用 `WHERE card_type IS NOT NULL` 過濾

### Backend Changes

| 檔案 | 變更 |
|------|------|
| `apps/backend/src/modules/cards/db/templates.ts` | `TemplatesRow` + `expires_at?`，`CreateTemplateInput` + `expiresAt?`，`insertTemplate` auto-set `expires_at = now() + 24h`，`updateTemplate` publish 時 auto-clear `expires_at`，新增 `touchExpiresAt()` |
| `apps/backend/src/modules/cards/services/cardService.ts` | `toDto()` 含 `expiresAt`，`createTemplateService` 參數 `cardType: string | undefined`，新增 `touchTemplateService()` |
| `apps/backend/src/modules/cards/schemas/response.ts` | `TemplateDto.cardType` → optional |
| `apps/backend/src/modules/cards/schemas/request.ts` | `createTemplateSchema.cardType` → optional（**hotfix for schema drift**） |
| `packages/shared/schemas/card.ts` | `createTemplateSchema.cardType` + `templateDtoSchema.cardType` → optional |
| `apps/backend/src/modules/cards/routes/touch.ts` | 新檔案：`PATCH /api/cards/:id/touch` |
| `apps/backend/src/modules/cards/index.ts` | 掛載 `touchCardRoute` |

### Frontend Changes

| 檔案 | 變更 |
|------|------|
| `apps/frontend/src/pages/app/dashboard/card-builder/CardBuilderPage.tsx` | `handleBuildFromScratch` 移除 `cardType: 'stamp_card'` 預設值（讓新草稿 card_type = NULL） |
| `apps/frontend/src/config/api.ts` | `cardTouch(id)` path helper |
| `apps/frontend/src/services/httpClient.ts` | 新增 `.patch()` method |
| `apps/frontend/src/services/cardService.ts` | 新增 `touch(id)` 方法 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx` | 新增 `touch()` auto-save keep-alive（mount 時立即一次 + 每 5 分鐘一次） |

### TTL 機制邏輯

```
新建草稿（從頭建置）
  → createTemplate(cardType=undefined)
  → DB: card_type=NULL, expires_at=now()+24h

使用者正常編輯
  → 每 5 分鐘 auto-save
  → cardService.touch()
  → DB: expires_at 重置為 now()+24h

使用者發布卡片
  → updateTemplate(status='published')
  → DB: expires_at = NULL（永不过期）

pg_cron 每小時執行
  → DELETE WHERE status='draft' AND expires_at IS NOT NULL AND expires_at < now()
  → orphan draft 自動清理
```

## 驗證流程（手動）

```sql
-- 1. 確認 cron job 存在
SELECT * FROM cron.job WHERE jobname = 'cleanup_expired_draft_templates';

-- 2. 確認既有草稿已有正確 TTL
SELECT id, card_type, expires_at::text, expires_at - created_at AS ttl
FROM public.templates WHERE status = 'draft' ORDER BY created_at DESC LIMIT 5;

-- 3. 新草稿 card_type 為 NULL（orphan）
SELECT id, card_type, name FROM public.templates WHERE card_type IS NULL;
```

驗證結果（新草稿已正確建立）：

```
id: 6be1e06a..., card_type: NULL, expires_at: 2026-08-22 03:42:40+00  ✅
id: e2f8b804..., card_type: NULL, expires_at: 2026-08-22 03:41:35+00  ✅
```

## 過程紀錄：Schema Drift Bug（2026-08-21 11:39）

### 觸發

Step 1 完成後（`card_type` 改 nullable），使用者回報「建立卡片失敗：Validation failed」。

### 根因分析

| 層 | 檔案 | 同步狀態 |
|----|------|---------|
| Shared | `packages/shared/schemas/card.ts` | ✅ `cardTypeSchema.optional()` |
| Backend request | `apps/backend/src/modules/cards/schemas/request.ts` | ❌ **漏了** — 仍是 `cardTypeSchema` (required) |
| Backend service | `apps/backend/src/modules/cards/services/cardService.ts` | ❌ 參數仍是 `string` (required) |
| Frontend | `CardBuilderPage.tsx` | ✅ 已移除預設值 |

`schemas/request.ts` 是 `shared/schemas/card.ts` 的手動副本，每次 shared schema 改動時容易 drift。

### 修復

```diff
// apps/backend/src/modules/cards/schemas/request.ts
- cardType: cardTypeSchema,
+ cardType: cardTypeSchema.optional(),

// apps/backend/src/modules/cards/services/cardService.ts
- cardType: string,
+ cardType: string | undefined,
```

### 預防

這正是 rule `019-schema-contract-drift.mdc` 要防止的問題。

長遠方案：backend `schemas/request.ts` 應從 `@saome/shared/schemas/card` import，而非各自維護副本。

## 觀察與衍生問題

1. **TTL 時長**：目前 24 小時。太短：編輯中途中斷會被清；太長：孤兒草稿佔用空間更久
2. **Touch 頻率**：目前每 5 分鐘一次（mount 時立即一次），API call 增加
3. **Migration apply 方式**：目前用 Supabase MCP `apply_migration`。Production 需要 CI/CD pipeline 自動化
4. **pg_cron schedule**：目前是每小時（`0 * * * *`），覆寫了原本 plan 的每日凌晨 3 點

## 未來優化方向

- 考慮加 `last_touched_at` 欄位（區分 `updated_at` 與主動 touch），方便 DEBUG
- 考慮在 template list API 回傳 `ttlRemaining`（`expires_at - now()`），讓前端顯示「草稿將於 X 小時後過期」
- 考慮加 cleanup notification（在草稿快過期前發 email 提醒使用者）
- 考慮調整 pg_cron schedule 為每日一次（節省資源）

## 同步狀態

- 本地 commit: `ce1862d` (hotfix: request.ts schema drift)
- Remote sync: `https://github.com/SaomeRebuild/SAOME-REBUILD/commit/ce1862d`
