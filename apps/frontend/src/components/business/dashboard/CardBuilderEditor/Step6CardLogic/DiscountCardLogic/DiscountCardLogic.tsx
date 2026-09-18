/**
 * DiscountCardLogic — Step 6 sub-module for discount_card (折扣卡).
 *
 * Composes 2 top-level sub-components in order (user clarification 2026-09-18):
 *   1. <DiscountExpiryFields />     — card-level expiry section (REQUIRED:
 *                                      custom days OR specific date; at least
 *                                      one must be filled; if user does not
 *                                      want expiry they should pick Cashback
 *                                      card instead).
 *   2. <DiscountTierList />         — list of up to 5 discount tiers (each row
 *                                      contains its own name + thresholdSpend +
 *                                      discountPercent fields).
 *
 * The expiry section is placed BEFORE the tier list (not below it) so the
 * card's lifetime context is visible before the discount rule rows — visual
 * hierarchy reads "what is this card / when does it expire / how is it
 * discounted".
 *
 * Differences from CashbackCardLogic:
 *   - The percent field is `discountPercent` (not `cashbackPercent`).
 *   - Adds a REQUIRED card-level expiry section (custom days OR specific
 *     date). Mutually exclusive — both fields always visible, only one
 *     can be filled at a time (field handler clears the other).
 *   - No cashback-equivalent "no expiry" sentinel — discount cards MUST
 *     have an expiry; users who don't want one should design a Cashback
 *     card instead (per user clarification 2026-09-18).
 *   - Default 1 tier row (matches user requirement "預設一個 row"). The
 *     store's `removeDiscountTier` re-adds 1 default tier if the array
 *     becomes empty; the auto-add useEffect in this component is a
 *     defense-in-depth in case the store is bypassed.
 *
 * The parent (Step6CardLogic dispatcher) is responsible for prev/next buttons
 * in CardBuilderEditorWorkspace.
 *
 * Total discount tiers are bounded by MAX_DISCOUNT_TIERS=5 (Rule 019 § 4.1
 * mirror of `shared/constants/discount-card.ts`).
 */

import { useEffect } from 'react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { DiscountTierList } from './DiscountTierList';
import { DiscountExpiryFields } from './DiscountExpiryFields';
import type { DiscountCardLogicProps } from './DiscountCardLogic.types';

export function DiscountCardLogic({ showValidation }: DiscountCardLogicProps) {
  const discountTiers = useCardBuilderStore((s) => s.discountTiers);
  const addDiscountTier = useCardBuilderStore((s) => s.addDiscountTier);

  // Auto-add default tier if the array is somehow empty (defense-in-depth).
  // The store's `removeDiscountTier` re-adds 1 default tier when the array
  // becomes empty, but this useEffect guards against external corruption
  // (e.g. malformed DB row during initial load) so the UI always shows
  // at least 1 tier row.
  useEffect(() => {
    if (discountTiers.length === 0) {
      addDiscountTier();
    }
  }, [discountTiers.length, addDiscountTier]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Card-level expiry section (required: at least one of custom days OR
          specific date must be filled; user clarification 2026-09-18). Placed
          BETWEEN the card description (rendered by the Step6CardLogic
          dispatcher above this component) AND the discount tier list below
          — matches the visual hierarchy "what is this card" → "when does it
          expire" → "how is it discounted". */}
      <DiscountExpiryFields showValidation={showValidation} />
      {/* Discount tier list — up to 5 tiers. Each tier has name + thresholdSpend
          (0 = default tier) + discountPercent (1-100). */}
      <DiscountTierList showValidation={showValidation} />
    </div>
  );
}
