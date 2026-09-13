/**
 * Membership Card (會員卡) constants — Step 6 (2026-09-13).
 *
 * @module shared/constants/membership-card
 * @description Pure constants and bounds for the Membership Card Logic editor.
 *
 * Differs from stamp_card / reward_card / cashback_card:
 *   - Card-wide `hasExpiry` toggle (none / with expiry). All tiers share the
 *     same expiry setting.
 *   - Each tier carries durationType (monthly / yearly / null) + monthlyCost
 *     / yearlyCost (currency-agnostic, store-level currency applies).
 *   - Per-tier "會員獎勵" sub-rows (label + value pairs), up to 5 per tier.
 *   - cost = 0 is allowed (= "free" member tier, e.g. free VIP).
 *
 * Single source of truth (Rule 019 § 4.1). Both frontend UI store + components
 * and backend schema import from here so the field shape and limits stay in sync.
 */

/** Hard cap: max number of membership tiers per card. */
export const MAX_MEMBERSHIP_TIERS = 5;

/** Hard cap: max number of 會員獎勵 sub-rows per membership tier. */
export const MAX_REWARDS_PER_TIER = 5;

/** Tier name (e.g. "VIP", "金卡會員"). 40 chars matches PassCreator title cap. */
export const TIER_NAME_MAX_LENGTH = 40;

/** Per-tier reward label (e.g. "免費升等"). 20 chars matches PassKit field cap. */
export const REWARD_LABEL_MAX_LENGTH = 20;

/** Per-tier reward value (e.g. "https://example.com/vip"). 80 chars. */
export const REWARD_VALUE_MAX_LENGTH = 80;

/**
 * Cost bounds — applied to BOTH `monthlyCost` and `yearlyCost`.
 * cost = 0 is a LEGITIMATE value (= "free" member tier). cost < 0 is invalid.
 */
export const COST_MIN = 0;
/** Practical UI cap. Backend zod schema does NOT cap (matches cashback card). */
export const COST_MAX = 9_999_999;

/**
 * Duration type. `null` represents "未設定" (only meaningful when
 * card-wide `hasExpiry === true`; otherwise both monthly/yearly costs are
 * hidden). Tier carries the duration type so the editor can show
 * monthly vs yearly pricing per tier.
 */
export type DurationType = 'monthly' | 'yearly';

/**
 * 會員獎勵 row shape — `{ label, value }` pair.
 * label = user-facing short label (e.g. "專屬優惠").
 * value = user-facing value (e.g. URL, plain text).
 *
 * Mirrors `LabelValuePair` used in Step 4 back fields / links — same shape.
 */
export interface MembershipRewardShape {
  /** Stable id (React key + update targeting). UI-only — stripped on save. */
  id: string;
  /** Short label. 1-20 chars per REWARD_LABEL_MAX_LENGTH. */
  label: string;
  /** Display value. 1-80 chars per REWARD_VALUE_MAX_LENGTH. */
  value: string;
}

/**
 * Membership tier shape.
 *
 * Field semantics:
 *   - name: tier name shown on the pass. Required (NOT optional).
 *   - durationType: 'monthly' | 'yearly' | null.
 *     `null` is legitimate when card-wide `hasExpiry === false` (no expiry).
 *     When `hasExpiry === true`, each tier must have a non-null durationType.
 *   - monthlyCost: cost when durationType === 'monthly' (0 = free).
 *   - yearlyCost: cost when durationType === 'yearly' (0 = free).
 *     The monthlyCost / yearlyCost fields are ignored when hasExpiry === false
 *     (lifetime mode); the editor hides the duration radio + these two fields
 *     in that case.
 *   - lifetimeCost: cost when card-wide hasExpiry === false (0 = free).
 *     Tenants can sell the right to a lifetime membership tier at this
 *     one-time price. The editor hides this field when hasExpiry === true
 *     and hides the duration radio + monthlyCost/yearlyCost when
 *     hasExpiry === false — only ONE of the two cost sets is meaningful
 *     for a given tier depending on the card-wide toggle.
 *     Allowed values: ≥ COST_MIN (= 0, free member) or null (not entered).
 *     The store guard clamps to [COST_MIN, COST_MAX].
 *   - rewards: per-tier 會員獎勵 sub-rows (label + value pairs). Optional,
 *     capped at MAX_REWARDS_PER_TIER=5 per tier.
 *
 * 2026-09-13: lifetimeCost added. Reason: tenants need to sell the right
 * to a lifetime tier directly (one-time purchase) — the previous design
 * only allowed monthly/yearly cost which made lifetime purchases impossible.
 * The cost field stays visible in lifetime mode but writes to lifetimeCost
 * (a separate column) instead of monthlyCost/yearlyCost.
 */
export interface MembershipTierShape {
  /** Stable id (React key + update targeting). UI-only — stripped on save. */
  id: string;
  /** Tier name shown on the pass (e.g. "VIP", "金卡會員"). 1-40 chars. */
  name: string;
  /** Duration type: monthly / yearly. null = no expiry set on this tier. */
  durationType: DurationType | null;
  /** Cost when durationType === 'monthly'. null = 未填. Ignored in lifetime mode. */
  monthlyCost: number | null;
  /** Cost when durationType === 'yearly'. null = 未填. Ignored in lifetime mode. */
  yearlyCost: number | null;
  /** Cost when card-wide hasExpiry === false (lifetime). null = 未填. Ignored when hasExpiry === true. */
  lifetimeCost: number | null;
  /** Per-tier 會員獎勵 sub-rows. Optional. */
  rewards: MembershipRewardShape[];
}