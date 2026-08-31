-- Migration: 012_merge_all_array_elements
-- Desc: Bug #8.5 救援 — 把 array-of-jsonb-strings 合併成 single object。
--       跟 migration 010 不同：010 取最後 element（單一 source of truth），
--       012 用 reduce-style merge（保留所有 element 的 keys，較新的覆蓋較舊的）。
--       理由：Step 2 資料已部分遺失，但 array 內多個 step 的 partial merge
--       仍可能含其他 step 的關鍵欄位（barcodeType / currency / expiryDate）。
--
-- 適用情境：Bug #8 修復不完整期間，user 做過 PUT 導致 settings 變成
--       ["{...step1...}", "{...step2...}", "{...step3...}"]。
--
-- 為什麼需要這個 migration 而非依賴 application defensive unwrap：
--   - application 修好後，現有 corrupted rows 不會自動修好
--   - user 一旦 PUT 沒 defensive unwrap 跑過，row 又壞一次
--   - 先用 migration 把現有 rows 修成 object，再用 application source fix 守護

UPDATE public.templates
SET settings = (
  CASE jsonb_typeof(settings)
    WHEN 'array' THEN (
      SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      FROM (
        SELECT
          kv.key,
          kv.value,
          row_number() OVER (PARTITION BY kv.key ORDER BY expanded.ord DESC) AS rn
        FROM (
          SELECT
            ord,
            CASE jsonb_typeof(elem)
              WHEN 'string' THEN ((elem #>> '{}')::jsonb)
              WHEN 'object' THEN elem
              ELSE '{}'::jsonb
            END AS parsed
          FROM jsonb_array_elements(settings) WITH ORDINALITY AS t(elem, ord)
        ) expanded
        CROSS JOIN LATERAL jsonb_each(expanded.parsed) AS kv(key, value)
      ) all_kv
      WHERE rn = 1
    )
    ELSE settings
  END
)
WHERE jsonb_typeof(settings) = 'array';

-- Verification helpers (optional, can be removed after confirm):
--   SELECT count(*) FROM templates WHERE jsonb_typeof(settings) = 'array';
--   SELECT count(*) FROM templates WHERE jsonb_typeof(settings) = 'object';
--   SELECT id, settings FROM templates WHERE jsonb_typeof(settings) = 'object' LIMIT 5;