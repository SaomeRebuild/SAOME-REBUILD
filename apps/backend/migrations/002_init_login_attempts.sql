-- Migration 002: init login_attempts table
-- Source: .specify/memory/specs/spec/002-tenant-auth/data-model.md
-- Applies to: Supabase Postgres (via Supabase MCP apply_migration)

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id              bigserial   PRIMARY KEY,
  user_id         uuid        NULL,
  email_attempted text        NOT NULL,
  success         boolean     NOT NULL,
  attempted_at    timestamptz NOT NULL DEFAULT now()
);

-- Anti-enumeration: even when email doesn't exist, the row is recorded with
-- user_id NULL. So `email_attempted` is the canonical lookup.
ALTER TABLE public.login_attempts
  DROP CONSTRAINT IF EXISTS login_attempts_user_fk;
ALTER TABLE public.login_attempts
  ADD CONSTRAINT login_attempts_user_fk
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Composite index for rate-limit query:
--   SELECT count(*) FROM login_attempts
--   WHERE LOWER(email_attempted) = LOWER($1)
--     AND success = false
--     AND attempted_at > now() - interval '10 minutes';
CREATE INDEX IF NOT EXISTS login_attempts_email_time_idx
  ON public.login_attempts (LOWER(email_attempted), attempted_at DESC);

-- User-scoped audit (active sessions, future per-user lockout, etc.)
CREATE INDEX IF NOT EXISTS login_attempts_user_time_idx
  ON public.login_attempts (user_id, attempted_at DESC)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE  public.login_attempts       IS 'Every login attempt (success or failure). Powers rate limit + audit.';
COMMENT ON COLUMN public.login_attempts.user_id IS 'NULL if email not found (anti-enumeration; still rate-limited).';