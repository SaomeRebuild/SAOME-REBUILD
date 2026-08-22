-- Migration: 006_add_abandoned_status
-- Desc: Add 'abandoned' to templates.status CHECK constraint
--         (kept for historical migrations; no longer used by new code)
--
-- Status values:
--   draft      — active draft (auto-expires in 24h via pg_cron)
--   published  — published template (no TTL)
--   abandoned  — DEPRECATED: no longer set by new code; replaced by DELETE.
--                The CHECK constraint still allows 'abandoned' for backward compat
--                with existing production data, but new flow uses DELETE instead.

ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_status_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_status_check
  CHECK (status IN ('draft', 'published', 'abandoned'));

-- Update COMMENT to reflect the new state
COMMENT ON COLUMN public.templates.status IS '卡片狀態：draft（草稿）/ published（已發布）; abandoned 已廢除，由 DELETE 取代';
