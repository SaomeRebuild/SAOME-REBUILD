/**
 * RewardCardLogic — Step 6 sub-module for reward_card.
 *
 * 2026-09-09 mixed refactor: `<EarningModeField />` is BACK at the top
 * level (one mode per card, mirroring `StampCardLogic`'s
 * `<StampAccrualModeField />` pattern). The earn rate fields
 * (`<PointsPerVisitField />` + `<PointsPerSpendField />`) stay INSIDE each
 * `<RewardTierRow />` — each tier can configure its own rate under the
 * same card-wide mode (e.g. tier-1 = 1 visit = 1 point; tier-2 =
 * 1 visit = 2 points).
 *
 * Composes 3 top-level sub-components in order:
 *   1. <EarningModeField />       — 3-option radio (card-wide earn mode)
 *   2. <RewardTierList />         — list of up to 5 reward tiers (each row
 *                                   contains its own PointsPerVisitField +
 *                                   PointsPerSpendField + RewardTierNameField
 *                                   + …).
 *   3. <RewardCardLogicPreview /> — live scenario preview (first tier湊句).
 *
 * Differences from StampCardLogic:
 *   - Reward tiers are points-driven and can each independently define its
 *     own earn RATE under the same card-wide mode.
 *   - Up to 5 reward tiers vs stamp's single rewardName+rewardType+rewardValue.
 *   - Preview shows the FIRST tier's湊句 (lowest threshold) only — UI keeps
 *     the same single-sentence pattern for consistency with stamp.
 *
 * The parent (Step6CardLogic dispatcher) is responsible for prev/next buttons
 * in CardBuilderEditorWorkspace.
 *
 * Total reward tiers are bounded by MAX_REWARD_TIERS=5 (Rule 019 § 4.1 mirror
 * of `shared/constants/reward-card.ts`).
 */

import { EarningModeField } from './EarningModeField';
import { RewardTierList } from './RewardTierList';
import { RewardCardLogicPreview } from './RewardCardLogicPreview';
import type { RewardCardLogicProps } from './RewardCardLogic.types';

export function RewardCardLogic({ showValidation }: RewardCardLogicProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Card-wide earning mode (top-level, 2026-09-09 mixed refactor).
          One mode per card; switching it clears all per-tier earn rate fields. */}
      <EarningModeField showValidation={showValidation} />
      {/* Reward tier list — up to 5 tiers. Each tier owns its earn RATE
          (PointsPerVisitField / PointsPerSpendField, conditional on the
          card-wide earningMode rendered above). */}
      <RewardTierList showValidation={showValidation} />
      {/* Preview at the bottom — shows the combined reward scenario */}
      <RewardCardLogicPreview />
    </div>
  );
}
