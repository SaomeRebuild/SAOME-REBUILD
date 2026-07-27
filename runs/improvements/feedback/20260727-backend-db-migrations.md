# Backend DB Migration Applied — 2026-07-27

## Status

Migrations 001, 002, 003 applied to Supabase Postgres successfully.

| # | File | Tables affected | Status |
|---|---|---|---|
| 001 | `migrations/001_init_users_tenants.sql` | users, tenants | ✅ applied |
| 002 | `migrations/002_init_login_attempts.sql` | login_attempts | ✅ applied |
| 003 | `migrations/003_seed_admin.sql` | users (1 row inserted) | ✅ applied |

Admin account:
- email: `admin@saome.org`
- password hash: `scrypt$28d2de255da11d8f233940b867f8897b$49575e8e0c18307869f57464bd8f51b0cd39577b8819e386989a822b60331890477d5ecb0287175b9e729a01e8facc01be7e2f13cb774cd05f21b80dbed9fd1f`
- plaintext: `Qwww123123!` (operator-supplied; MUST be rotated after first deploy)

## Open: Row Level Security (RLS) advisory

Supabase advisor flagged:

> 3 tables have RLS disabled: `public.users`, `public.tenants`, `public.login_attempts`.

**Decision (deferred to user)**: enable RLS with policies?

For a backend-only access pattern (Hyperdrive service role), RLS doesn't gate the backend's writes (service role bypasses RLS by default). But it WOULD protect against:
- Anon key leaked via frontend
- Direct psql access without explicit GRANT
- Future admin UI tools that use the anon key

Recommended remediation SQL (NOT auto-applied):

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so backend via Hyperdrive is unaffected.
-- Add explicit policies if/when an anon-role client ever queries these.
```

Owner decision: **leave RLS disabled for MVP**, revisit at SAOME-26+ when admin UI / reporting endpoints are added.

## Open: Password algorithm

The seed admin hash uses Node.js built-in `crypto.scrypt` (a TEMPORARY algorithm choice). The production backend will use **Argon2id or PBKDF2** decided at SAOME-13 via `verify-this` skill.

Once chosen, the admin password must be:
1. Re-hashed with the production algorithm
2. Updated in the DB: `UPDATE public.users SET password_hash = '<NEW_HASH>' WHERE email = 'admin@saome.org';`
3. Operator logs in, verifies rotation, removes this scrypt seed

## Open: Hyperdrive ID

`apps/backend/wrangler.jsonc` still has `"id": "<HYPERDRIVE_ID_PLACEHOLDER>"`.

To provision:

1. Cloudflare dashboard → Workers → Hyperdrive → Create configuration
2. Connection string: `postgres://postgres.<PROJECT>:<PASSWORD>@<HOST>:5432/postgres`
   (use Supabase "Direct connection" not "Transaction" pooler for Hyperdrive)
3. Copy the resulting Hyperdrive ID
4. Replace `<HYPERDRIVE_ID_PLACEHOLDER>` in `apps/backend/wrangler.jsonc`
5. Deploy: `cd apps/backend && npm run deploy`

## Verification queries

```sql
-- Should show 1 admin row
SELECT id, email, role, is_active, created_at
  FROM public.users
 WHERE role = 'admin';

-- Should show 0 tenant rows (no tenants registered yet)
SELECT count(*) FROM public.tenants;

-- Should show 0 login attempts (no logins yet)
SELECT count(*) FROM public.login_attempts;
```