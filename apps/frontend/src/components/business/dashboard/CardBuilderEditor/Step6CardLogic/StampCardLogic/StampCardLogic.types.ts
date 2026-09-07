/**
 * StampCardLogic — Types
 *
 * @module CardBuilderEditor/Step6CardLogic/StampCardLogic/StampCardLogic.types
 */

export interface StampCardLogicProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep6Valid()` so the user only sees red borders / messages
   * after they've tried to advance at least once.
   */
  showValidation: boolean;
}

export interface StampAccrualModeFieldProps {
  showValidation: boolean;
}

export interface RewardNameFieldProps {
  showValidation: boolean;
}

export interface RewardTypeFieldProps {
  showValidation: boolean;
}

export interface RewardValueFieldProps {
  showValidation: boolean;
}

export interface MaxDiscountAmountFieldProps {
  showValidation: boolean;
}

export interface AccrualThresholdFieldProps {
  showValidation: boolean;
}
