-- Migration: 023_add_pass_holder_payment_fields
-- Desc: Extend public.pass_holders with paid-membership tier + simulated
--       payment snapshot (Payfast / Ecpay). No real Passcreator API V3
--       integration yet; the new columns are reserved for the future
--       backend write that will land after this frontend feature.
--
-- Decision: runs/decisions/2026-10-16-pass-holder-paid-membership-snapshot.md
--           § "候選 A — 擴充 pass_holders（決定 ✅）"
--
-- Applied via: saome_supabase MCP apply_migration

ALTER TABLE public.pass_holders
  ADD COLUMN IF NOT EXISTS selected_tier_index       INTEGER,                                       -- 0-based index into template.membershipTiers[]
  ADD COLUMN IF NOT EXISTS membership_tier_snapshot  JSONB,                                          -- frozen snapshot at registration time
  ADD COLUMN IF NOT EXISTS payment_provider          TEXT CHECK (payment_provider IN ('payfast', 'ecpay')),
  ADD COLUMN IF NOT EXISTS payment_status            TEXT NOT NULL DEFAULT 'pending'
                                                       CHECK (payment_status IN ('pending', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS paid_amount               NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS currency                  TEXT CHECK (currency IN ('TWD', 'ZAR'));

-- Backfill currency for existing rows (defensive — current data is
-- +886 Taiwan only, default to TWD so old rows don't violate the new CHECK).
UPDATE public.pass_holders
   SET currency = 'TWD'
 WHERE currency IS NULL;

-- Down migration (manual, kept here for reference):
-- ALTER TABLE public.pass_holders
--   DROP COLUMN IF EXISTS currency,
--   DROP COLUMN IF EXISTS paid_amount,
--   DROP COLUMN IF EXISTS payment_status,
--   DROP COLUMN IF EXISTS payment_provider,
--   DROP COLUMN IF EXISTS membership_tier_snapshot,
--   DROP COLUMN IF EXISTS selected_tier_index;
