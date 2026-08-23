-- Migration: 009_fix_settings_string_to_object
-- Desc: Fix templates.settings that is still a JSON STRING (not array, not object)
--       due to the first migration's WHERE condition using jsonb_typeof() which
--       returns 'string' for a jsonb string, not 'array'.
--
-- The correct fix:
--   - If settings is a jsonb array → take the LAST element, parse it back to object
--   - If settings is a jsonb string → parse it directly
--   - If settings is already a jsonb object → leave it alone
--
-- We target the specific card we know is corrupted to be safe.

UPDATE public.templates
SET settings = (
  SELECT
    CASE
      -- Already a proper jsonb object → keep
      WHEN jsonb_typeof(settings) = 'object' THEN settings
      -- jsonb string → parse it
      WHEN jsonb_typeof(settings) = 'string' THEN settings::jsonb
      -- jsonb array → take the LAST element
      WHEN jsonb_typeof(settings) = 'array' AND jsonb_array_length(settings) > 0
        THEN (settings -> -1)
      ELSE '{}'::jsonb
    END
)::jsonb
WHERE
  -- Match the known corrupted row by ID
  id = 'b9fc0dce-aa82-4c98-9983-55b3d014ead5'
  -- Only touch rows that are NOT already proper jsonb objects
  AND jsonb_typeof(settings) != 'object';
