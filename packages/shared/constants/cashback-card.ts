/**
 * Cashback Card (現金回饋卡) constants — Step 6 (2026-09-11).
 *
 * @module shared/constants/cashback-card
 * @description Pure constants and bounds for the Cashback Card Logic editor.
 *
 * Differs from stamp_card and reward_card:
 *   - No "earning mode" switch (cashback is always spend-driven).
 *   - No point accrual (the result IS a percentage discount, not points).
 *   - Each tier is a flat rule: cumulative spend → cashback %.
 *   - thresholdSpend = 0 represents the "default tier" (everyone qualifies
 *     without needing to accumulate spending). This is intentional and
 *     distinguishes cashback from reward_card (where threshold > 0 always).
 *
 * Single source of truth (Rule 019 § 4.1). Both frontend UI store + components
 * and backend schema import from here so the field shape and limits stay in sync.
 *
 * Mirrors mu-plugins cashback card schema (see SAOME-Email-Engine/modules/email-campaign-runner.php
 * and related cashback-tier structures). For SAOME-REBUILD we keep the
 * shape intentionally minimal — only 3 fields per tier.
 */

/** Hard cap: max number of cashback tiers per card. */
export const MAX_CASHBACK_TIERS = 5;

/** Cashback tier name (e.g. "VIP", "金卡會員"). 40 chars matches PassCreator title cap. */
export const CASHBACK_TIER_NAME_MAX_LENGTH = 40;

/** Cashback percent: integer ∈ [1, 100]. 0 not allowed (no cashback = no point). */
export const CASHBACK_PERCENT_MIN = 1;
export const CASHBACK_PERCENT_MAX = 100;

/**
 * Cumulative spending threshold: ≥ 0 in store currency units.
 *
 * threshold = 0 represents the default tier (everyone qualifies without
 * needing to accumulate spending — "人人享有的基礎回饋"). This is a
 * legitimate, supported state, NOT an "unset" placeholder.
 *
 * threshold > 0 means the member must have spent at least this much to
 * qualify for the cashback % at this tier.
 */
export const CASHBACK_THRESHOLD_MIN = 0;
/** Practical UI cap. Backend zod schema does NOT cap (matches reward card). */
export const CASHBACK_THRESHOLD_MAX = 999_999_999;

/**
 * Cashback tier shape (mirrors mu-plugins cashback-tier structure).
 *
 * Required field semantics:
 *   - name: tier name shown on the pass. Required (NOT optional).
 *   - thresholdSpend: cumulative spending required to qualify. Required.
 *     0 is a legitimate value (= default tier, no accumulation needed).
 *   - cashbackPercent: cashback percentage 1-100 integer. Required.
 *
 * No maxDiscountAmount — cashback is a direct % rebate, NOT a cap'd
 * discount. Differs structurally from reward_card.
 */
export interface CashbackTierShape {
  /** Tier name shown on the pass (e.g. "VIP", "金卡會員"). */
  name: string;
  /**
   * Cumulative spending threshold (in store currency units).
   * 0 = default tier (everyone qualifies without accumulation).
   */
  thresholdSpend: number;
  /** Cashback percentage, integer in [1, 100]. */
  cashbackPercent: number;
}
