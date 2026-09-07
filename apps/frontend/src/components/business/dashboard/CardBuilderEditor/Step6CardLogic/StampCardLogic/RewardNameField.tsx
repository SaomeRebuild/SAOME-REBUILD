/**
 * RewardNameField — Step 6 section 2 (獎勵名稱).
 *
 * Renders a single-line `<input type="text">` with:
 *   - 40-char max (REWARD_NAME_MAX_LENGTH)
 *   - Live character counter (e.g. "12 / 40")
 *   - Placeholder showing example usage
 *   - Autocomplete off (avoids Chrome autofill polluting the field)
 *
 * Behavior:
 *   - `maxLength` HTML attribute enforces the cap at the input layer.
 *   - `setRewardName` setter also truncates as a belt-and-suspenders guard
 *     against paste that exceeds the cap.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { REWARD_NAME_MAX_LENGTH } from '@saome/shared/constants';
import type { RewardNameFieldProps } from './StampCardLogic.types';

export function RewardNameField({ showValidation }: RewardNameFieldProps) {
  const { t } = useTranslation('cardEditor');
  const rewardName = useCardBuilderStore((s) => s.rewardName);
  const setRewardName = useCardBuilderStore((s) => s.setRewardName);

  const isEmpty = rewardName.trim().length === 0;
  const isTooLong = rewardName.length > REWARD_NAME_MAX_LENGTH;
  const showError = showValidation && isEmpty;

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.stamp.rewardNameTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.stamp.rewardNameHelper')}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <input
          id="step6-reward-name"
          type="text"
          value={rewardName}
          onChange={(e) => setRewardName(e.target.value)}
          placeholder={t('step6.stamp.rewardNamePlaceholder')}
          autoComplete="off"
          maxLength={REWARD_NAME_MAX_LENGTH}
          aria-describedby="step6-reward-name-counter"
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
            {t('step6.stamp.rewardNameEmptyError')}
          </p>
        )}
        <div className="flex items-center justify-end">
          <span
            id="step6-reward-name-counter"
            className={`text-xs tabular-nums ${
              isTooLong ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {t('step6.stamp.rewardNameCounter', {
              count: rewardName.length,
            })}
          </span>
        </div>
      </div>
    </section>
  );
}
