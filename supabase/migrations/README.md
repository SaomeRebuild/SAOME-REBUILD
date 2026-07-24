# Migrations

## Running Migrations via CI

This directory is deployed automatically when changes are pushed to the `main` branch via `.github/workflows/deploy.yml`.

The workflow runs:
1. `supabase login` — authenticate with access token
2. `supabase link` — link to the remote project
3. `migration repair --status reverted <version>` — clear phantom history entries (see Phantom Migrations below)
4. `db pull` — sync remote schema and migration history into local
5. `db push` — apply any pending local migrations

## Phantom Migrations

Supabase tracks migrations in a `schema_migrations` table on the remote database. If a migration was applied manually (e.g., via the Supabase dashboard) or the local file was deleted, the remote history can contain entries with no corresponding local file. In that case, `db push` fails with:

```
Remote migration versions not found in local migrations directory.
```

**Fix:** Mark those versions as reverted so Supabase stops expecting them:

```bash
supabase migration repair --status reverted <version>
```

The workflow already does this for known phantom entries. If you encounter new ones, add a `migration repair --status reverted <version>` line to the workflow before `db pull`.

## Adding a New Migration

1. Create a file: `supabase/migrations/YYYYMMDDNNN_description.sql`
2. Push to `main` — CI will apply it automatically
3. Or run locally: `supabase db push`
