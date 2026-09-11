/**
 * CashbackCardLogic — Step 6 sub-module for cashback_card (現金回饋卡).
 *
 * Composes 2 top-level sub-components in order:
 *   1. <CashbackTierList />         — list of up to 5 cashback tiers (each row
 *                                      contains its own name + thresholdSpend +
 *                                      cashbackPercent fields).
 *   2. <CashbackCardLogicPreview /> — live preview of the first tier (lowest
 *                                      threshold = default tier if threshold=0).
 *
 * Differences from RewardCardLogic:
 *   - No earning mode selector (cashback is always spend-driven).
 *   - Each tier is a flat rule of "cumulative spend → cashback %".
 *   - thresholdSpend = 0 is a legitimate "default tier" (everyone qualifies).
 *   - No rewardType / rewardValue / maxDiscountAmount (cashback is always %).
 *
 * The parent (Step6CardLogic dispatcher) is responsible for prev/next buttons
 * in CardBuilderEditorWorkspace.
 *
 * Total cashback tiers are bounded by MAX_CASHBACK_TIERS=5 (Rule 019 § 4.1
 * mirror of `shared/constants/cashback-card.ts`).
 */

import { CashbackTierList } from './CashbackTierList';
import { CashbackCardLogicPreview } from './CashbackCardLogicPreview';
import type { CashbackCardLogicProps } from './CashbackCardLogic.types';

export function CashbackCardLogic({ showValidation }: CashbackCardLogicProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Cashback tier list — up to 5 tiers. Each tier has name + thresholdSpend
          (0 = default tier) + cashbackPercent (1-100). */}
      <CashbackTierList showValidation={showValidation} />
      {/* Preview at the bottom — shows the first tier's scenario. */}
      <CashbackCardLogicPreview />
    </div>
  );
}
