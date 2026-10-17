-- Migration: 026_backfill_barcode_and_add_uri_columns
-- Desc: 2 段式 closure:
--   A. Production data cleanup — 把舊 rows 的 4 個 Passcreator placeholder
--      string 清成 NULL,順便加 CHECK 擋未來再寫
--   B. 補 schema — iPhoneUri / androidUri 兩個 column,讓 Passcreator V3
--      真實的 3 URI 都能存(Apple/Passwallet-only template 雖然沒
--      androidUri 商業用途,value 仍要存以保持 audit trail)
--
-- Decision: runs/decisions/2026-10-19-pass-holder-v3-jsonb-consolidation.md
--           § "決定:本 PR 做小 closure,Hybrid JSONB refactor 留
--             下次 L3 Heavy session"
--
-- Applied via: saome_supabase MCP apply_migration
-- Wrapped by:  Rule 035 + Rule 037(pre-listed tool call pattern)

-- A.1 Backfill — 把 4 個 placeholder collapse 成 NULL
UPDATE public.pass_holders
   SET barcode_value = NULL
 WHERE barcode_value IN (
   'no value given',
   'no value specified',
   'no barcode',
   ''
 );

-- A.2 CHECK constraint 防止未來再寫 placeholder(生產 environment 多
-- 一層 DB-level safety;前端 + 後端 parser + DB 三層 defense-in-depth)
ALTER TABLE public.pass_holders
  ADD CONSTRAINT pass_holders_barcode_value_no_placeholder_chk
    CHECK (
      barcode_value IS NULL
      OR barcode_value NOT IN (
        'no value given',
        'no value specified',
        'no barcode',
        ''
      )
    );

-- B.1 加 2 個 column
ALTER TABLE public.pass_holders
  ADD COLUMN IF NOT EXISTS iphone_uri  TEXT,
  ADD COLUMN IF NOT EXISTS android_uri TEXT;

-- Down migration (manual, 留 reference):
-- ALTER TABLE public.pass_holders
--   DROP COLUMN IF EXISTS android_uri,
--   DROP COLUMN IF EXISTS iphone_uri,
--   DROP CONSTRAINT IF EXISTS pass_holders_barcode_value_no_placeholder_chk;
-- UPDATE public.pass_holders
--    SET barcode_value = 'no value given'
--  WHERE TRUE;   -- ⚠️ 不可逆,只是說明語意