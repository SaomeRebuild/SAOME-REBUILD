-- Migration: 006_add_templates_expires_at
-- Desc: Add expires_at TTL column + index + pg_cron cleanup job for draft orphan cleanup
-- Applied via: Supabase MCP apply_migration (production)
-- References:
--   - DEV/08-2026/0821-card-back-ui-and-extension-pattern.md
--   - runs/improvements/feedback/20260821-draft-template-orphan-cleanup.md

-- ============================================================
-- 1. Add expires_at column
-- ============================================================
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.templates.expires_at IS
  'TTL for draft templates. NULL means no expiration. Set to now()+24h on insert. Cleared on publish.';

-- ============================================================
-- 2. Add index on (status, expires_at) for the cron DELETE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_templates_expires_at
  ON public.templates(status, expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================
-- 3. pg_cron: schedule cleanup every hour
-- ============================================================
-- Ensure pg_cron extension is enabled (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role (Supabase managed role)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove existing job if re-applying (idempotent)
SELECT cron.unschedule('cleanup_expired_draft_templates');

-- Schedule: every hour at minute 0
-- The DELETE targets: draft templates where expires_at < now()
SELECT cron.schedule(
  'cleanup_expired_draft_templates',
  '0 * * * *',                                    -- cron expression: top of every hour
  $$
    DELETE FROM public.templates
     WHERE status = 'draft'
       AND expires_at IS NOT NULL
       AND expires_at < now();
  $$
);

-- ============================================================
-- 4. Verification helpers (can be removed after confirm)
-- ============================================================
-- Cron job check:
--   SELECT * FROM cron.job WHERE jobname = 'cleanup_expired_draft_templates';
--
-- Manual cleanup (simulate cron):
--   DELETE FROM public.templates WHERE status = 'draft' AND expires_at < now();
--
-- TTL verification:
--   SELECT id, created_at, expires_at, expires_at - created_at AS ttl
--     FROM public.templates WHERE status = 'draft'
--     ORDER BY created_at DESC LIMIT 5;
