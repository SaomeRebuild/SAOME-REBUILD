-- Migration: 014_reapply_merge_with_iconImage_in_latest_element
-- Desc: 第二次套 012 的 merge — 因 012 第一次套時 element[0] 的 iconImage
--       已被瀏覽器 auto-save 剝離（這次 element[1] 反而有 iconImage）。
--       012 邏輯 OK 但當時資料已被改寫；現在重跑 014 把 array 再轉成 object，
--       因為 iconImage 已經在 element[1]，merge 結果會保留 iconImage。
-- Idempotent: WHERE filter 只處理 jsonb 為 array 的 rows。

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