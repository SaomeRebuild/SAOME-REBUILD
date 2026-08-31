-- Migration: 013_recover_iconImage_for_card_2ca4b46c
-- Desc: 資料搶救 — 把 Bug #8.5 救援過程中遺失的 iconImage 補回單一 row。
--       原因：Migration 012 套用在 production row 2ca4b46c-... 時，雖然
--       synthetic 測試正確保留 element[0] 獨有的 iconImage，但實際 UPDATE
--       結果卻缺少 iconImage。Baseline query 確認 element[0] 確實有這個欄位。
--       推測原因：UPDATE 內 SET subquery 評 SRF (jsonb_array_elements) 在
--       production 環境的 binding 行為可能與 synthetic 測試不同。完整事故
--       紀錄待補進 runs/improvements/feedback/。
--
-- Recovery:
--   - 只 update 該 row，且只在 iconImage 缺失時（idempotent guard）
--   - iconImage 路徑從 R2 結構推導：<tenant>/<template>/icon.png
--     對應 baseline 觀察到的 element[0].iconImage 值

UPDATE public.templates
SET settings = settings || jsonb_build_object(
  'iconImage', 'efb3fbbc-0b7d-48f1-8e65-8bafa17e0893/2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3/icon.png'
)
WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3'
  AND jsonb_typeof(settings) = 'object'
  AND NOT (settings ? 'iconImage');

-- Verification:
--   SELECT id, settings, settings ? 'iconImage' AS has_iconImage
--     FROM public.templates WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
-- Expected: has_iconImage = true