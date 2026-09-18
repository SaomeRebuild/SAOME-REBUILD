/**
 * DiscountCardLogic — Types
 *
 * @module CardBuilderEditor/Step6CardLogic/DiscountCardLogic/DiscountCardLogic.types
 */

export interface DiscountCardLogicProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep6Valid()` so the user only sees red borders / messages
   * after they've tried to advance at least once.
   */
  showValidation: boolean;
}

export interface DiscountTierListProps {
  showValidation: boolean;
}

export interface DiscountTierRowProps {
  showValidation: boolean;
  /** Stable id (from store) for React key + update targeting. */
  tierId: string;
}

export interface DiscountTierNameFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface DiscountTierThresholdFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface DiscountTierPercentFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface DiscountExpiryFieldsProps {
  showValidation: boolean;
}

/**
 * DiscountCustomExpiryDaysField is a controlled component. The parent
 * (DiscountExpiryFields) provides `value` and `onChange` so it can
 * enforce mutual exclusion with DiscountSpecificExpiryDateField — when
 * the user types a days value, the parent clears the date field (and
 * vice versa).
 */
export interface DiscountCustomExpiryDaysFieldProps {
  showValidation: boolean;
  /** Current days value from store; null = user hasn't entered anything yet. */
  value: number | null;
  /** Called with the new days value or null (when input cleared). */
  onChange: (days: number | null) => void;
}

/**
 * DiscountSpecificExpiryDateField is a controlled component. Same
 * pattern as DiscountCustomExpiryDaysFieldProps — parent owns mutual
 * exclusion with the days field.
 */
export interface DiscountSpecificExpiryDateFieldProps {
  showValidation: boolean;
  /** Current ISO YYYY-MM-DD date string from store; null = user hasn't picked a date yet. */
  value: string | null;
  /** Called with the new ISO date string or null (when input cleared). */
  onChange: (date: string | null) => void;
}
