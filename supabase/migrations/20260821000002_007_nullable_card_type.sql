-- Step 1: Make templates.card_type nullable + update CHECK constraint
--
-- Background: All orphan draft templates have card_type='stamp_card' (the default),
-- but this is a placeholder — the user never actually selected a card type.
-- Making card_type nullable allows analytics to filter with:
--   WHERE card_type IS NOT NULL
-- for a clean view of "real" cards.
--
-- Refs: runs/improvements/feedback/20260821-draft-template-orphan-cleanup.md § Option B

-- 1. Drop NOT NULL constraint on card_type
ALTER TABLE public.templates
ALTER COLUMN card_type DROP NOT NULL;

-- 2. Drop old CHECK constraint (existing: = ANY ARRAY[...])
ALTER TABLE public.templates
DROP CONSTRAINT IF EXISTS templates_card_type_check;

-- 3. Add new CHECK constraint allowing NULL + all known card types
ALTER TABLE public.templates
ADD CONSTRAINT templates_card_type_check
  CHECK (
    card_type IS NULL OR card_type = ANY (ARRAY[
      'stamp_card',
      'cashback_card',
      'reward_card',
      'membership_card',
      'discount_card',
      'coupon_card',
      'multipass',
      'gift_card'
    ]::text[])
  );
