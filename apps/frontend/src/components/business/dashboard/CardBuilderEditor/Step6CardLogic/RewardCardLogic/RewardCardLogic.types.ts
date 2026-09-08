/**
 * RewardCardLogic — Types
 *
 * @module CardBuilderEditor/Step6CardLogic/RewardCardLogic/RewardCardLogic.types
 */

import type { EarningMode } from '@saome/shared/constants';

export interface RewardCardLogicProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep6Valid()` so the user only sees red borders / messages
   * after they've tried to advance at least once.
   */
  showValidation: boolean;
}

/**
 * 2026-09-09 mixed refactor: `earningMode` is CARD-WIDE (top-level).
 * `<EarningModeField />` is rendered at the top of `RewardCardLogic`,
 * matching StampCardLogic's `<StampAccrualModeField />` pattern.
 * It does NOT take `tierId`.
 */
export interface EarningModeFieldProps {
  showValidation: boolean;
}

/**
 * 2026-09-09 mixed refactor: `pointsPerVisit` is PER-TIER (inside each
 * RewardTierRow). The card-wide `earningMode` decides whether this
 * field is shown — driven by `<EarningModeField />` at top level.
 */
export interface PointsPerVisitFieldProps {
  showValidation: boolean;
  tierId: string;
}

/**
 * 2026-09-09 mixed refactor: `pointsPerSpendAmount` / `pointsPerSpendPoints`
 * are PER-TIER (inside each RewardTierRow). The card-wide `earningMode`
 * decides whether this field is shown.
 */
export interface PointsPerSpendFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface RewardTierListProps {
  showValidation: boolean;
}

export interface RewardTierRowProps {
  showValidation: boolean;
  /** Stable id (from store) for React key + update targeting. */
  tierId: string;
}

export interface RewardTierNameFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface RewardTierThresholdFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface RewardTierRewardTypeFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface RewardTierRewardValueFieldProps {
  showValidation: boolean;
  tierId: string;
}

export interface RewardTierMaxDiscountFieldProps {
  showValidation: boolean;
  tierId: string;
}

/** Re-export for downstream consumers. */
export type { EarningMode };
