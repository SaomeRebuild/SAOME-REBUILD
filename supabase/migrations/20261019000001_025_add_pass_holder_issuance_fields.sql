-- Migration: 025_add_pass_holder_issuance_fields
-- Desc: Extend public.pass_holders with the per-pass runtime fields
--       returned by Passcreator V3 /api/v3/pass after the holder is
--       registered. All columns nullable; existing test rows ignored
--       (user explicitly approved in plan mode q3).
--
-- Columns:
--   - pass_identifier: V3 data.identifier (per-pass UUID)
--   - download_url:    V3 data.linkToPassPage (the .pkpass link for the holder)
--   - barcode_value:   V3 data.barcodeValue (the per-pass barcode payload)
--   - issued_at:       timestamp at which we successfully invoked V3
--                       (NULL when issuance failed or never attempted)
--   - issuance_error:  i18n key describing why issuance failed (NULL on
--                       success); lets the frontend render a "重試簽發"
--                       banner without exposing internal upstream errors.
--
-- Decision: runs/decisions/2026-10-19-pass-holder-v3-issuance.md
--           § "Schema：A — 在 pass_holders 加 5 個 column (決定 ✅)"
--
-- Applied via: saome_supabase MCP apply_migration
-- Wrapped by:  .cursor/rules/035-migration-apply-pipeline.mdc
--              .cursor/rules/037-mcp-tool-call-pattern.mdc (pre-listed
--              tool call without CallMcpTool wrapping)

ALTER TABLE public.pass_holders
  ADD COLUMN IF NOT EXISTS pass_identifier  TEXT,
  ADD COLUMN IF NOT EXISTS download_url     TEXT,
  ADD COLUMN IF NOT EXISTS barcode_value    TEXT,
  ADD COLUMN IF NOT EXISTS issued_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS issuance_error   TEXT;

-- Partial unique index: at most one pass_holder row per pass_identifier
-- at any given time. Defends against accidental double-issue (e.g. if the
-- register handler retries and V3 returns the same identifier twice).
-- Partial form keeps NULL rows out of the index (legacy / failed / not-yet
-- issued rows have NULL identifier and don't need indexing).
CREATE UNIQUE INDEX IF NOT EXISTS pass_holders_pass_identifier_unique
  ON public.pass_holders (pass_identifier)
  WHERE pass_identifier IS NOT NULL;

-- Lookup helper index for the V3 error-display case ("how many
-- failed issuances today?"). Already covered by the partial UNIQUE
-- index above for non-NULL identifiers, but spares a seq scan on the
-- issuance_error-driven queries dashboards may run.
CREATE INDEX IF NOT EXISTS pass_holders_issuance_error_idx
  ON public.pass_holders (issuance_error)
  WHERE issuance_error IS NOT NULL;

-- Down migration (manual, kept here for reference):
-- DROP INDEX IF EXISTS public.pass_holders_issuance_error_idx;
-- DROP INDEX IF EXISTS public.pass_holders_pass_identifier_unique;
-- ALTER TABLE public.pass_holders
--   DROP COLUMN IF EXISTS issuance_error,
--   DROP COLUMN IF EXISTS issued_at,
--   DROP COLUMN IF EXISTS barcode_value,
--   DROP COLUMN IF EXISTS download_url,
--   DROP COLUMN IF EXISTS pass_identifier;
