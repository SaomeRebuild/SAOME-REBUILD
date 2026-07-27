-- Migration 003: seed admin user
-- Source: .specify/memory/specs/spec/002-tenant-auth/data-model.md §3.3
-- Applies to: Supabase Postgres (via Supabase MCP apply_migration)
--
-- IMPORTANT: This migration seeds ONE admin account.
--   - Admin is NEVER self-registered (see spec FR-006 + admin-only flow)
--   - Email: admin@saome.org (decided at SAOME-11)
--   - Password: Qwww123123! (operator-chosen; MUST be rotated after deploy)
--   - Hash algorithm: scrypt (Node.js built-in crypto; the production
--     backend will use Argon2id or PBKDF2 per SAOME-13 — this scrypt hash
--     is a TEMPORARY seed; once the chosen algo is implemented, the admin
--     password will be re-hashed and replaced. See feedback note
--     `runs/improvements/feedback/20260728-admin-seed-scrypt.md`.)
--
-- NOTE: This hash allows first-time login ONLY. Operator must change password
-- after first deploy (out of scope for MVP — manually via DB update until
-- SAOME-26+ adds a "change password" endpoint).

INSERT INTO public.users (email, password_hash, role, is_active)
VALUES (
  'admin@saome.org',
  'scrypt$28d2de255da11d8f233940b867f8897b$49575e8e0c18307869f57464bd8f51b0cd39577b8819e386989a822b60331890477d5ecb0287175b9e729a01e8facc01be7e2f13cb774cd05f21b80dbed9fd1f',
  'admin',
  true
)
ON CONFLICT (LOWER(email)) DO NOTHING; -- safe to re-run

-- Admins do NOT have a tenants row (they manage tenants, not own one).
-- (no INSERT into tenants for admin role)

-- Verification (run manually after apply):
--   SELECT id, email, role, is_active, created_at
--     FROM public.users
--    WHERE role = 'admin';
-- Expected: 1 row, email = admin@saome.org