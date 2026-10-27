-- Migration: 030_add_pass_holder_spend_and_tier
-- Desc: Add the accumulated-spend amount and the resolved discount tier
--       to `public.pass_holders`.
--
-- WHY THIS MIGRATION EXISTS
--
-- A discount card's Wallet face slots (discount tier / tier bracket /
-- amount to next tier / accumulated spend) are derived from two
-- inputs: the holder's accumulated spend, and the template's tier
-- ladder (`templates.settings.discountTiers`).
--
-- The accumulated spend already existed — but ONLY as a number inside
-- the `pass_values_snapshot` JSONB blob. There was no column to
-- query, no column to index, and no column to join against.
--
-- The resolved tier did not exist anywhere. It was recomputed on
-- every push and never recorded, so "which tier is this holder in"
-- had no durable answer.
--
-- COLUMN SEMANTICS
--
--   spend_amount         — the holder's accumulated spend in the card
--                           currency. SAME SOURCE as
--                           `pass_values_snapshot->'metrics'->>'spendAccumulated'`:
--                           the application writes both in ONE UPDATE
--                           statement, so they cannot drift apart.
--                           Every card type carries it (a stamp card's
--                           accumulated spend is 0, but the column
--                           exists for every row so a reporting query
--                           never has to special-case card types).
--
--   current_tier_name    — the display name of the tier the holder is
--                           currently in. NULL for every non-discount
--                           card (they have no tier ladder).
--
--   current_tier_percent — the discount percentage that tier grants.
--                           NULL for every non-discount card.
--
-- WHY THE TIER IS NOT IN `pass_values_snapshot`
--
-- That JSONB column has ONE contract: it is the fold of the
-- `pass_events` ledger, replayed by `reducePassValues`. Anything
-- that is not an EVENT must not go in there, or the reducer would
-- have to know about template configuration to reproduce it — and the
-- template's tier ladder is mutable (a tenant can edit the ladder
-- between two registrations), so the tier is not a function of the
-- ledger alone. It is derived from (ledger spend + template settings),
-- which is why it gets its own columns.
--
-- WHY `spend_amount` IS NOT NULL DEFAULT 0
--
-- Every card type has the column, so every existing row needs a
-- value. NOT NULL + DEFAULT 0 makes the ALTER safe against the
-- existing 56 rows without a separate NOT NULL validation pass, and
-- it makes it impossible for a row to exist with "no spend" while
-- the snapshot says otherwise.
--
-- The backfill below copies the accumulated spend out of the existing
-- snapshots. Every current snapshot reads 0, but the copy is done
-- anyway so the column and the snapshot are provably in sync from
-- the moment this migration lands — a column that starts at 0 and
-- drifts later is worse than one that starts correct.
--
-- @see runs/decisions/2026-10-27-pass-holder-spend-and-discount-tier.md

ALTER TABLE public.pass_holders
  ADD COLUMN IF NOT EXISTS spend_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_tier_name    TEXT,
  ADD COLUMN IF NOT EXISTS current_tier_percent NUMERIC(5,2);

-- Backfill: copy the accumulated spend out of the existing runtime
-- snapshots so the column and the JSONB blob agree from the start.
--
-- Guarded on the snapshot actually having a numeric
-- `metrics.spendAccumulated`; a row with no snapshot (or a malformed
-- one) keeps the 0 default rather than failing the migration.
UPDATE public.pass_holders
   SET spend_amount = COALESCE(
         (pass_values_snapshot #>> '{metrics,spendAccumulated}')::NUMERIC,
         0
       )
 WHERE pass_values_snapshot IS NOT NULL
   AND spend_amount = 0
   AND (pass_values_snapshot #>> '{metrics,spendAccumulated}') IS NOT NULL;

-- Index for "which holders are in which tier" reporting. Partial on
-- `current_tier_name IS NOT NULL` because the column is NULL for
-- every non-discount card — an index over all 56 rows would carry
-- 53 useless entries.
CREATE INDEX IF NOT EXISTS pass_holders_current_tier_idx
    ON public.pass_holders (current_tier_name)
 WHERE current_tier_name IS NOT NULL;

-- Index for spend reporting across all card types.
CREATE INDEX IF NOT EXISTS pass_holders_spend_amount_idx
    ON public.pass_holders (spend_amount)
 WHERE spend_amount > 0;
