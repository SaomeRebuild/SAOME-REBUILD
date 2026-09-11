/**
 * CashbackTierRow — Single cashback tier editor row.
 *
 * Composes 3 sub-fields in order:
 *   1. <CashbackTierNameField />     — text input (tier name)
 *   2. <CashbackTierThresholdField /> — number input (thresholdSpend, currency-aware)
 *   3. <CashbackTierPercentField />  — number input (cashbackPercent, 1-100)
 *
 * The row includes a Remove button (top-right) that calls `removeCashbackTier(id)`.
 *
 * Desktop layout: 3-col grid (name | threshold | percent).
 * Mobile layout: stacked vertically.
 *
 * Differs from RewardTierRow:
 *   - No PointsPerVisit / PointsPerSpend earn rate fields (cashback has no point accrual).
 *   - No RewardType / RewardValue / MaxDiscount fields (cashback is always a % discount).
 *   - thresholdSpend = 0 is a legitimate "default tier" hint shown inline.
 */

import { useTranslation } from 'react-i18next';
import { Trash2Icon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { CashbackTierNameField } from './CashbackTierNameField';
import { CashbackTierThresholdField } from './CashbackTierThresholdField';
import { CashbackTierPercentField } from './CashbackTierPercentField';
import type { CashbackTierRowProps } from './CashbackCardLogic.types';

export function CashbackTierRow({ showValidation, tierId }: CashbackTierRowProps) {
  const { t } = useTranslation('cardEditor');
  const removeCashbackTier = useCardBuilderStore((s) => s.removeCashbackTier);

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4">
      {/* Row header — Remove button on the right */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t('step6.cashback.tier.thresholdTitle')}
        </span>
        <button
          type="button"
          onClick={() => removeCashbackTier(tierId)}
          aria-label={t('step6.cashback.removeTier')}
          className="
            inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium
            text-destructive
            transition-colors duration-150
            hover:bg-destructive/10
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          "
        >
          <Trash2Icon size={14} aria-hidden="true" />
          <span>{t('step6.cashback.removeTier')}</span>
        </button>
      </div>

      {/* 3-col grid: name | threshold | percent on md+; stacked on mobile. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <CashbackTierNameField showValidation={showValidation} tierId={tierId} />
        <CashbackTierThresholdField showValidation={showValidation} tierId={tierId} />
        <CashbackTierPercentField showValidation={showValidation} tierId={tierId} />
      </div>
    </div>
  );
}
