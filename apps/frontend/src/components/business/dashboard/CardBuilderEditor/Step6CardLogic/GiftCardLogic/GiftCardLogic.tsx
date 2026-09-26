/**
 * GiftCardLogic — Step 6 sub-module for gift_card (禮品卡).
 *
 * 2026-09-27: New sub-module for gift_card editor. The simplest of the
 * Step 6 sub-modules structurally:
 *   - Single flat rule (X 元 = Y 點), no tier list
 *   - No accrual mode (gift card is spend-driven by definition)
 *   - No card-level expiry (gift cards have no time concept — Step 2
 *     hides PassValidDaysField + ExpiryDateField for gift_card, matching
 *     membership_card / discount_card / multipass behavior)
 *
 * Composes 3 sub-components in order (Rule 000 § A.1):
 *   1. <GiftCardAmountField /> — currency-aware number input (元 / NT$ / R)
 *   2. <GiftCardPointsField /> — number input (points, fixed unit)
 *   3. <GiftCardRatePreview /> — live "100 元 = 100 點" / "NT$100 = 100 pts"
 *                                (only renders when both fields are valid)
 *
 * Differences from CouponCardLogic (2026-09-19):
 *   - NO radio group — gift card has only one rule shape (no
 *     amount_off vs percent_off choice).
 *   - NO issue count — gift card doesn't track how many cards to issue
 *     (it's a single exchange rate, not a coupon batch).
 *
 * Differences from StampCardLogic (2026-09-07):
 *   - NO accrual mode picker (per_stamp / per_visit / per_spend).
 *   - NO reward type radio (amount_off / percent_off).
 *   - NO max-discount cap (gift card always gives points, not %).
 *
 * The parent (Step6CardLogic dispatcher) renders the card-type-specific
 * hero intro ("設定消費者用多少元購買多少點數") BEFORE this sub-module.
 * This sub-module only handles the form composition.
 *
 * Total main component budget: 100 lines (Rule 000 § A.2). Current: ~28 lines.
 */

import { GiftCardAmountField } from './GiftCardAmountField';
import { GiftCardPointsField } from './GiftCardPointsField';
import { GiftCardRatePreview } from './GiftCardRatePreview';
import type { GiftCardLogicProps } from './GiftCardLogic.types';

export function GiftCardLogic({ showValidation }: GiftCardLogicProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* 1. Amount field — always rendered.
          Default value: 1 (per GIFT_CARD_DEFAULT_AMOUNT, see shared/constants/gift-card.ts). */}
      <GiftCardAmountField showValidation={showValidation} />
      {/* 2. Points field — always rendered.
          Default value: 1 (per GIFT_CARD_DEFAULT_POINTS). */}
      <GiftCardPointsField showValidation={showValidation} />
      {/* 3. Live rate preview — only renders when both fields are valid
          (> 0, finite, integer). Defensive guard prevents "0 元 = 0 點"
          mid-edit noise. */}
      <GiftCardRatePreview />
    </div>
  );
}