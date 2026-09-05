-- Step 5 Refactor: 對齊 Passcreator API
-- 2026-09-06 — Rename notificationRadius → locationsMaxDistance,
--              add locationsDisabled toggle, add relevantText per location.
--
-- Three idempotent UPDATEs:
  -- 1. Rename notificationRadius (existing) → locationsMaxDistance
  -- 2. Add locationsDisabled=false (default) for old rows that lack the key
  -- 3. Inject relevantText:null into each existing locations row
--
-- All UPDATEs are guarded by WHERE clauses so re-running is a no-op.

-- (1) Rename notificationRadius → locationsMaxDistance
UPDATE templates
   SET settings = (settings - 'notificationRadius')
                   || jsonb_build_object(
                        'locationsMaxDistance',
                        (settings->>'notificationRadius')::int
                      )
 WHERE settings ? 'notificationRadius';

-- (2) Inject locationsDisabled:false default for legacy rows
UPDATE templates
   SET settings = settings || '{"locationsDisabled": false}'::jsonb
 WHERE NOT (settings ? 'locationsDisabled');

-- (3) Inject relevantText:null into each existing locations row
--     jsonb_set with {locations} as the path, and jsonb_agg to map over the array.
UPDATE templates
   SET settings = jsonb_set(
         settings,
         '{locations}',
         (
           SELECT COALESCE(
                    jsonb_agg(
                      loc || jsonb_build_object('relevantText', loc->'relevantText')
                    ),
                    '[]'::jsonb
                  )
             FROM jsonb_array_elements(settings->'locations') AS loc
         ),
         true
       )
 WHERE jsonb_typeof(settings->'locations') = 'array'
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(settings->'locations') AS elem
      WHERE NOT (elem ? 'relevantText')
   );