-- Migration: 010_fix_all_corrupted_settings_arrays
-- Desc: GLOBAL version of migration 008 — fix ALL templates.settings that became
--       jsonb[] (array of jsonb strings) due to insertTemplate previously
--       storing JSON.stringify(obj) instead of obj.
--
-- Migration 008 only targeted one specific card ID (b9fc0dce-aa82-4c98-9983-55b3d014ead5)
-- as a safety net. This migration broadens the fix to ALL rows whose settings
-- column is a jsonb array.
--
-- Recovery logic:
--   - If settings is already a proper jsonb object → leave it alone
--   - If settings is a jsonb array → take the LAST element (most recent state
--     from the legacy append-only bug). The last element is itself a jsonb
--     string that needs text→jsonb cast to parse it.
--   - If settings is a jsonb string → leave for migration 011 to handle
--   - Otherwise (null/number/boolean) → '{}' fallback
--
-- Why we lose some data here:
--   The legacy append-only UPDATE bug stored `settings || JSON.stringify(newObj)::jsonb`
--   where `||` on jsonb with mismatched types (array vs object) converts both
--   sides to text arrays. So the result was `[..., "{...partial...}"]` — an
--   array of partial JSON strings. The LAST element has the most-recent field
--   values, but fields from earlier elements (e.g. issuerLogo from a prior
--   upload) are NOT recoverable. We document this loss in the user-facing
--   feedback (DEV LOG 2026-08-31).
--
-- IMPORTANT — PostgreSQL CASE WHEN does NOT short-circuit:
--   `WHEN jsonb_typeof(x) = 'array' AND jsonb_array_length(x) > 0`
--   fails on non-array rows because `jsonb_array_length(scalar)` throws.
--   We must wrap `jsonb_array_length` in a nested CASE / type guard, OR
--   only call it inside a branch where the type is already known to be array.
--   This migration uses the type-guarded approach via nested CASE.

UPDATE public.templates
SET settings = (
  CASE jsonb_typeof(settings)
    -- Already a proper jsonb object → leave it alone
    WHEN 'object' THEN settings
    -- jsonb array → recover from the LAST element
    WHEN 'array' THEN (
      CASE
        WHEN jsonb_array_length(settings) > 0
          THEN CASE jsonb_typeof(settings -> -1)
            WHEN 'string' THEN ((settings -> -1) #>> '{}')::jsonb
            WHEN 'object' THEN (settings -> -1)
            ELSE '{}'::jsonb
          END
        ELSE '{}'::jsonb
      END
    )
    -- jsonb string → handled by migration 011, leave for it
    WHEN 'string' THEN settings
    -- null/number/boolean → safe fallback
    ELSE '{}'::jsonb
  END
)
WHERE
  -- ONLY touch rows that are corrupted (jsonb arrays).
  jsonb_typeof(settings) = 'array'
  AND jsonb_array_length(settings) > 0
  -- Skip the already-fixed card (idempotent guard — 008 already fixed it).
  AND id != 'b9fc0dce-aa82-4c98-9983-55b3d014ead5';

-- Verification helper (can be removed after confirm):
--   SELECT id, jsonb_typeof(settings) AS type, jsonb_array_length(settings) AS arr_len
--     FROM public.templates
--    WHERE jsonb_typeof(settings) = 'array';
-- Expected: 0 rows (all array-typed rows have been converted to objects).
