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