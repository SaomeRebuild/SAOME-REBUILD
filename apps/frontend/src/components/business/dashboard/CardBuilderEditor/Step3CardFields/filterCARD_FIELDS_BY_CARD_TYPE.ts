/**
 * CardFieldKey — display field filter helpers.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE
 *
 * Pure helper functions for selecting which `CARD_FIELDS` entries should
 * be shown in the Step 3 left/right field dropdown, based on the current
 * `cardType`. Kept in its own file so that `Step3CardFields/index.tsx`
 * can stay a "components-only" file (the
 * `react(only-export-components)` lint rule requires components to be the
 * sole export of a module so React Fast Refresh works correctly).
 *
 * See: https://github.com/oxlint/oxlint/blob/main/src/rules/react/only_export_components.rs
 */

import { CARD_FIELDS, type CardFieldDefinition } from '@saome/shared/constants/card-fields';
import type { CardType } from '@saome/shared/schemas/card';

/**
 * Card types for which the stamp-only display fields (availableRewards /
 * totalStamps / stampsRemaining) are shown in the dropdown.
 *
 * Scope: stamp_card only. multipass is now decoupled and uses its own
 * MULTIPASS_CARD_TYPES set — stamp_card and multipass no longer share
 * this group. Any future changes to stamp fields will not affect multipass.
 *
 * Mirrors the conditional render guard used in `CardBuilderEditorWorkspace`
 * for `<Step3StampGrid />` — both are driven by the same `cardType` value,
 * so the user sees the stamp fields only when the stamp grid section is
 * also visible. Keeping this set local to this module (rather than imported
 * from a shared module) avoids a cross-module coupling for a 2-element
 * constant.
 */
export const STAMP_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'stamp_card',
]);

/**
 * Card types for which the multipass-only display fields are shown in the
 * dropdown.
 *
 * Decoupled from STAMP_CARD_TYPES on 2026-09-20 (direction 1 of the
 * multipass-stamp_card decoupling plan). multipass has its own field
 * structure and should not inherit stamp_card fields.
 */
export const MULTIPASS_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'multipass',
]);

/**
 * Card types for which the reward-only display fields (pointsToNextTier /
 * currentPoints) are shown in the dropdown.
 *
 * Scope is intentionally narrower than STAMP_CARD_TYPES: only
 * `reward_card` gets the points-related fields. `multipass` does NOT
 * share this group — it is now decoupled (MULTIPASS_CARD_TYPES) and will
 * have its own field structure. The two systems (stamps vs points) are
 * conceptually distinct; the user's UX intent was confirmed to keep the
 * reward fields scoped to `reward_card` only (matches the Step 6
 * RewardTierRow dispatcher guard at `Step6CardLogic.tsx`).
 */
export const REWARD_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'reward_card',
]);

/**
 * Card types for which the cashback-only display fields
 * (pointsToNextTierCashback / accumulatedSpendCashback) are shown in the
 * dropdown.
 *
 * Cashback-specific data (spend to next tier, accumulated spend) is
 * meaningless on non-cashback cards, so these options are hidden rather than
 * rendered as a confusing placeholder.
 */
export const CASHBACK_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'cashback_card',
]);

/**
 * Card types for which the discount-only display fields
 * (pointsToNextTierDiscount / discountTierBracket / accumulatedSpendDiscount)
 * are shown in the dropdown.
 *
 * Discount-specific data (spend to next discount tier, accumulated spend,
 * current discount %) is meaningless on non-discount cards, so these
 * options are hidden rather than rendered as a confusing placeholder.
 *
 * Scoped to `discount_card` only (user-confirmed scope, mirrors the
 * REWARD / CASHBACK pattern).
 */
export const DISCOUNT_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'discount_card',
]);

/**
 * Card types for which the coupon-only display fields
 * (couponRemainingCount / couponDiscount) are shown in the dropdown.
 *
 * Coupon-specific data (remaining count, discount offer) is meaningless
 * on non-coupon cards, so these options are hidden rather than rendered
 * as a confusing placeholder.
 *
 * Scoped to `coupon_card` only (mirrors the REWARD / CASHBACK / DISCOUNT
 * pattern). The `memberLevel` field also gets a reciprocal opt-out via
 * `hideOnCardTypes: ['coupon_card']` in card-fields.ts — coupon cards are
 * not tier-driven so the "會員等級" option is hidden to avoid confusing
 * the user about a hierarchy that does not exist.
 */
export const COUPON_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'coupon_card',
]);

/**
 * Decide which `CARD_FIELDS` entries are visible for the given card type.
 *
 * - 'common' group fields are shown UNLESS they opt out via
 *   `hideOnCardTypes` (e.g. `memberName` is hidden for `membership_card`,
 *   per plan `membership_card_conditional_ui_hide`, 2026-09-13;
 *   `memberLevel` is hidden for `coupon_card`, 2026-09-19).
 * - 'stamp' group fields are shown only when cardType ∈ STAMP_CARD_TYPES.
 * - 'multipass' group fields are shown only when cardType ∈ MULTIPASS_CARD_TYPES.
 *   (Decoupled from stamp on 2026-09-20 — multipass has its own field group.)
 * - 'reward' group fields are shown only when cardType ∈ REWARD_CARD_TYPES.
 * - 'cashback' group fields are shown only when cardType ∈ CASHBACK_CARD_TYPES.
 * - 'discount' group fields are shown only when cardType ∈ DISCOUNT_CARD_TYPES.
 * - 'coupon' group fields are shown only when cardType ∈ COUPON_CARD_TYPES.
 *
 * The function is pure and exported so the conformance test
 * (`Step3CardFields/index.test.tsx`) can assert the filter directly
 * without needing to mock the store. Returns full `CardFieldDefinition`
 * entries (including `labelKey`) so the consumer can pass the array
 * straight through to `<FieldSelect>`.
 *
 * Store semantics: filtering only affects the dropdown options — the
 * stored `leftField` / `rightField` values are NOT cleared if a user
 * switches card type and the previously-picked field becomes hidden.
 * (Same "no silent data loss" guarantee as the existing stamp_group
 * filter.)
 */
export function filterCARD_FIELDS_BY_CARD_TYPE(
  cardType: CardType | null,
): readonly CardFieldDefinition[] {
  const showStampGroup = cardType !== null && STAMP_CARD_TYPES.has(cardType);
  const showMultipassGroup = cardType !== null && MULTIPASS_CARD_TYPES.has(cardType);
  const showRewardGroup = cardType !== null && REWARD_CARD_TYPES.has(cardType);
  const showCashbackGroup = cardType !== null && CASHBACK_CARD_TYPES.has(cardType);
  const showDiscountGroup = cardType !== null && DISCOUNT_CARD_TYPES.has(cardType);
  const showCouponGroup = cardType !== null && COUPON_CARD_TYPES.has(cardType);
  return CARD_FIELDS.filter((f) => {
    // Step 1: group-level gate (stamp / multipass / reward / cashback / discount / coupon conditional).
    const groupOk =
      f.group === 'common' ||
      (f.group === 'stamp' && showStampGroup) ||
      (f.group === 'multipass' && showMultipassGroup) ||
      (f.group === 'reward' && showRewardGroup) ||
      (f.group === 'cashback' && showCashbackGroup) ||
      (f.group === 'discount' && showDiscountGroup) ||
      (f.group === 'coupon' && showCouponGroup);
    if (!groupOk) return false;

    // Step 2: per-field hideOnCardTypes opt-out (e.g. memberName is
    // hidden for membership_card; memberLevel is hidden for coupon_card).
    // Defaults to no exclusion — fields without `hideOnCardTypes` pass
    // through unchanged. When cardType is null (Step 1 not yet completed),
    // `includes(null)` is a no-op and the field is shown.
    if (!f.hideOnCardTypes || f.hideOnCardTypes.length === 0) return true;
    return !(cardType !== null && f.hideOnCardTypes.includes(cardType));
  });
}
