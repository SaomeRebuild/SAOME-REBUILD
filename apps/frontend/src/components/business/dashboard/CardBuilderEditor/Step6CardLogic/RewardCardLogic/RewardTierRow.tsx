/**
 * RewardTierRow — Single reward tier editor row.
 *
 * Composes 7 sub-fields in order:
 *   1. <RewardTierNameField />          — text input (reward name)
 *   2. <RewardTierThresholdField />     — number input (point threshold)
 *   3. <PointsPerVisitField />          — CONDITIONAL: card-wide earningMode is based_on_visits
 *   4. <PointsPerSpendField />          — CONDITIONAL: card-wide earningMode is based_on_spending
 *   5. <RewardTierRewardTypeField />    — select (amount_off / percent_off)
 *   6. <RewardTierRewardValueField />   — number input (reward value)
 *   7. <RewardTierMaxDiscountField />  — CONDITIONAL: percent_off only
 *
 * The row includes a Remove button (top-right) that calls `removeRewardTier(id)`.
 *
 * 2026-09-09 mixed refactor: `<EarningModeField />` is NO LONGER inside each
 * RewardTierRow — it was moved back to the top level of `<RewardCardLogic />`
 * (one mode per card, matching STAMP card's StampAccrualModeField pattern).
 * The earn rate fields (PointsPerVisitField + PointsPerSpendField) stay
 * PER-TIER and read the card-wide `earningMode` to decide whether to render.
 *
 * Mobile-first: stack vertically by default; on md+ the row becomes a
 * grid with 2 columns (left: name + threshold; right: rewardType + value).
 */

import { useTranslation } from 'react-i18next';
import { Trash2Icon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { RewardTierNameField } from './RewardTierNameField';
import { RewardTierThresholdField } from './RewardTierThresholdField';
import { PointsPerVisitField } from './PointsPerVisitField';
import { PointsPerSpendField } from './PointsPerSpendField';
import { RewardTierRewardTypeField } from './RewardTierRewardTypeField';
import { RewardTierRewardValueField } from './RewardTierRewardValueField';
import { RewardTierMaxDiscountField } from './RewardTierMaxDiscountField';
import type { RewardTierRowProps } from './RewardCardLogic.types';

export function RewardTierRow({ showValidation, tierId }: RewardTierRowProps) {
  const { t } = useTranslation('cardEditor');
  const removeRewardTier = useCardBuilderStore((s) => s.removeRewardTier);

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4">
      {/* Row header — Remove button on the right */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t('step6.reward.tier.thresholdTitle')} · {t('step6.reward.tier.nameTitle')}
        </span>
        <button
          type="button"
          onClick={() => removeRewardTier(tierId)}
          aria-label={t('step6.reward.removeTier')}
          className="
            inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium
            text-destructive
            transition-colors duration-150
            hover:bg-destructive/10
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          "
        >
          <Trash2Icon size={14} aria-hidden="true" />
          <span>{t('step6.reward.removeTier')}</span>
        </button>
      </div>

      {/* ===== Reward identity ===== */}
      <div className="flex flex-col gap-3">
        <RewardTierNameField showValidation={showValidation} tierId={tierId} />
        <RewardTierThresholdField showValidation={showValidation} tierId={tierId} />
      </div>

      {/* ===== Earn rate (per-tier, 2026-09-09 mixed refactor) =====
          EarningModeField lives at the TOP level of <RewardCardLogic />
          (card-wide, one mode per card). Each tier still owns its own earn
          rate via PointsPerVisitField / PointsPerSpendField, conditional on
          the card-wide earningMode. Mode change is handled by the store's
          setEarningMode (clears all per-tier earn rate fields). */}
      <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4">
        {/* PointsPerVisitField is CONDITIONAL: only rendered when card-wide
            earningMode === 'based_on_visits' (read by the component itself). */}
        <PointsPerVisitField showValidation={showValidation} tierId={tierId} />
        {/* PointsPerSpendField is CONDITIONAL: only rendered when card-wide
            earningMode === 'based_on_spending' (read by the component itself). */}
        <PointsPerSpendField showValidation={showValidation} tierId={tierId} />
      </div>

      {/* ===== Reward rule (rewardType + value + cap) ===== */}
      <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4">
        <RewardTierRewardTypeField showValidation={showValidation} tierId={tierId} />
        <RewardTierRewardValueField showValidation={showValidation} tierId={tierId} />
        {/* RewardTierMaxDiscountField is CONDITIONAL: only rendered for percent_off */}
        <RewardTierMaxDiscountField showValidation={showValidation} tierId={tierId} />
      </div>
    </div>
  );
}
