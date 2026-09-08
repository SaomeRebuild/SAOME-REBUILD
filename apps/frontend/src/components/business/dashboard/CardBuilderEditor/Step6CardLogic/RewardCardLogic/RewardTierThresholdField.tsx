/**
 * RewardTierThresholdField — Reward tier sub-field 2 (達成門檻).
 *
 * Renders a `<input type="number">` for the point threshold required to unlock
 * this tier. Min 1 (THRESHOLD_MIN). Max THRESHOLD_MAX=999_999_999.
 *
 * Calls `updateRewardTier(tierId, { threshold })` on each change.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { THRESHOLD_MIN } from '@saome/shared/constants';
import type { RewardTierThresholdFieldProps } from './RewardCardLogic.types';

export function RewardTierThresholdField({ showValidation, tierId }: RewardTierThresholdFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.rewardTiers.find((tier) => tier.id === tierId),
  );
  const updateRewardTier = useCardBuilderStore((s) => s.updateRewardTier);

  if (!tier) return null;

  const threshold = tier.threshold;
  const isEmpty = threshold === 0;
  const showError = showValidation && isEmpty;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-tier-${tierId}-threshold`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.reward.tier.thresholdTitle')}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`step6-tier-${tierId}-threshold`}
          type="number"
          inputMode="numeric"
          value={threshold === 0 ? '' : String(threshold)}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              updateRewardTier(tierId, { threshold: 0 });
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num) || num < THRESHOLD_MIN) return;
            updateRewardTier(tierId, { threshold: Math.round(num) });
          }}
          placeholder={t('step6.reward.tier.thresholdPlaceholder')}
          min={THRESHOLD_MIN}
          aria-label={t('step6.reward.tier.thresholdTitle')}
          aria-invalid={showError}
          className={`
            flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm
            text-foreground ring-offset-background
            placeholder:text-muted-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
            ${showError ? 'border-destructive' : 'border-input'}
          `}
        />
        <span className="shrink-0 text-sm text-muted-foreground">
          {t('step6.reward.tier.thresholdUnit')}
        </span>
      </div>

      {showError && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.reward.tier.thresholdRequiredError')}
        </p>
      )}
    </div>
  );
}
