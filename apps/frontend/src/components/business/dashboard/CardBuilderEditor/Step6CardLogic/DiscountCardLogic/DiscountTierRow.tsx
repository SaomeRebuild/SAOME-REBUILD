/**
 * DiscountTierRow — Single discount tier editor row.
 *
 * Composes 3 sub-fields in order:
 *   1. <DiscountTierNameField />     — text input (tier name)
 *   2. <DiscountTierThresholdField /> — number input (thresholdSpend, currency-aware)
 *   3. <DiscountTierPercentField />  — number input (discountPercent, 1-100)
 *
 * The row includes a Remove button (top-right) that calls `removeDiscountTier(id)`.
 *
 * Desktop layout: 3-col grid (name | threshold | percent).
 * Mobile layout: stacked vertically.
 *
 * Differs from CashbackTierRow:
 *   - Uses discount* namespaced fields/store setters.
 *   - thresholdSpend = 0 is a legitimate "default tier" hint shown inline.
 */

import { useTranslation } from 'react-i18next';
import { Trash2Icon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { DiscountTierNameField } from './DiscountTierNameField';
import { DiscountTierThresholdField } from './DiscountTierThresholdField';
import { DiscountTierPercentField } from './DiscountTierPercentField';
import type { DiscountTierRowProps } from './DiscountCardLogic.types';

export function DiscountTierRow({ showValidation, tierId }: DiscountTierRowProps) {
  const { t } = useTranslation('cardEditor');
  const removeDiscountTier = useCardBuilderStore((s) => s.removeDiscountTier);

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4">
      {/* Row header — Remove button on the right */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t('step6.discount.tier.thresholdTitle')}
        </span>
        <button
          type="button"
          onClick={() => removeDiscountTier(tierId)}
          aria-label={t('step6.discount.removeTier')}
          className="
            inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium
            text-destructive
            transition-colors duration-150
            hover:bg-destructive/10
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          "
        >
          <Trash2Icon size={14} aria-hidden="true" />
          <span>{t('step6.discount.removeTier')}</span>
        </button>
      </div>

      {/* 3-col grid: name | threshold | percent on md+; stacked on mobile. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <DiscountTierNameField showValidation={showValidation} tierId={tierId} />
        <DiscountTierThresholdField showValidation={showValidation} tierId={tierId} />
        <DiscountTierPercentField showValidation={showValidation} tierId={tierId} />
      </div>
    </div>
  );
}
