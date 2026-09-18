/**
 * Discount Card (折扣卡) constants — Step 6 (2026-09-18).
 *
 * @module shared/constants/discount-card
 * @description Pure constants and bounds for the Discount Card Logic editor.
 *
 * Differs from cashback_card (現金回饋卡):
 *   - Both are tiered-cumulative-spend → percentage reward structures.
 *   - discount_card gives the customer a DISCOUNT (pays less); cashback
 *     gives them CASHBACK (refund after purchase).
 *   - Same field shape (`name` + `thresholdSpend` + `discountPercent`)
 *     but a different semantic — the percent reduces the purchase price
 *     instead of returning value after the purchase.
 *
 * Optional card-level expiry (`discountCustomExpiryDays` /
 * `discountSpecificExpiryDate`) follows the membership expiry pattern
 * (mutually exclusive, no toggle). Both are nullable; field handler
 * clears the other when one is set.
 *
 * Single source of truth (Rule 019 § 4.1). Both frontend UI store + components
 * and backend schema import from here so the field shape and limits stay in sync.
 */

/** Hard cap: max number of discount tiers per card. */
export const MAX_DISCOUNT_TIERS = 5;

/** Discount tier name (e.g. "金級", "VIP"). 40 chars matches PassCreator title cap. */
export const DISCOUNT_TIER_NAME_MAX_LENGTH = 40;

/** Discount percent: integer ∈ [1, 100]. 0 not allowed (no discount = no point). */
export const DISCOUNT_PERCENT_MIN = 1;
export const DISCOUNT_PERCENT_MAX = 100;

/**
 * Cumulative spending threshold: ≥ 0 in store currency units.
 *
 * threshold = 0 represents the default tier (everyone qualifies without
 * needing to accumulate spending — "人人享有的基礎折扣"). This is a
 * legitimate, supported state, NOT an "unset" placeholder.
 *
 * threshold > 0 means the member must have spent at least this much to
 * qualify for the discount % at this tier.
 */
export const DISCOUNT_THRESHOLD_MIN = 0;
/** Practical UI cap. Backend zod schema does NOT cap (matches cashback reward card). */
export const DISCOUNT_THRESHOLD_MAX = 999_999_999;

/** Card-level custom expiry days (mirrors membership expiry bounds). */
export const DISCOUNT_CUSTOM_EXPIRY_DAYS_MIN = 1;
/** 10 years — matches membership expiry ceiling. */
export const DISCOUNT_CUSTOM_EXPIRY_DAYS_MAX = 3650;

/**
 * Discount tier shape (mirrors cashback tier structure).
 *
 * Required field semantics:
 *   - name: tier name shown on the pass. Required (NOT optional).
 *   - thresholdSpend: cumulative spending required to qualify. Required.
 *     0 is a legitimate value (= default tier, no accumulation needed).
 *   - discountPercent: discount percentage 1-100 integer. Required.
 */
export interface DiscountTierShape {
  /** Tier name shown on the pass (e.g. "金級", "VIP"). 1-40 chars. */
  name: string;
  /**
   * Cumulative spending threshold (in store currency units).
   * 0 = default tier (everyone qualifies without accumulation).
   */
  thresholdSpend: number;
  /** Discount percentage, integer in [1, 100]. */
  discountPercent: number;
}
