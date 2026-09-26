/**
 * GiftCardLogic — Types
 *
 * @module CardBuilderEditor/Step6CardLogic/GiftCardLogic/GiftCardLogic.types
 */

export interface GiftCardLogicProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep6Valid()` so the user only sees red borders / messages
   * after they've tried to advance at least once.
   */
  showValidation: boolean;
}

export interface GiftCardAmountFieldProps {
  showValidation: boolean;
}

export interface GiftCardPointsFieldProps {
  showValidation: boolean;
}