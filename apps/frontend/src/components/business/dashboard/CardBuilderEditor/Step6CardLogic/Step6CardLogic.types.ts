/**
 * Step6CardLogic — Types
 *
 * @module CardBuilderEditor/Step6CardLogic/Step6CardLogic.types
 */

import type { AccrualMode, RewardType } from '@saome/shared/constants';

export interface Step6CardLogicProps {
  /**
   * Surface per-field validation errors. The workspace passes
   * `!isStep6Valid()` so the user only sees red borders / messages
   * after they've tried to advance at least once.
   */
  showValidation: boolean;
}

export interface StampCardLogicProps extends Step6CardLogicProps {
  // Re-exports for convenience so consumers only need to import from one place.
}

/** Injected into StampCardLogicPreview for composing the scenario text. */
export interface StampCardLogicPreviewData {
  stampTotal: number;
  accrualMode: AccrualMode | null;
  rewardName: string;
  rewardType: RewardType | null;
  rewardValue: number | null;
  maxDiscountAmount: number | null;
}
