/**
 * CashbackCardLogic — Types
 *
 * @module CardBuilderEditor/Step6CardLogic/CashbackCardLogic/CashbackCardLogic.types
 */

export interface CashbackCardLogicProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep6Valid()` so the user only sees red borders / messages
   * after they've tried to advance at least once.
   */
  showValidation: boolean;
}

export interface CashbackTierListProps {
  showValidation: boolean;
}

export interface CashbackTierRowProps {
  showValidation: boolean;
  /** Stable id (from store) for React key + update targeting. */
  tierId: string;
}

export interface CashbackTierNameFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface CashbackTierThresholdFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface CashbackTierPercentFieldProps {
  showValidation: boolean;
  tierId: string;
}
