/**
 * MembershipCardLogic — Types
 *
 * @module CardBuilderEditor/Step6CardLogic/MembershipCardLogic/MembershipCardLogic.types
 */

export interface MembershipCardLogicProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep6Valid()` so the user only sees red borders / messages
   * after they've tried to advance at least once.
   */
  showValidation: boolean;
}

export interface MembershipHasExpiryToggleProps {
  showValidation: boolean;
}

export interface MembershipTierListProps {
  showValidation: boolean;
}

export interface MembershipTierRowProps {
  showValidation: boolean;
  /** Stable id (from store) for React key + update targeting. */
  tierId: string;
}

export interface MembershipTierNameFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface MembershipTierDurationTypeFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface MembershipTierCostFieldProps {
  showValidation: boolean;
  tierId: string;
  /**
   * When `true`, the field is in "lifetime mode" — used when card-wide
   * `hasExpiry === false`. The field:
   *   - Is enabled regardless of `durationType` (which will be `null`).
   *   - Writes to `lifetimeCost` instead of `monthlyCost` / `yearlyCost`.
   *   - Shows a lifetime-specific label + placeholder + hint.
   *
   * 2026-09-13: Added because users clarified that even when selecting
   * "no expiry", the fee input must remain visible — tenants can sell
   * the right to a lifetime tier at a one-time price (consumer directly
   * purchases lifetime membership).
   *
   * When `false` (default), the field operates in monthly/yearly mode
   * based on the tier's `durationType`.
   */
  lifetimeMode?: boolean;
}

export interface MembershipTierRewardListProps {
  showValidation: boolean;
  tierId: string;
}

export interface MembershipTierRewardRowProps {
  showValidation: boolean;
  tierId: string;
  rewardId: string;
}

export interface MembershipTierRewardLabelFieldProps {
  showValidation: boolean;
  tierId: string;
  rewardId: string;
}

export interface MembershipTierRewardValueFieldProps {
  showValidation: boolean;
  tierId: string;
  rewardId: string;
}

// ===== Free Membership Card (2026-09-14) =====

/**
 * 免費會員卡專用期限模式選擇器（兩顆 radio）.
 * Renders in MembershipCardLogicFreeState's expiry section.
 */
export interface MembershipExpiryModeFieldProps {
  showValidation: boolean;
}

/**
 * 免費會員卡自訂天數輸入框 (membershipExpiryMode === 'custom_days' 時使用).
 * Renders only when the user picked 'custom_days' mode.
 */
export interface MembershipCustomExpiryDaysFieldProps {
  showValidation: boolean;
}

/**
 * 免費會員卡指定到期日輸入框 (membershipExpiryMode === 'specific_date' 時使用).
 * Renders only when the user picked 'specific_date' mode.
 */
export interface MembershipSpecificExpiryDateFieldProps {
  showValidation: boolean;
}