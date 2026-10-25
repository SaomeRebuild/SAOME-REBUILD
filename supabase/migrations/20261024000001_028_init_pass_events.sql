-- Migration: 028_init_pass_events
-- Desc: Create the Pass runtime value event ledger and the derived
--       snapshot column.
--
--       (a) public.pass_events          — append-only event ledger
--       (b) public.pass_holders.pass_values_snapshot — derived snapshot
--
-- WHY AN EVENT LEDGER (and not a counter / balance table)
--
-- A "current balance" needs one table with one mutable number. Six
-- earlier draft plans each proposed their own variant (pass_holder_
-- counters, pass_holder_balances, snapshot-only, …) and none of them
-- could answer "why is this holder's balance 120?". An append-only
-- ledger can: the state is the fold of the events, so the derivation
-- is reproducible and auditable.
--
-- The trade-off is deliberate:
--   - WRITES become append-only (cheap, no read-modify-write race).
--   - READS need a fold. That fold's RESULT is cached in
--     pass_holders.pass_values_snapshot so the hot path (rendering a
--     holder's pass) stays a single-row read.
--
-- The snapshot is therefore a CACHE, not the source of truth. It can be
-- rebuilt from pass_events at any time (see the backfill script).
--
-- Decision: runs/decisions/2026-10-24-pass-runtime-value-model.md
--           § 決定一 (event ledger is the single source of truth)
--
-- Applied via: wrangler Hyperdrive worker (one-off remote Worker with
--               the HYPERDRIVE binding attached) - NOT via saome_supabase
--               MCP apply_migration.
--               Consequence: the Supabase `schema_migrations` ledger does
--               NOT contain 028 (it jumps 027 -> 029), because the
--               worker route bypasses the MCP's ledger bookkeeping. The
--               schema objects themselves ARE live.
--               The local registry (`supabase/migrations/.applied-migrations.json`)
--               records the same mechanism, so file header and registry
--               agree. Do NOT re-apply.
--
-- Backend references:
--   - apps/backend/src/modules/pass-templates/db/passEvents.ts   (SQL)
--   - apps/backend/src/modules/pass-templates/services/passValueService.ts
--
-- Shared contract references:
--   - packages/shared/schemas/passValues.ts  (passEventSchema /
--     passValuesSnapshotSchema — the shapes these columns hold)

-- ============================================================================
-- (a) public.pass_events — the append-only ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pass_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_holder_id UUID NOT NULL REFERENCES public.pass_holders(id) ON DELETE CASCADE,

  -- The event type. Mirrors PASS_EVENT_TYPES in
  -- packages/shared/schemas/passValues.ts:
  --   'registered'   — the opening fact of a holder's ledger
  --   'metric_delta' — a numeric increment/decrement of one metric
  -- The Scanner-phase plan adds further variants; the CHECK is widened
  -- in that migration rather than left permissive now.
  event_type     TEXT NOT NULL
    CHECK (event_type IN ('registered', 'metric_delta')),

  -- The event payload. Validated in the application layer by
  -- passEventSchema BEFORE it reaches SQL (Rule 032 § 1 — never pass
  -- client- or upstream-shaped JSON through unvalidated). The DB-level
  -- guard here is the "is it an object" check, which is the last line
  -- of defence against a corrupt write.
  payload        JSONB NOT NULL
    CHECK (jsonb_typeof(payload) = 'object'),

  -- When the fact OCCURRED (business time — e.g. when the customer
  -- actually spent the points). Distinct from created_at (when we
  -- learned about it). The reducer sorts by this.
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- When the row was written (ingestion time).
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotency key. Scoped per holder: the same logical fact
  -- replayed for the SAME holder is rejected; the same key for two
  -- different holders is fine.
  --
  -- The Scanner-phase plan defines what the key actually contains
  -- (an external transaction id, a request id, …). This round only
  -- requires that it be present and unique per holder, so the
  -- uniqueness constraint can be added without a migration later.
  --
  -- NULL is allowed: a legacy / manually-inserted event may not have
  -- one. Postgres treats NULLs as distinct in a unique index, so those
  -- rows do not collide.
  idempotency_key TEXT,

  CONSTRAINT pass_events_holder_idempotency_unique
    UNIQUE (pass_holder_id, idempotency_key)
);

-- Ledger read path: "all events for holder X, in order".
CREATE INDEX IF NOT EXISTS pass_events_holder_occurred_idx
  ON public.pass_events (pass_holder_id, occurred_at, created_at);

-- Operational query: "which events failed to sync to Passcreator?"
-- Kept for the future sync-retry tooling; the column is added now so
-- the later retry work does not need a migration.
CREATE INDEX IF NOT EXISTS pass_events_event_type_idx
  ON public.pass_events (event_type);

-- ============================================================================
-- (b) public.pass_holders.pass_values_snapshot — the derived cache
-- ============================================================================
--
-- Holds a `passValuesSnapshotSchema`-shaped JSONB:
--   {
--     "metrics": { "giftPoints": 500, "pointsBalance": 0, ... },
--     "expiryDate": "2027-10-23" | null
--   }
--
-- NULLABLE: a holder row that has never been through the value flow
-- (and every pre-migration row) keeps NULL. That distinguishes "no
-- runtime values yet" from "runtime values that happen to be all
-- zero" — a distinction the backfill needs, because a zero snapshot
-- and a missing snapshot are NOT the same state.
ALTER TABLE public.pass_holders
  ADD COLUMN IF NOT EXISTS pass_values_snapshot JSONB;

-- Partial index: the sync tooling scans holders that HAVE a snapshot
-- but are missing a synced value.
CREATE INDEX IF NOT EXISTS pass_holders_pass_values_snapshot_idx
  ON public.pass_holders (id)
  WHERE pass_values_snapshot IS NOT NULL;

-- ============================================================================
-- RLS
-- ============================================================================
-- Same posture as pass_holders (migration 019): the backend is the only
-- reader/writer via Hyperdrive (service role bypasses RLS). RLS is
-- enabled as defence-in-depth so anon / authenticated roles have no
-- policy and cannot read the ledger directly via PostgREST.
--
-- The ledger contains per-holder spend / points history, so it is
-- MORE sensitive than the holder row itself — leaving it without RLS
-- would be a data exposure.
ALTER TABLE public.pass_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Down migration (manual, kept here for reference):
-- ============================================================================
-- DROP INDEX IF EXISTS public.pass_holders_pass_values_snapshot_idx;
-- ALTER TABLE public.pass_holders DROP COLUMN IF EXISTS pass_values_snapshot;
-- DROP INDEX IF EXISTS public.pass_events_event_type_idx;
-- DROP INDEX IF EXISTS public.pass_events_holder_occurred_idx;
-- DROP TABLE IF EXISTS public.pass_events;
