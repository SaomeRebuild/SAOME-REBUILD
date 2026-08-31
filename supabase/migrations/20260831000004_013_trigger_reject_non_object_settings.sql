-- Migration: 013_trigger_reject_non_object_settings
-- Desc: Bug #8.5 雙保險 — DB-level trigger 確保 settings column 永遠是 jsonb object。
--       任何 UPDATE/INSERT 如果試圖把 settings 設成 array / string / null / 其他
--       非 object 型別，trigger 會 raise exception 拒絕。
--
-- 為什麼需要：即使 application 層修好，仍可能因 migration backfill 漏掉、
--       manual fix 漏掉、或未來新 code path 沒走 defensive parser。
--       Trigger 是 DB invariant 守門員。
--
-- 執行順序：010 → 011 → 012 → 013
--   - 010/011/012 是 backfill migration（救援 corrupted rows）
--   - 013 是守護 trigger（最後建，確保 010/011/012 都已跑過）

CREATE OR REPLACE FUNCTION reject_non_object_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.settings IS NOT NULL AND jsonb_typeof(NEW.settings) <> 'object' THEN
    RAISE EXCEPTION
      'Bug #8.5 guard: templates.settings must be a jsonb object, got %',
      jsonb_typeof(NEW.settings)
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_templates_settings_must_be_object ON public.templates;

CREATE TRIGGER trg_templates_settings_must_be_object
  BEFORE INSERT OR UPDATE OF settings ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION reject_non_object_settings();

-- Verification helpers (optional, can be removed after confirm):
--   UPDATE templates SET settings = '[]'::jsonb WHERE id = '<any>';
--     → ERROR: Bug #8.5 guard: templates.settings must be a jsonb object, got array
--   UPDATE templates SET settings = '"foo"'::jsonb WHERE id = '<any>';
--     → ERROR: Bug #8.5 guard: templates.settings must be a jsonb object, got string
--   UPDATE templates SET settings = '{"key":"value"}'::jsonb WHERE id = '<any>';
--     → success
--   UPDATE templates SET name = 'X' WHERE id = '<any>';
--     → success (trigger only fires on OF settings, not other columns)