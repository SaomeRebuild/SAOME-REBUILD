/**
 * Stamp Card (集點卡) constants — Step 6 (2026-09-07).
 *
 * @module shared/constants/stamp-card
 * @description Pure constants and enums for the Stamp Card Logic editor.
 *
 * Mirrors mu-plugins `_stamp_accrual_type` (per_stamp / per_visit / per_spend)
 * and `_stamp_reward_tiers_json` (reward_type: order_amount_off / order_percent_off;
 * reward_value: number; max_discount_amount: number|null).
 *
 * Single source of truth (Rule 019 § 4.1). Both frontend UI store + components
 * and backend schema import from here so the field shape and limits stay in sync.
 *
 * Background:
 *   - ACCRUAL_MODES: mu-plugins uses `perSpend`, `perVisit`/`perVitis`, and an
 *     implicit manual "stamp" mode (operator-only). We rename to camelCase +
 *     stable enum (per_stamp / per_visit / per_spend) so the UI can switch on
 *     a single string. "per_stamp" is the operator-only manual stamping mode
 *     (no automatic earning logic; merchant adds stamps by hand).
 *   - REWARD_TYPES: amount_off = fixed discount ($10 off), percent_off =
 *     percentage discount (10% off) with optional ceiling via maxDiscountAmount.
 *   - REWARD_NAME_MAX_LENGTH: 40 chars matches PassCreator's `title` field
 *     cap; same as back-field labels so the visual rhythm is consistent.
 *   - REWARD_PERCENT_MIN/MAX: 1-100 inclusive; rewardValue for percent_off is
 *     a percentage, not a fraction.
 *   - MAX_DISCOUNT_AMOUNT_MIN/MAX: ceiling (in store currency units); null
 *     in the store represents "no ceiling" which we model as MAX_DISCOUNT_AMOUNT_MAX
 *     on the UI input cap.
 */

export const ACCRUAL_MODES = ['per_stamp', 'per_visit', 'per_spend'] as const;
export type AccrualMode = (typeof ACCRUAL_MODES)[number];

export const REWARD_TYPES = ['amount_off', 'percent_off'] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

/** Reward name (e.g. "10元折價活動", "$10 off coupon"). 40 chars matches PassCreator's `title` cap. */
export const REWARD_NAME_MAX_LENGTH = 40;

/** Percentage mode: rewardValue ∈ [1, 100] (1%-100%). */
export const REWARD_PERCENT_MIN = 1;
export const REWARD_PERCENT_MAX = 100;

/** Amount mode: rewardValue > 0 (any positive number; currency-agnostic). */
export const REWARD_AMOUNT_MIN = 0.01;

/** Percent mode ceiling: maxDiscountAmount ≥ 0 in store currency units. null = 無上限. */
export const MAX_DISCOUNT_AMOUNT_MIN = 0;
/** Practical UI cap (e.g. TWD 1,000,000). Backend zod schema does NOT cap — this is purely a UI input safeguard. */
export const MAX_DISCOUNT_AMOUNT_MAX = 1_000_000;

/** Cap for the `<input type="number">` step attribute. Decimal for amount, integer for percent. */
export const REWARD_AMOUNT_STEP = 1;
export const REWARD_PERCENT_STEP = 1;

/** Accrual threshold — per_visit: stampsPerVisitCount ∈ [STAMPS_PER_VISIT_MIN, ∞). Default 1. */
export const STAMPS_PER_VISIT_MIN = 1;
/** Accrual threshold — per_visit: stampsPerVisitStamps ∈ [STAMPS_PER_STAMPS_MIN, ∞). Default 1. */
export const STAMPS_PER_STAMPS_MIN = 1;

/** Accrual threshold — per_spend: stampsPerSpendAmount > 0. Currency-agnostic positive number. */
export const STAMPS_PER_SPEND_MIN = 0.01;
/** Accrual threshold — per_spend: stampsPerSpendStamps ∈ [STAMPS_PER_STAMPS_MIN, ∞). Default 1. */
export const STAMPS_PER_STAMPS_MIN_SPEND = 1;
