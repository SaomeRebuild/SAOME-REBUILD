/**
 * GiftCardLogic — Barrel export
 *
 * @module CardBuilderEditor/Step6CardLogic/GiftCardLogic
 *
 * 2026-09-27: New sub-module for gift_card (禮品卡). Eighth Step 6 sub-module
 * after StampCardLogic / RewardCardLogic / CashbackCardLogic /
 * MembershipCardLogic / DiscountCardLogic / CouponCardLogic /
 * MultipassCardLogic.
 */

export { GiftCardLogic } from './GiftCardLogic';
export { GiftCardAmountField } from './GiftCardAmountField';
export { GiftCardPointsField } from './GiftCardPointsField';
export { GiftCardRatePreview } from './GiftCardRatePreview';
// ===== 雙層 fence 新 component barrel (2026-10-20, PR 1 of 2) =====
export { GiftCardDesignLimitsSection } from './GiftCardDesignLimitsSection';
export { GiftCardDesignMinPointsField } from './GiftCardDesignMinPointsField';
export { GiftCardDesignMaxPointsField } from './GiftCardDesignMaxPointsField';
// ===== 雙層 fence 新 component barrel (2026-10-20, PR 2 of 2) =====
export { GiftCardCheckoutLimitsSection } from './GiftCardCheckoutLimitsSection';
export { GiftCardCheckoutMinPointsField } from './GiftCardCheckoutMinPointsField';
export { GiftCardCheckoutMaxPointsField } from './GiftCardCheckoutMaxPointsField';
export { GiftCardCheckoutMinAmountField } from './GiftCardCheckoutMinAmountField';
export { GiftCardCheckoutMaxAmountField } from './GiftCardCheckoutMaxAmountField';
export type {
  GiftCardLogicProps,
  GiftCardAmountFieldProps,
  GiftCardPointsFieldProps,
  GiftCardDesignLimitsSectionProps,
  GiftCardDesignMinPointsFieldProps,
  GiftCardDesignMaxPointsFieldProps,
  GiftCardCheckoutLimitsSectionProps,
  GiftCardCheckoutMinPointsFieldProps,
  GiftCardCheckoutMaxPointsFieldProps,
  GiftCardCheckoutMinAmountFieldProps,
  GiftCardCheckoutMaxAmountFieldProps,
} from './GiftCardLogic.types';