-- Migration: 005_init_templates
-- Desc: Create templates table for card builder drafts
-- Applied via: npx supabase db push (local) or Supabase MCP apply_migration (production)
-- Backend migration: apps/backend/migrations/005_init_templates.sql (reference only)

CREATE TABLE IF NOT EXISTS public.templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  name          TEXT NOT NULL DEFAULT '未命名卡片',
  card_type     TEXT NOT NULL CHECK (card_type IN (
    'stamp_card',
    'cashback_card',
    'reward_card',
    'membership_card',
    'discount_card',
    'coupon_card',
    'multipass',
    'gift_card'
  )),
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant_id ON public.templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_status ON public.templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_updated_at ON public.templates(updated_at DESC);

-- RLS: Row Level Security
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates manageable by tenant"
  ON public.templates
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
