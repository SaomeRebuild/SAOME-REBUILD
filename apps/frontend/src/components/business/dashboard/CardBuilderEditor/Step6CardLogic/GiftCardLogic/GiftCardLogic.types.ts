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

// ===== 雙層 fence sub-component props (2026-10-20, PR 1 of 2) =====
export interface GiftCardDesignMinPointsFieldProps {
  showValidation: boolean;
}

export interface GiftCardDesignMaxPointsFieldProps {
  showValidation: boolean;
}

export interface GiftCardDesignLimitsSectionProps {
  showValidation: boolean;
}

// ===== 雙層 fence sub-component props (2026-10-20, PR 2 of 2) =====
export interface GiftCardCheckoutMinPointsFieldProps {
  showValidation: boolean;
}

export interface GiftCardCheckoutMaxPointsFieldProps {
  showValidation: boolean;
}

export interface GiftCardCheckoutMinAmountFieldProps {
  showValidation: boolean;
}

export interface GiftCardCheckoutMaxAmountFieldProps {
  showValidation: boolean;
}

export interface GiftCardCheckoutLimitsSectionProps {
  showValidation: boolean;
}