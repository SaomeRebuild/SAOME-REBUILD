/**
 * CouponCardLogic — Step 6 sub-module for coupon_card (折價券).
 *
 * 2026-09-19: New sub-module for coupon_card editor.
 *
 * Composes 4 top-level sub-components in order (Rule 000 § A.1):
 *   1. <CouponDiscountTypeField />   — radio group (amount_off | percent_off).
 *                                       Switching type clears the corresponding
 *                                       other value field (store setter enforces).
 *   2. <CouponDiscountAmountField /> — conditional render (amount_off only).
 *                                       Currency-aware number input 元/R.
 *   3. <CouponDiscountPercentField /> — conditional render (percent_off only).
 *                                       Integer ∈ [1, 100].
 *   4. <CouponIssueCountField />     — always rendered.
 *                                       Integer ≥ 1, no upper cap.
 *
 * Differences from DiscountCardLogic:
 *   - NO tier list — coupon is a single flat rule (one coupon = one discount).
 *   - NO card-level expiry — coupon is per-use (validity window is implicit
 *     in the coupon batch, not in card settings).
 *   - Adds `couponIssueCount` — how many coupons to issue per transaction.
 *
 * Differences from CashbackCardLogic:
 *   - Discount type is radio-selected (not always % as in cashback).
 *   - NO tier list / cumulative spend threshold.
 *
 * The parent (Step6CardLogic dispatcher) is responsible for prev/next buttons
 * in CardBuilderEditorWorkspace.
 *
 * Total main component budget: 100 lines (Rule 000 § A.2). Current: ~25 lines.
 */

import { CouponDiscountTypeField } from './CouponDiscountTypeField';
import { CouponDiscountAmountField } from './CouponDiscountAmountField';
import { CouponDiscountPercentField } from './CouponDiscountPercentField';
import { CouponIssueCountField } from './CouponIssueCountField';
import type { CouponCardLogicProps } from './CouponCardLogic.types';

export function CouponCardLogic({ showValidation }: CouponCardLogicProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* 1. Discount type radio group — always rendered.
          Defaults to 'amount_off' per user decision 2026-09-19. */}
      <CouponDiscountTypeField showValidation={showValidation} />
      {/* 2. Conditional cash discount amount — only when couponDiscountType === 'amount_off'. */}
      <CouponDiscountAmountField showValidation={showValidation} />
      {/* 3. Conditional percent discount — only when couponDiscountType === 'percent_off'. */}
      <CouponDiscountPercentField showValidation={showValidation} />
      {/* 4. Issue count — always rendered. */}
      <CouponIssueCountField showValidation={showValidation} />
    </div>
  );
}
