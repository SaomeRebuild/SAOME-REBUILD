/**
 * MultipassTierRewardTypeField — Radio for amount_off / percent_off.
 *
 * Per-tier rewardType — different from stamp_card's card-wide rewardType.
 *
 * Calls `updateMultipassTier(tierId, { rewardType })`. The setter
 * automatically clears `rewardValue` when type changes (mirrors
 * the stamp_card `setRewardType` clear behavior).
 *
 * Uses native radio inputs (not a custom select) to match the
 * Step 3 stamp-card pattern + the user's familiarity with binary
 * choice controls.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { MultipassTierRewardTypeFieldProps } from './MultipassCardLogic.types';

export function MultipassTierRewardTypeField({
  showValidation,
  tierId,
}: MultipassTierRewardTypeFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.multipassTiers.find((tier) => tier.id === tierId),
  );
  const updateMultipassTier = useCardBuilderStore((s) => s.updateMultipassTier);

  if (!tier) return null;

  const value = tier.rewardType;
  const showError = showValidation && value === null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <fieldset
        className={`flex min-w-0 flex-col gap-2 rounded-md ${
          showError ? '' : ''
        }`}
        aria-invalid={showError}
      >
        <legend className="text-xs font-medium text-muted-foreground">
          {t('step6.multipass.tier.rewardTypeTitle')}
        </legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`step6-multipass-${tierId}-reward-type`}
              value="amount_off"
              checked={value === 'amount_off'}
              onChange={() => updateMultipassTier(tierId, { rewardType: 'amount_off' })}
              aria-label={t('step6.multipass.tier.rewardTypeAmount')}
            />
            <span>{t('step6.multipass.tier.rewardTypeAmount')}</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`step6-multipass-${tierId}-reward-type`}
              value="percent_off"
              checked={value === 'percent_off'}
              onChange={() => updateMultipassTier(tierId, { rewardType: 'percent_off' })}
              aria-label={t('step6.multipass.tier.rewardTypePercent')}
            />
            <span>{t('step6.multipass.tier.rewardTypePercent')}</span>
          </label>
        </div>
      </fieldset>
    </div>
  );
}
