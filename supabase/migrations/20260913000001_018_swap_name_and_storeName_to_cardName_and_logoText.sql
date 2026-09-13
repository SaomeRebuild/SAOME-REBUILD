-- 2026-09-13: Swap CardBuilder semantic storage.
--
-- Goal:
--   templates.name (SQL column)   now means "Card Name" (pass record name, NOT shown in preview)
--   templates.settings.logoText  (NEW JSONB key) holds "Logo Text" (pass header text shown in preview)
--   templates.settings.storeName removed; Card Name reuses the existing SQL column.
--
-- Sequence:
--   1. Move existing templates.name (Logo Text semantically) → settings.logoText (preserves value)
--   2. Move existing settings.storeName (Card Name semantically) → templates.name (SQL column)
--   3. Drop the now-redundant settings.storeName key
--
-- Idempotent: safe to re-run after partial application. Each UPDATE skips rows
-- that already satisfy the post-condition.

BEGIN;

-- 1. Copy existing templates.name → settings.logoText (skip if already swapped)
UPDATE public.templates
   SET settings = settings || jsonb_build_object('logoText', name)
 WHERE name IS NOT NULL
   AND NOT (settings ? 'logoText');

-- 2. Copy existing settings.storeName → templates.name (skip if already swapped or no storeName)
UPDATE public.templates
   SET name = COALESCE(settings->>'storeName', name)
 WHERE settings ? 'storeName'
   AND name IS DISTINCT FROM settings->>'storeName';

-- 3. Drop the now-redundant settings.storeName key
UPDATE public.templates
   SET settings = settings - 'storeName'
 WHERE settings ? 'storeName';

COMMIT;
