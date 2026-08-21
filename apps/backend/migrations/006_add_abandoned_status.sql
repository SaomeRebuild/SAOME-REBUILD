-- Migration: 006_add_abandoned_status
-- Desc: Add 'abandoned' to templates.status CHECK constraint
--         so PATCH /api/cards/:id/abandon can set status = 'abandoned'
--
-- Status values after this migration:
--   draft      — active draft (auto-expires in 24h via pg_cron)
--   published  — published template (no TTL)
--   abandoned  — intentionally discarded by user (kept for pg_cron TTL cleanup)

ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_status_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_status_check
  CHECK (status IN ('draft', 'published', 'abandoned'));

-- Update COMMENT to reflect the new state
COMMENT ON COLUMN public.templates.status IS '卡片狀態：draft（草稿）/ published（已發布）/ abandoned（已放棄）';
