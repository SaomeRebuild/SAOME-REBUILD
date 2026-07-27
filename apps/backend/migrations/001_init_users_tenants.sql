-- Migration 001: init users + tenants tables
-- Source: .specify/memory/specs/spec/002-tenant-auth/data-model.md
-- Applies to: Supabase Postgres (via Supabase MCP apply_migration)

-- ─────────────────────────────────────────────────────────
-- 1. users table
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL,
  password_hash text        NOT NULL,
  role          text        NOT NULL DEFAULT 'tenant'
                            CHECK (role IN ('tenant', 'admin')),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Email uniqueness (case-insensitive). One user per email.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uk
  ON public.users (LOWER(email));

-- Lookup by role among active users (for admin dashboard, future).
CREATE INDEX IF NOT EXISTS users_role_idx
  ON public.users (role)
  WHERE is_active = true;

-- ─────────────────────────────────────────────────────────
-- 2. tenants table
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   uuid        NOT NULL,
  name            text        NOT NULL,
  contact_name    text        NOT NULL,
  phone_city      text        NOT NULL,
  address         text        NOT NULL,
  tax_id          text        NOT NULL,
  invoice_address text        NULL,
  mobile          text        NULL,
  website         text        NULL,
  email           text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- FK to users with CASCADE on delete (if user deleted, tenant goes too).
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_owner_fk;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_owner_fk
    FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 1 user = 1 tenant for MVP.
CREATE UNIQUE INDEX IF NOT EXISTS tenants_owner_uk
  ON public.tenants (owner_user_id);

-- tax_id unique IF not "0" (multiple users can use "0" for 個人戶).
CREATE UNIQUE INDEX IF NOT EXISTS tenants_tax_id_uk
  ON public.tenants (tax_id)
  WHERE tax_id <> '0';

-- Lookup by email (case-insensitive; commercial email is public, not unique).
CREATE INDEX IF NOT EXISTS tenants_email_idx
  ON public.tenants (LOWER(email));

-- ─────────────────────────────────────────────────────────
-- Comments for clarity
-- ─────────────────────────────────────────────────────────
COMMENT ON TABLE  public.users              IS 'Tenant login accounts (1 row = 1 user; tenant business info lives in public.tenants)';
COMMENT ON COLUMN public.users.role         IS 'tenant | admin; admin is seeded only, never self-registered';
COMMENT ON COLUMN public.users.password_hash IS 'Argon2id or PBKDF2 hash — see apps/backend/src/shared/lib/password.ts';
COMMENT ON TABLE  public.tenants            IS 'Tenant business profile (1 row per tenant; 1:1 with users for MVP)';
COMMENT ON COLUMN public.tenants.tax_id     IS 'Taiwan 統一編號: 8 digits OR literal "0" (個人戶/工作室)';
COMMENT ON COLUMN public.tenants.invoice_address IS 'Nullable; frontend default = address if user leaves blank';