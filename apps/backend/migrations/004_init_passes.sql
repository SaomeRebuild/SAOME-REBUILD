-- Migration: 004_init_passes
-- Desc: Create passes table for trial subscription management

CREATE TABLE IF NOT EXISTS public.passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  plan text NOT NULL CHECK (plan IN ('green', 'gold', 'platinum')),
  trial_days integer NOT NULL DEFAULT 14,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for faster tenant lookup
CREATE INDEX IF NOT EXISTS idx_passes_tenant_id ON public.passes(tenant_id);

-- Index for status queries (e.g., find all expired passes)
CREATE INDEX IF NOT EXISTS idx_passes_status ON public.passes(status);

COMMENT ON TABLE public.passes IS 'Stores trial subscription and plan information for each tenant';
COMMENT ON COLUMN public.passes.tenant_id IS 'FK to tenants.id, UNIQUE to enforce 1:1 relationship';
COMMENT ON COLUMN public.passes.plan IS 'Selected pricing plan: green, gold, or platinum';
COMMENT ON COLUMN public.passes.trial_days IS 'Number of trial days (default 14)';
COMMENT ON COLUMN public.passes.start_date IS 'Trial start timestamp';
COMMENT ON COLUMN public.passes.end_date IS 'Trial end timestamp, calculated as start_date + trial_days';
COMMENT ON COLUMN public.passes.status IS 'Current status: active, expired, or cancelled';
