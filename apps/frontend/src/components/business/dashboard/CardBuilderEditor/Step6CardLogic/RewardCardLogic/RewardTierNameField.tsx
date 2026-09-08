/**
 * RewardTierNameField — Reward tier sub-field 1 (獎勵名稱).
 *
 * Renders a single-line `<input type="text">` with:
 *   - 40-char max (REWARD_TIER_NAME_MAX_LENGTH)
 *   - Live character counter
 *   - Placeholder showing example usage
 *
 * Calls `updateRewardTier(tierId, { name })` on each keystroke.
 * Setter truncates at REWARD_TIER_NAME_MAX_LENGTH=40 (defensive).
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { REWARD_TIER_NAME_MAX_LENGTH } from '@saome/shared/constants';
import type { RewardTierNameFieldProps } from './RewardCardLogic.types';

export function RewardTierNameField({ showValidation, tierId }: RewardTierNameFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.rewardTiers.find((tier) => tier.id === tierId),
  );
  const updateRewardTier = useCardBuilderStore((s) => s.updateRewardTier);

  if (!tier) return null;

  const name = tier.name;
  const isEmpty = name.trim().length === 0;
  const showError = showValidation && isEmpty;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-tier-${tierId}-name`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.reward.tier.nameTitle')}
      </label>
      <input
        id={`step6-tier-${tierId}-name`}
        type="text"
        value={name}
        onChange={(e) => updateRewardTier(tierId, { name: e.target.value })}
        placeholder={t('step6.reward.tier.namePlaceholder')}
        autoComplete="off"
        maxLength={REWARD_TIER_NAME_MAX_LENGTH}
        aria-describedby={`step6-tier-${tierId}-name-counter`}
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
      {showError && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.reward.tier.nameRequiredError')}
        </p>
      )}
      <div className="flex items-center justify-end">
        <span
          id={`step6-tier-${tierId}-name-counter`}
          className="text-xs tabular-nums text-muted-foreground"
        >
          {t('step6.reward.tier.nameCounter', { count: name.length })}
        </span>
      </div>
    </div>
  );
}
