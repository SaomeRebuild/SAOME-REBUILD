/**
 * Coupon Card (折價券) constants — Step 6 (2026-09-19).
 *
 * @module shared/constants/coupon-card
 * @description Pure constants and bounds for the Coupon Card Logic editor.
 *
 * Differs from discount_card (折扣卡):
 *   - Discount card is tiered-cumulative-spend → percentage reward structure;
 *     coupon card is a SINGLE flat rule (one coupon = one discount value).
 *   - Coupon card lets the user pick BETWEEN amount_off and percent_off
 *     via a radio group (mutually exclusive — switching clears the other).
 *   - Coupon card adds a card-level `couponIssueCount` (how many coupons to
 *     issue per redemption transaction, min 1, no upper cap per user
 *     decision 2026-09-19).
 *   - No tier list, no card-level expiry (coupon is per-use — the
 *     merchant-side validity window is implicit in the coupon batch).
 *
 * Single source of truth (Rule 019 § 4.1). Both frontend UI store + components
 * and backend schema import from here so the field shape and limits stay in sync.
 */

/** Discount type discriminator. Mirrors `rewardType` enum used in stamp/reward cards. */
export const COUPON_DISCOUNT_TYPES = ['amount_off', 'percent_off'] as const;
export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPES)[number];

/** Cash amount lower bound (≥ 1). No upper cap per user decision 2026-09-19. */
export const COUPON_AMOUNT_MIN = 1;

/** Discount percent: integer ∈ [1, 100]. 0 not allowed (no discount = no point). */
export const COUPON_PERCENT_MIN = 1;
export const COUPON_PERCENT_MAX = 100;

/** Issue count lower bound. 1 = single coupon per transaction. */
export const COUPON_ISSUE_COUNT_MIN = 1;

/**
 * Coupon card shape (flat, single rule).
 *
 * Required field semantics:
 *   - couponDiscountType: must be one of 'amount_off' | 'percent_off'.
 *     The two value fields are mutually exclusive — switching type clears
 *     the other (mirrors `setRewardType` clear behavior).
 *   - couponDiscountAmount: required IFF couponDiscountType === 'amount_off'.
 *     Number ≥ 1 in store currency units (元 for TWD, R for ZAR).
 *     null when type is 'percent_off'.
 *   - couponDiscountPercent: required IFF couponDiscountType === 'percent_off'.
 *     Integer ∈ [1, 100]. null when type is 'amount_off'.
 *   - couponIssueCount: integer ≥ 1. No upper cap.
 *     Default 1 = single coupon per transaction.
 */
export interface CouponCardShape {
  /** Discount type discriminator (amount_off | percent_off). */
  couponDiscountType: CouponDiscountType;
  /** Cash discount amount (only meaningful when couponDiscountType === 'amount_off'). null otherwise. */
  couponDiscountAmount: number | null;
  /** Discount percent (only meaningful when couponDiscountType === 'percent_off'). null otherwise. */
  couponDiscountPercent: number | null;
  /** How many coupons to issue per redemption transaction. Integer ≥ 1, no upper cap. */
  couponIssueCount: number;
}
