-- Migration: 008_fix_corrupted_settings_jsonb_array
-- Desc: Fix templates.settings that became jsonb[] (array of jsonb strings)
--       due to insertTemplate storing JSON.stringify(obj) instead of obj.
--       The fix extracts the last array element (most recent state) and
--       parses it back into a proper jsonb object.
--
-- Recovery logic:
--   - If settings is already a proper jsonb object → leave it alone
--   - If settings is a jsonb array → take the LAST element, JSON-parse it back to object
--   - If settings is a jsonb string → JSON-parse it directly
--
-- Note: We use the LAST element because each update() call appended a new
--       element to the array. The last element has the most recent field values.
--       issuerLogo from an earlier element is NOT recovered (lost data), but
--       all user-entered fields (barcodeType, storeName, issuerName, etc.) are.

UPDATE public.templates
SET settings = (
  -- If it's already a jsonb object, keep it
  CASE
    WHEN jsonb_typeof(settings) = 'object' THEN settings
    -- If it's an array, take the last element and parse it
    WHEN jsonb_typeof(settings) = 'array' AND jsonb_array_length(settings) > 0
      THEN (settings -> -1) -- last element
    -- If it's a string, parse it (defensive fallback)
    WHEN jsonb_typeof(settings) = 'string'
      THEN settings::jsonb
    ELSE '{}'::jsonb
  END
)::jsonb
WHERE
  -- Only touch rows that are arrays (the corruption pattern)
  jsonb_typeof(settings) = 'array'
  -- Only touch the specific card we know is corrupted (for safety)
  AND id = 'b9fc0dce-aa82-4c98-9983-55b3d014ead5';
