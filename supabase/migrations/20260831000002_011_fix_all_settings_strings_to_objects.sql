-- Migration: 011_fix_all_settings_strings_to_objects
-- Desc: GLOBAL version of migration 009 — fix ALL templates.settings that is still
--       a JSON STRING (not array, not object) due to the legacy bug that stored
--       JSON.stringify(obj) directly as the column value.
--
-- Migration 009 only targeted one specific card ID (b9fc0dce-aa82-4c98-9983-55b3d014ead5)
-- as a safety net. This migration broadens the fix to ALL rows whose settings
-- column is a jsonb string.
--
-- Recovery logic:
--   - If settings is a proper jsonb object → leave it alone
--   - If settings is a jsonb string → extract text via #>> then cast text→jsonb
--     to parse the JSON text back into an object
--   - If settings is a jsonb array → leave for migration 010 to handle
--     (migrations 010 and 011 are intentionally ordered; 010 runs first on prod)
--   - Otherwise → '{}' fallback
--
-- Safety: idempotent — re-running on already-fixed rows is a no-op because the
-- WHERE clause filters them out.

UPDATE public.templates
SET settings = (
  CASE
    WHEN jsonb_typeof(settings) = 'object' THEN settings
    WHEN jsonb_typeof(settings) = 'string'
      THEN (settings #>> '{}')::jsonb
    WHEN jsonb_typeof(settings) = 'array' THEN settings  -- handled by migration 010
    ELSE '{}'::jsonb
  END
)
WHERE
  -- ONLY touch rows that are corrupted (jsonb strings).
  jsonb_typeof(settings) = 'string'
  -- Skip the already-fixed card (idempotent guard — 009 already fixed it).
  AND id != 'b9fc0dce-aa82-4c98-9983-55b3d014ead5';

-- Verification helper (can be removed after confirm):
--   SELECT id, jsonb_typeof(settings) AS type, settings
--     FROM public.templates
--    WHERE jsonb_typeof(settings) = 'string';
-- Expected: 0 rows (all string-typed rows have been converted to objects).
