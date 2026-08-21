# CardBuilder 草稿 TTL 定時清理

## Metadata

- **日期**：2026-08-21
- **作者**：cursor-agent
- **觸發規則 / skill**：`000-modular-design.mdc`（DB migration + backend TTL 實作）、`saome-dev-logging` skill

## 背景

SAOME `templates` 表累積大量未發布的孤兒草稿（使用者開了編輯器但從未存檔或發布），佔用 DB 空間。需要新增 24 小時 TTL 機制，讓未編輯的草稿自動被 `pg_cron` 清理。

## 實作決策

### 1. 草稿生命週期設計

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

### 2. `card_type` 改 nullable 的原因

區分「使用者從未選擇卡種的 orphan draft」與「正常草稿」：
- `card_type = NULL`：使用者從未選擇卡種，視為 orphan
- `card_type = 'stamp_card'`：正常草稿

Analytics 可用 `WHERE card_type IS NOT NULL` 過濾有意義的草稿。

## Migration

### `supabase/migrations/20260821000001_006_add_templates_expires_at.sql`

```sql
-- 新增 expires_at 欄位
ALTER TABLE public.templates ADD COLUMN expires_at TIMESTAMPTZ NULL;

-- Partial index（只索引有值的列，省空間）
CREATE INDEX idx_templates_expires_at ON public.templates (expires_at)
  WHERE expires_at IS NOT NULL;

-- 啟用 pg_cron 並 schedule 每小時執行
SELECT cron.schedule(
  'cleanup_expired_draft_templates',
  '0 * * * *',
  $$DELETE FROM public.templates WHERE status = 'draft' AND expires_at IS NOT NULL AND expires_at < now()$$
);
```

### `supabase/migrations/20260821000002_007_nullable_card_type.sql`

```sql
-- card_type 從 NOT NULL 改 nullable
ALTER TABLE public.templates ALTER COLUMN card_type DROP NOT NULL;

-- CHECK constraint 更新為允許 NULL
ALTER TABLE public.templates DROP CONSTRAINT templates_card_type_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_card_type_check
  CHECK (card_type IS NULL OR card_type = ANY (ARRAY['stamp_card', 'cashback_card', 'reward_card', 'membership_card', 'discount_card', 'coupon_card', 'multipass', 'gift_card']));
```

## Backend Changes

### `apps/backend/src/modules/cards/db/templates.ts`

- `TemplatesRow` + `expires_at?`
- `CreateTemplateInput` + `expiresAt?`
- `insertTemplate` auto-set `expires_at = now() + 24h`
- `updateTemplate` publish 時 auto-clear `expires_at`（`status = 'published'` → `expires_at = NULL`）
- 新增 `touchExpiresAt()` — reset `expires_at = now() + 24h`

### `apps/backend/src/modules/cards/routes/touch.ts`

新檔案：`PATCH /api/cards/:id/touch` — 讓前端 keep-alive

```typescript
export const touchCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .patch('/:id/touch', async (c) => {
    const templateId = c.req.param('id');
    const sql = getDb(c.env.HYPERDRIVE);
    const result = await touchExpiresAt(sql, templateId);
    return c.json({ template: toDto(result) });
  });
```

## Frontend Changes

### `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx`

```typescript
// mount 時立即一次 + 每 5 分鐘一次
useEffect(() => {
  if (!cardId) return;
  touch(); // mount 時立即
  const interval = setInterval(touch, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [cardId]);
```

### `apps/frontend/src/pages/app/dashboard/card-builder/CardBuilderPage.tsx`

`handleBuildFromScratch` 移除 `cardType: 'stamp_card'` 預設值，讓新草稿 `card_type = NULL`。

## Schema Drift Bug（2026-08-21 11:39）

### 觸發

Step 1 完成後（`card_type` 改 nullable），使用者回報「建立卡片失敗：Validation failed」。

### 根因

| 層 | 檔案 | 同步狀態 |
|----|------|---------|
| Shared | `packages/shared/schemas/card.ts` | ✅ `cardTypeSchema.optional()` |
| Backend request | `apps/backend/src/modules/cards/schemas/request.ts` | ❌ **漏了** — 仍是 `cardTypeSchema` (required) |
| Backend service | `apps/backend/src/modules/cards/services/cardService.ts` | ❌ 參數仍是 `string` (required) |
| Frontend | `CardBuilderPage.tsx` | ✅ 已移除預設值 |

### 修復

```diff
// apps/backend/src/modules/cards/schemas/request.ts
- cardType: cardTypeSchema,
+ cardType: cardTypeSchema.optional(),

// apps/backend/src/modules/cards/services/cardService.ts
- cardType: string,
+ cardType: string | undefined,
```

## 驗證

### 手動 SQL

```sql
-- 確認 cron job 存在
SELECT * FROM cron.job WHERE jobname = 'cleanup_expired_draft_templates';

-- 確認既有草稿已有正確 TTL
SELECT id, card_type, expires_at::text, expires_at - created_at AS ttl
FROM public.templates WHERE status = 'draft' ORDER BY created_at DESC LIMIT 5;

-- 新草稿 card_type 為 NULL（orphan）
SELECT id, card_type, name FROM public.templates WHERE card_type IS NULL;
```

### 驗證結果（新草稿已正確建立）

```
id: 6be1e06a..., card_type: NULL, expires_at: 2026-08-22 03:42:40+00  ✅
id: e2f8b804..., card_type: NULL, expires_at: 2026-082 03:41:35+00  ✅
```

## 衍生問題

1. **TTL 時長**：目前 24 小時。太短：編輯中途中斷會被清；太長：孤兒草稿佔用空間更久
2. **Touch 頻率**：目前每 5 分鐘一次，API call 增加
3. **Migration apply 方式**：目前用 Supabase MCP `apply_migration`。Production 需要 CI/CD pipeline 自動化
4. **pg_cron schedule**：目前是每小時（`0 * * * *`），覆寫了原本 plan 的每日凌晨 3 點

## 自問

- **下次怎麼不犯？**
  - Backend `schemas/request.ts` 應從 `@saome/shared/schemas/card` import，而非各自維護副本
  - 每次改 shared schema 要同步檢查 backend stub

- **哪條 rule 該補？**
  - `019-schema-contract-drift.mdc` 已涵蓋 schema drift，這次是驗證

- **哪個 test 該加？**
  - `apps/backend/src/modules/cards/db/templates.test.ts`（待新建）：`insertTemplate` auto-set TTL、`touchExpiresAt` reset TTL

---

> 撰寫者：cursor-agent ｜ 時間：2026-08-21
