-- Migration: 029_pass_events_one_registered_per_holder_idx
-- Desc: Add a partial unique index that makes "at most ONE `registered`
--       event per holder" a DATABASE-level guarantee.
--
-- WHY THIS MIGRATION EXISTS
--
-- Migration 028 created `public.pass_events` with only:
--
--   UNIQUE (pass_holder_id, idempotency_key)
--
-- That constraint makes an idempotent REPLAY safe (the same fact
-- written twice for the same holder is rejected) — but it does NOT
-- make the ledger's core invariant safe:
--
--   A holder has AT MOST ONE `registered` event.
--
-- The only thing enforcing that was a CONVENTION: every writer used
-- `idempotency_key = "registered:{holderId}"`. A second `registered`
-- event under a different key (a replay path, a manual insert, a
-- migrated/legacy row) was accepted by the database.
--
-- WHY THAT MATTERS
--
-- The reducer (`packages/shared/logic/passValueCalculator.ts`) treats
-- `registered` as the OPENING fact: it SETS the metrics and the expiry
-- date, it does not add to them. A second `registered` event therefore
-- RESETS the holder's metrics and expiry, silently discarding every
-- `metric_delta` that happened in between — e.g. a customer spends
-- 300 points and their balance snaps back to the opening value.
--
-- That is a silent data-loss bug that no application-layer convention
-- can fully prevent (manual SQL, a replay path, a future code path
-- that derives a different key). The invariant belongs in the schema.
--
-- The partial unique index below is that guarantee:
--
--   CREATE UNIQUE INDEX ... ON pass_events (pass_holder_id)
--       WHERE event_type = 'registered';
--
-- It is PARTIAL on purpose:
--   - `metric_delta` events are NOT affected — a holder may have any
--     number of them (that is the whole point of the ledger).
--   - Only the `registered` row is constrained, so the index stays
--     tiny (one entry per holder) instead of indexing every event.
--
-- APPLICATION-LAYER CONSISTENCY
--
-- With this index in place, the DB rejects a second `registered` row
-- with SQLSTATE 23505 (unique_violation). The application layer treats
-- that rejection as an idempotent replay, NOT as a server error:
--
--   - `passRegistrationService.ensureRegistrationRuntimeState()` catches
--     the unique violation and REPLAYS the ledger instead of appending,
--     so a re-registration over a holder that already has an opening
--     event (under a different key) returns `duplicate: true` and the
--     existing snapshot — it never appends and never 500s.
--   - `passValueBackfill.backfillPassRuntimeValues()` therefore counts
--     such a holder as `skipped` (not `applied`, not an error).
--
-- Note on the ON CONFLICT arbiter: `appendPassEvent` inserts with
-- `ON CONFLICT (pass_holder_id, idempotency_key) DO NOTHING`. That
-- arbiter covers the IDEMPOTENCY-KEY conflict (same fact replayed),
-- but NOT this new partial index (same holder, DIFFERENT key). The
-- latter surfaces as 23505 and is handled by the service layer above.
-- Verified against the live database: same key → absorbed, no error;
-- different key + `registered` → 23505; `metric_delta` → unaffected.
--
-- DATA PRE-FLIGHT
--
-- This index can only be created if the ledger already satisfies the
-- invariant. The guard below RAISEs with the offending holder ids
-- instead of letting Postgres fail with an opaque
-- "could not create unique index" message. The migration deliberately
-- does NOT delete rows: the ledger is the source of truth, and silently
-- dropping a `registered` event would discard real facts. A duplicate
-- must be resolved by a human who can tell which opening event is the
-- true one.
--
-- Applied via: saome_supabase MCP apply_migration
--
-- Backend references:
--   - apps/backend/src/modules/pass-templates/services/passRegistrationService.ts
--   - apps/backend/src/modules/pass-templates/services/passValueBackfill.ts
--
-- Decision references:
--   - runs/decisions/2026-10-24-pass-runtime-value-model.md
--     § 決定一 (the event ledger is the single source of truth)

-- ============================================================================
-- Guard: refuse to build the index over a ledger that already violates
-- the invariant. Failing loudly (with the offending holder ids) is the
-- only safe behaviour — the alternative is deleting ledger rows.
-- ============================================================================
DO $$
DECLARE
  offenders text;
BEGIN
  SELECT string_agg(holder_id::text, ', ' ORDER BY holder_id::text)
    INTO offenders
    FROM (
      SELECT DISTINCT pass_holder_id AS holder_id
        FROM public.pass_events
       WHERE event_type = 'registered'
    ) d
   WHERE holder_id IN (
      SELECT pass_holder_id
        FROM public.pass_events
       WHERE event_type = 'registered'
       GROUP BY pass_holder_id
      HAVING count(*) > 1
    );

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot create pass_events_one_registered_per_holder_idx: % holder(s) already have more than one ''registered'' event (holder ids: %). Resolve the duplicates manually — this migration does not delete ledger rows.',
      (SELECT count(*) FROM (
          SELECT pass_holder_id FROM public.pass_events
           WHERE event_type = 'registered'
           GROUP BY pass_holder_id HAVING count(*) > 1) c),
      offenders;
  END IF;
END $$;

-- ============================================================================
-- The invariant: at most one `registered` event per holder.
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS pass_events_one_registered_per_holder_idx
  ON public.pass_events (pass_holder_id)
  WHERE event_type = 'registered';

-- ============================================================================
-- Down migration (manual, kept here for reference):
-- DROP INDEX IF EXISTS public.pass_events_one_registered_per_holder_idx;
