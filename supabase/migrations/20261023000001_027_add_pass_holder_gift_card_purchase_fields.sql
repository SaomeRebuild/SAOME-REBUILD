-- Migration: 027_add_pass_holder_gift_card_purchase_fields
-- Desc: Extend public.pass_holders with the two columns the gift-card
--       purchase flow writes:
--         (a) purchased_points   INTEGER  — points the customer bought
--         (b) gift_card_snapshot JSONB   — frozen exchange rate + amount
--
--       `paid_amount` and `currency` ALREADY exist (migration 023) but
--       had never been written by any code path. This migration does not
--       touch them; it only makes them reachable (see registerService).
--
-- Why the rate is frozen instead of recomputed: the tenant can edit
-- `giftCardAmount` / `giftCardPoints` in CardBuilder Step 6 at any time.
-- A receipt rendered weeks after the purchase must show the price the
-- customer actually agreed to, which means persisting the rate at
-- purchase time. Mirrors the existing `membership_tier_snapshot`
-- pattern (migration 023).
--
-- Decision: runs/decisions/2026-10-23-gift-card-paid-registration.md
--           § "點數存成 purchased_points 還是完整帳本表"
--
-- Applied via: saome_supabase MCP apply_migration
--
-- Notes:
--   - Both columns are NULLABLE. Every non-gift-card row (stamp / reward
--     / membership / coupon) stays NULL, so this migration is a no-op
--     for existing data and needs no backfill.
--   - `purchased_points` carries a CHECK > 0 as the last line of
--     defence. The application layer (shared/logic/giftCardPurchase.ts
--     + registerService) already rejects 0 / negative / fractional
--     values; per Rule 032 the DB constraint is defence-in-depth, not
--     the primary gate.
--   - No points LEDGER yet. A full top-up / spend history table is
--     deliberately deferred — see the Decision Log. This migration only
--     records the opening purchase.

ALTER TABLE public.pass_holders
  ADD COLUMN IF NOT EXISTS purchased_points   INTEGER
    CHECK (purchased_points IS NULL OR purchased_points > 0),
  ADD COLUMN IF NOT EXISTS gift_card_snapshot JSONB;

-- Partial index: future points-balance / redemption reporting queries
-- filter on `purchased_points IS NOT NULL`. A partial index keeps the
-- index small (gift rows are a minority of pass_holders) and leaves
-- NULL lookups on the existing (template_id, email) unique index.
CREATE INDEX IF NOT EXISTS pass_holders_purchased_points_idx
  ON public.pass_holders (purchased_points)
  WHERE purchased_points IS NOT NULL;

-- Down migration (manual, kept here for reference):
-- DROP INDEX IF EXISTS public.pass_holders_purchased_points_idx;
-- ALTER TABLE public.pass_holders
--   DROP COLUMN IF EXISTS gift_card_snapshot,
--   DROP COLUMN IF EXISTS purchased_points;