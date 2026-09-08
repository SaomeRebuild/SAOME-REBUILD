/**
 * RewardTierRewardTypeField — Reward tier sub-field 3 (獎勵方式).
 *
 * Renders a `<select>` with two options:
 *   amount_off  — 現金折扣
 *   percent_off — 百分比折扣
 *
 * Switching the type via `updateRewardTier` ALSO clears `rewardValue` and
 * `maxDiscountAmount` — old values are invalid for the new type's valid range.
 * This matches the behavior of StampCardLogic.RewardTypeField.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { RewardTierRewardTypeFieldProps } from './RewardCardLogic.types';

export function RewardTierRewardTypeField({ showValidation, tierId }: RewardTierRewardTypeFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.rewardTiers.find((tier) => tier.id === tierId),
  );
  const updateRewardTier = useCardBuilderStore((s) => s.updateRewardTier);

  if (!tier) return null;

  const rewardType = tier.rewardType;
  const isEmpty = rewardType === null || rewardType === undefined;
  const showError = showValidation && isEmpty;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-tier-${tierId}-reward-type`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.reward.tier.rewardTypeTitle')}
      </label>
      <select
        id={`step6-tier-${tierId}-reward-type`}
        value={rewardType ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          if (val === 'amount_off' || val === 'percent_off') {
            // Cast to RewardType — the schema accepts only these two values.
            updateRewardTier(tierId, { rewardType: val });
          } else {
            // Empty option (placeholder) — clear the type. The setter will
            // also clear rewardValue + maxDiscountAmount (defensive in store).
            updateRewardTier(tierId, { rewardType: null as unknown as 'amount_off' });
          }
        }}
        aria-invalid={showError}
        style={{ colorScheme: 'light' }}
        className={`
          flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm
          text-foreground ring-offset-background
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50
          ${showError ? 'border-destructive' : 'border-input'}
        `}
      >
        {/* Every <option> needs explicit `color: #000000` — colorScheme alone
            does not override the inherited body color cascade on Chrome / Windows. */}
        <option value="" style={{ color: '#000000' }}>
          {t('step6.reward.tier.rewardTypePlaceholder')}
        </option>
        <option value="amount_off" style={{ color: '#000000' }}>
          {t('step6.reward.tier.rewardTypeAmount')}
        </option>
        <option value="percent_off" style={{ color: '#000000' }}>
          {t('step6.reward.tier.rewardTypePercent')}
        </option>
      </select>
      {showError && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.reward.validation.rewardTypeRequired')}
        </p>
      )}
    </div>
  );
}
