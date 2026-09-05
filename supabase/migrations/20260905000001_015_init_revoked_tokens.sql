-- Migration: 015_init_revoked_tokens (B4 PART 2 SCHEMA RESERVED — NOT YET WIRED)
-- Desc: Pre-create `public.revoked_tokens` table for future server-side
--       token revocation. The MVP logout path (option A in
--       runs/decisions/2026-09-05-auth-logout-revocation-strategy.md)
--       does NOT use this table — it relies on HttpOnly cookie clearing
--       + access-token natural TTL expiry.
--
--       This migration reserves the schema so the post-MVP implementation
--       (option B / C) can be added without another migration cycle.
--
-- Schema:
--   jti          — JWT ID (UUID), PK. Each access/refresh token carries
--                  a `jti` claim populated by shared/lib/jwt.ts.
--   expires_at   — When the revoked entry itself can be cleaned up.
--                  We don't need to track a token past its natural expiry.
--   revoked_at   — When the revocation happened (defaults to now()).
--   reason       — Optional human-readable reason for audit ('logout',
--                  'admin_force', 'security_incident', etc.).
--
-- Operations the future code path will need (NOT in this migration):
--   1. INSERT INTO public.revoked_tokens (jti, expires_at) at logout time.
--   2. SELECT 1 FROM public.revoked_tokens WHERE jti = $1 AND expires_at > now()
--      in verifyAccessToken / verifyRefreshToken (cached for 5s in process memory).
--   3. DELETE FROM public.revoked_tokens WHERE expires_at < now() — via
--      pg_cron (every hour) to keep the table bounded.
--
-- Decision: keep schema simple (single table, no RLS) since revocation
-- is an internal concern not exposed to end users.

CREATE TABLE IF NOT EXISTS public.revoked_tokens (
  jti uuid PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  reason text NULL
);

-- Index for the lookup query in verifyAccessToken: "is this jti revoked?"
-- The PK already covers this, but the composite index helps the cleanup
-- cron sweep by expires_at cheaply.
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at
  ON public.revoked_tokens (expires_at);
