/**
 * Reward Card (獎勵卡) constants — Step 6 (2026-09-09).
 *
 * @module shared/constants/reward-card
 * @description Pure constants and enums for the Reward Card Logic editor.
 *
 * Mirrors mu-plugins `SAOME-Points-Engine/modules/cards/reward-card.php` earning mode
 * logic and `SAOME-Passcreator-Engine/modules/passcreator-reward-card.php` tier structure:
 *   - `_reward_program_type`: 'points' | 'spend' | 'visits'
 *   - `_reward_program_tiers_json`: array of {threshold_points, name, reward_type,
 *     reward_value, max_discount_amount}
 *
 * Single source of truth (Rule 019 § 4.1). Both frontend UI store + components
 * and backend schema import from here so the field shape and limits stay in sync.
 *
 * Design decisions:
 *   - EARNING_MODES: renamed from mu-plugins 'spend'/'visits'/'points' to camelCase
 *     for TypeScript convention. 'based_on_points' = custom-condition-driven earning
 *     (e.g. tasks, referrals), not tied to visit or spend events.
 *   - REWARD_TYPES: shared with stamp-card (amount_off / percent_off).
 *   - MAX_REWARD_TIERS = 5: hard cap per user spec 2026-09-09.
 *   - THRESHOLD bounds: points thresholds can be very large (e.g. 100000 pts);
 *     THRESHOLD_MAX = 999_999_999 covers practical use cases.
 *   - POINTS_PER_VISIT_MIN = 1: at least 1 point per visit.
 *   - POINTS_PER_SPEND_MIN_AMOUNT / POINTS_MIN: positive amount/points required.
 */

// ===== Earning Modes (reward card only — distinct from stamp's accrual modes) =====
export const EARNING_MODES = ['based_on_points', 'based_on_visits', 'based_on_spending'] as const;
export type EarningMode = (typeof EARNING_MODES)[number];

// ===== Reward Types — re-use stamp-card (same value set, same semantics) =====
// To avoid duplicate-export collisions at the shared/constants/index.ts barrel
// (Rule 019 § 4.1 — single source of truth), the reward-card module does NOT
// re-export REWARD_TYPES / RewardType / REWARD_AMOUNT_MIN / REWARD_PERCENT_*
// / MAX_DISCOUNT_AMOUNT_*. Consumers import them from `@saome/shared/constants`
// (which re-exports them via `./stamp-card`). This pins the constants to a
// single physical location — no chance of accidentally drift between the two
// card modules' enums or numeric bounds.

// ===== Hard caps (reward card only) =====
/** Hard cap: max number of reward tiers per card. */
export const MAX_REWARD_TIERS = 5;

/** Reward tier name (e.g. "1000點折抵10%"). 40 chars matches PassCreator title cap. */
export const REWARD_TIER_NAME_MAX_LENGTH = 40;

/** Threshold: points ∈ [1, THRESHOLD_MAX]. */
export const THRESHOLD_MIN = 1;
export const THRESHOLD_MAX = 999_999_999;

/** Based-on-visits: pointsPerVisit ∈ [POINTS_PER_VISIT_MIN, ∞). Default 1. */
export const POINTS_PER_VISIT_MIN = 1;

/** Based-on-spend: spend amount > 0 (currency-agnostic positive number). */
export const POINTS_PER_SPEND_MIN_AMOUNT = 0.01;
/** Based-on-spend: points earned per threshold ∈ [1, ∞). Default 1. */
export const POINTS_PER_SPEND_MIN_POINTS = 1;

/**
 * Reward tier shape (mirrors mu-plugins `passcreator-reward-card.php`
 * `saome_pe_reward_pick_current_tier()` output shape).
 *
 * 2026-09-09 mixed refactor: `earningMode` is CARD-WIDE (top-level,
 * driven by `<EarningModeField />` in `RewardCardLogic`). The earn RATE
 * fields (`pointsPerVisit` / `pointsPerSpendAmount` / `pointsPerSpendPoints`)
 * remain PER-TIER so each tier can configure a different earn rate under
 * the same card-wide mode (e.g. tier-1 = 1 visit = 1 point, tier-2 =
 * 1 visit = 2 points).
 *
 * Required field semantics:
 *   - name: tier name shown on the pass. Required (NOT optional).
 *   - threshold: points required to unlock this tier. Required (NOT optional).
 *   - rewardType / rewardValue: required because the editor initializes
 *     new tiers with these as null (placeholder) — but the type allows null
 *     to capture the "user hasn't picked yet" state.
 *   - maxDiscountAmount: optional (percent_off only; null = no cap).
 *   - pointsPerVisit: optional (null when earningMode is not 'based_on_visits'
 *     OR not yet filled). Driven by card-wide `earningMode`.
 *   - pointsPerSpendAmount / pointsPerSpendPoints: optional (null when
 *     earningMode is not 'based_on_spending' OR not yet filled). Driven
 *     by card-wide `earningMode`.
 *
 * `earningMode` was REMOVED from per-tier scope (2026-09-09). It now lives
 * at top-level on the templateSettings (one mode per card). Old DB rows
 * with per-tier earningMode are tolerated by `loadSettings` (hoisted to
 * tier[0] then promoted to top-level on next save).
 */
export interface RewardTierShape {
  /** Tier name shown on the pass (e.g. "1000點折抵10%"). */
  name: string;
  /**
   * Points threshold: member must have ≥ this many points to unlock the tier.
   * Corresponds to mu-plugins `threshold_points`.
   */
  threshold: number;
  /**
   * Reward type: fixed cash discount (amount_off) or percentage discount (percent_off).
   * Corresponds to mu-plugins `reward_type` (order_amount_off / order_percent_off).
   * Note: this type is structurally identical to stamp-card's RewardType
   * (the enum values are the same) but is re-declared here as a type literal
   * to keep the module self-contained for downstream consumers.
   */
  rewardType: 'amount_off' | 'percent_off';
  /**
   * Reward value: currency amount (amount_off) or percentage integer (percent_off).
   * Corresponds to mu-plugins `reward_value`.
   */
  rewardValue: number;
  /**
   * Max discount amount per transaction (percent_off only; null = no cap).
   * Corresponds to mu-plugins `max_discount_amount`.
   */
  maxDiscountAmount: number | null;
  /**
   * 此 tier 每次拜訪獲得的點數 (only meaningful when card-wide
   * `earningMode === 'based_on_visits'`). null = 未填.
   * 2026-09-09: 保留 per-tier（不同 tier 可有不同 earn rate）。
   */
  pointsPerVisit?: number | null;
  /**
   * 此 tier 消費門檻金額 (only meaningful when card-wide
   * `earningMode === 'based_on_spending'`). null = 未填.
   * 2026-09-09: 保留 per-tier.
   */
  pointsPerSpendAmount?: number | null;
  /**
   * 此 tier 每次獲得的點數 (only meaningful when card-wide
   * `earningMode === 'based_on_spending'`). null = 未填.
   * 2026-09-09: 保留 per-tier.
   */
  pointsPerSpendPoints?: number | null;
}
