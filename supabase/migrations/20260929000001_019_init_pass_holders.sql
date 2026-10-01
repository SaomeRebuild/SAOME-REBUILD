-- Migration: 019_init_pass_holders
-- Desc: Create public.pass_holders table for the public pass registration flow
--       (Pass Holder = end-user receiving the wallet card, NOT a SAOME platform member).
--
-- Decision log: runs/decisions/2026-09-29-pass-templates-public-endpoint.md
--               § Decision 1 (module name), § Decision 2 (mock handling),
--               § Decision 3 (tenant isolation: no tenant_id FK).
--
-- Applied via: saome_supabase MCP apply_migration
-- Backend reference: apps/backend/src/modules/pass-templates/db/passHolders.ts

CREATE TABLE IF NOT EXISTS public.pass_holders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id        UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  phone_country_code TEXT NOT NULL CHECK (phone_country_code IN ('+886', '+27')),
  phone_number       TEXT NOT NULL,
  birthday           DATE NOT NULL,
  email              TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotent re-registration: same (template_id, email) returns existing row.
  -- Matches the conformance test in apps/backend/src/modules/pass-templates/tests/register.test.ts
  -- ("同 email + template 重複註冊冪等回 200").
  CONSTRAINT pass_holders_template_email_unique UNIQUE (template_id, email)
);

CREATE INDEX IF NOT EXISTS pass_holders_template_id_idx ON public.pass_holders(template_id);
CREATE INDEX IF NOT EXISTS pass_holders_email_idx        ON public.pass_holders(email);

-- updated_at trigger (consistent with public.templates)
DROP TRIGGER IF EXISTS update_pass_holders_updated_at ON public.pass_holders;
CREATE TRIGGER update_pass_holders_updated_at
  BEFORE UPDATE ON public.pass_holders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: backend is the only reader/writer via Hyperdrive (service role bypasses RLS).
-- Enable RLS as defense-in-depth: anon / authenticated roles have no policies, so they
-- cannot read pass_holders directly via PostgREST. All access MUST go through the
-- /api/pass-templates/:id/register endpoint which is wrapped in our Hono chain.
ALTER TABLE public.pass_holders ENABLE ROW LEVEL SECURITY;