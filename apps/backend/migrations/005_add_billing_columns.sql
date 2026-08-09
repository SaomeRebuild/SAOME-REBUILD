-- Migration: 005_add_billing_columns
-- Desc: Add paid_at and billing_cycle_end to passes table

ALTER TABLE public.passes
  ADD COLUMN paid_at timestamptz NULL,
  ADD COLUMN billing_cycle_end timestamptz NULL;

COMMENT ON COLUMN public.passes.paid_at IS 'First payment timestamp; NULL = still in trial';
COMMENT ON COLUMN public.passes.billing_cycle_end IS 'End of current billing month; NULL if not yet paid';
