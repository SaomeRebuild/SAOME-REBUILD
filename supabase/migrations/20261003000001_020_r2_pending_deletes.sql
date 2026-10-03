-- Migration 020 — r2_pending_deletes (tombstone table for R2 cleanup)
--
-- Background (2026-10-03 — plan `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50`):
--   Workers Free plan HTTP request limit = 10ms CPU / 50 subrequests.
--   A sync `bucket.delete(key)` inline on the user-facing DELETE route
--   burns 1 subrequest + ~50-200ms wall time + ~1-3ms CPU, leaving very
--   little headroom for the rest of the handler (DB SELECT + DB UPDATE
--   on a jsonb merge + auth + CORS + error envelope).
--
--   This table is the tombstone: the user-facing route INSERTs a row,
--   returns 204 immediately, and the actual R2 delete happens inside
--   the existing every-5-min cron handler (Workers Free cron = 30s CPU
--   / 1000 subrequests — a different and much more generous envelope).
--
-- Three call sites enqueue here:
--   1. `apps/backend/src/modules/cards/routes/deleteTableCardElement.ts`
--      source = 'table-card-element-delete'
--      (the route that USED to do `bucket.delete()` inline)
--   2. `apps/backend/src/modules/cards/services/cardService.ts::deleteTemplateService`
--      source = 'template-delete'
--      (catches R2 objects orphaned when a template row is removed)
--   3. `apps/backend/src/modules/cards/db/templates.ts::updateTemplate`
--      source = 'image-clear'
--      (catches R2 objects orphaned when an imageKey field is replaced
--      or cleared in settings)
--
-- Sweep:
--   `apps/backend/src/index.ts::worker.scheduled` runs every 5 min
--   (already wired via `wrangler.jsonc::triggers.crons`). It picks up
--   rows where `completed_at IS NULL AND retry_count < 5`, deletes the
--   R2 object, and either stamps `completed_at` or increments
--   `retry_count` with a `last_error` log.
--
-- Idempotency:
--   UNIQUE(tenant_id, r2_key) + `ON CONFLICT DO NOTHING` on insert means
--   a second enqueue of the same key (e.g. concurrent image-clear
--   writes) won't create a duplicate row.
--
-- Retention:
--   No automatic purge of completed rows in this migration. The cron
--   sweep will be extended later to delete completed rows older than
--   30 days, keeping the table bounded.
--
-- Apply via saome_supabase MCP `apply_migration` per Rule 035.
-- Migration: 020 applied via saome_supabase MCP

CREATE TABLE IF NOT EXISTS r2_pending_deletes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  r2_key       text NOT NULL,
  source       text NOT NULL CHECK (source IN (
    'table-card-element-delete',
    'template-delete',
    'image-clear'
  )),
  created_at   timestamptz NOT NULL DEFAULT now(),
  retry_count  int NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error   text,
  completed_at timestamptz,
  UNIQUE(tenant_id, r2_key)
);

-- Partial index for the cron sweep hot path: only unfinished rows,
-- ordered by created_at so the oldest (most stale) get processed first.
CREATE INDEX IF NOT EXISTS idx_r2_pending_unfinished
  ON r2_pending_deletes (created_at)
  WHERE completed_at IS NULL;
