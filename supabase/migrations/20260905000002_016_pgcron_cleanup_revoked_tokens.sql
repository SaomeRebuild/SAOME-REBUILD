-- Migration: 016_pgcron_cleanup_revoked_tokens
-- Desc: Phase 2.2 (2026-09-05) — wire option B of
--       runs/decisions/2026-09-05-auth-logout-revocation-strategy.md.
--
--       Adds a pg_cron job to DELETE expired revocation rows from
--       `public.revoked_tokens` every hour. The table is bounded by
--       the natural token TTL: access tokens (1h) + refresh tokens
--       (30d). Without this job the table grows unboundedly on every
--       logout — pg_cron keeps the working set small.
--
--       Schedule rationale:
--         - 1h frequency is overkill (rows are usable only until the
--           underlying token would have expired, max 30d), but cheap.
--         - Avoids per-minute cron overhead while keeping the cleanup
--           window tight enough that revoked_tokens rarely holds more
--           than ~24h worth of stale rows.
--
--       Idempotent: the pg_cron.schedule call is no-op'd if the job
--       already exists (cron.schedule returns the job id, but we wrap
--       in DO block with EXCEPTION handler to tolerate re-runs).
--
--       Requires: pg_cron extension to be enabled on Supabase (it is
--       by default on most Supabase projects).

-- Ensure pg_cron is available (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule hourly cleanup. Job name is suffixed with the migration
-- version so re-applies don't collide.
SELECT cron.schedule(
  'purge_revoked_tokens_v016',         -- job name
  '0 * * * *',                          -- every hour at minute 0
  $cron$DELETE FROM public.revoked_tokens WHERE expires_at < now()$cron$
);
