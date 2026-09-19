/**
 * CouponCardLogic — Types
 *
 * @module CardBuilderEditor/Step6CardLogic/CouponCardLogic/CouponCardLogic.types
 */

export interface CouponCardLogicProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep6Valid()` so the user only sees red borders / messages
   * after they've tried to advance at least once.
   */
  showValidation: boolean;
}

export interface CouponDiscountTypeFieldProps {
  showValidation: boolean;
}

export interface CouponDiscountAmountFieldProps {
  showValidation: boolean;
}

export interface CouponDiscountPercentFieldProps {
  showValidation: boolean;
}

export interface CouponIssueCountFieldProps {
  showValidation: boolean;
}
