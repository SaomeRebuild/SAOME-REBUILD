-- Migration: 024_add_not_required_payment_status
-- Desc: Widen public.pass_holders.payment_status CHECK constraint to
--       include 'not_required' as a 4th enum value. Distinguishes
--       "paid template, awaiting real gateway callback" (still 'pending')
--       from "non-paid template, no payment concept at all" (now
--       'not_required'). Stamp cards, free reward / cashback / coupon /
--       multipass / gift cards, and free membership templates will
--       record 'not_required' instead of polluting 'pending' queries.
--
-- Decision: runs/decisions/2026-10-18-payment-status-not-required-enum.md
--
-- Applied via: saome_supabase MCP apply_migration
--
-- Notes:
--   - No data backfill. Existing rows keep their current 'pending' value;
--     a separate one-off backfill (deferred) can normalize legacy rows.
--   - Drop-then-recreate is the simplest way to widen an inline CHECK
--     constraint (PostgreSQL has no ALTER CONSTRAINT ... ADD VALUE).
--     The auto-generated constraint name follows the
--     <table>_<column>_check convention from migration 023.

ALTER TABLE public.pass_holders
  DROP CONSTRAINT IF EXISTS pass_holders_payment_status_check;

ALTER TABLE public.pass_holders
  ADD CONSTRAINT pass_holders_payment_status_check
  CHECK (payment_status IN ('pending', 'completed', 'failed', 'not_required'));

-- Down migration (manual, kept here for reference):
-- ALTER TABLE public.pass_holders
--   DROP CONSTRAINT pass_holders_payment_status_check;
-- ALTER TABLE public.pass_holders
--   ADD CONSTRAINT pass_holders_payment_status_check
--   CHECK (payment_status IN ('pending', 'completed', 'failed'));