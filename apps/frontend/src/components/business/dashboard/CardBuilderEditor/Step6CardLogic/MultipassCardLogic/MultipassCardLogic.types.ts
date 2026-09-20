/**
 * MultipassCardLogic — Types
 *
 * @module CardBuilderEditor/Step6CardLogic/MultipassCardLogic/MultipassCardLogic.types
 *
 * Mirrors DiscountCardLogic.types.ts structure (2026-09-19 PR-3 split out
 * from StampCardLogic). Each sub-component receives `showValidation` + a
 * stable `tierId` for store lookups / React keys.
 */

export interface MultipassCardLogicProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep6Valid()` so the user only sees red borders / messages
   * after they've tried to advance at least once.
   */
  showValidation: boolean;
}

// ===== PR-5 (2026-09-20) — Card-wide mode + per-tier threshold field props =====

/**
 * Props for MultipassAccrualModeField (card-wide radio group).
 * Mirrors StampAccrualModeFieldProps.
 */
export interface MultipassAccrualModeFieldProps {
  showValidation: boolean;
}

/**
 * Props for MultipassTierAccrualThresholdField (per-tier threshold inputs).
 *
 * The component reads `multipassAccrualMode` (card-wide) and the
 * current tier's per-tier fields itself — so callers don't need to pass
 * `mode` or the field values. They only provide `showValidation` (to
 * gate the red border / error message) and `tierId` (used to find the
 * tier in the store and to scope input ids).
 */
export interface MultipassTierAccrualThresholdFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface MultipassTierListProps {
  showValidation: boolean;
}

export interface MultipassTierRowProps {
  showValidation: boolean;
  /** Stable id (from store) for React key + update targeting. */
  tierId: string;
  /**
   * PR-4 (2026-09-19): 當 row 的 stampsNeeded 與其他 row 重複時，這裡帶重複的數字；
   * 不重複時為 null。MultipassTierStampsNeededField 用它決定要不要顯示 warning。
   * Pure UI 附加，無 store / schema 變動。
   */
  duplicateStampsNeeded: number | null;
}

export interface MultipassTierNameFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface MultipassTierStampsNeededFieldProps {
  showValidation: boolean;
  tierId: string;
  /**
   * PR-4 (2026-09-19): Number 帶這個值時這個 row 的 stampsNeeded 跟其他 row 重複，
   * UI 顯示 warning icon + tooltip；null 則無警告。
   * 純 UI 衍生值（由 MultipassTierList 計算後傳下來），非阻擋性。
   */
  duplicateStampsNeeded: number | null;
}

export interface MultipassTierRewardTypeFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface MultipassTierRewardValueFieldProps {
  showValidation: boolean;
  tierId: string;
}

/**
 * Props for MultipassTierMaxDiscountAmountField (★ PR-6, 2026-09-20).
 * Per-tier max discount ceiling — only visible when rewardType === 'percent_off'.
 * Mirrors StampCardLogic.MaxDiscountAmountField but scoped to a single tier.
 */
export interface MultipassTierMaxDiscountAmountFieldProps {
  showValidation: boolean;
  tierId: string;
}
