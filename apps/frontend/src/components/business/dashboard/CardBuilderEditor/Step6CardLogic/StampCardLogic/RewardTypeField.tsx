/**
 * RewardTypeField — Step 6 section 3 (獎勵類型).
 *
 * Renders a `<select>` with two options:
 *   amount_off  — 訂單折抵現金
 *   percent_off — 訂單折抵百分比
 *
 * Behavior:
 *   - Switching the type calls `setRewardType` which ALSO clears
 *     `rewardValue` and `maxDiscountAmount` — the old values are
 *     invalid for the new type's valid range.
 *   - The selected option's hint text is shown below the select.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { RewardTypeFieldProps } from './StampCardLogic.types';

export function RewardTypeField({ showValidation }: RewardTypeFieldProps) {
  const { t } = useTranslation('cardEditor');
  const rewardType = useCardBuilderStore((s) => s.rewardType);
  const setRewardType = useCardBuilderStore((s) => s.setRewardType);

  const showError = showValidation && rewardType === null;

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.stamp.rewardTypeTitle')}
        </h3>
      </header>

      <div className="flex flex-col gap-1.5">
        <select
          id="step6-reward-type"
          value={rewardType ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'amount_off' || val === 'percent_off') {
              setRewardType(val);
            } else {
              setRewardType(null);
            }
          }}
          aria-describedby="step6-reward-type-hint"
          aria-invalid={showError}
          // Force the OS-native dropdown panel into light color scheme so
          // unselected options render on a white panel (instead of
          // inheriting the dark page's white text → white-on-white invisible).
          // See Step3CardFields/index.tsx OPTION_STYLE comment for the full
          // explanation of why `colorScheme: 'light'` alone is insufficient
          // and per-option `color: #000000` is also required.
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
              does not override the inherited body color cascade on Chrome /
              Windows, leaving option text invisible (regression: 2026-09-07). */}
          <option value="" style={{ color: '#000000' }}>
            {t('step6.stamp.rewardTypePlaceholder')}
          </option>
          <option value="amount_off" style={{ color: '#000000' }}>
            {t('step6.stamp.rewardTypeAmount')}
          </option>
          <option value="percent_off" style={{ color: '#000000' }}>
            {t('step6.stamp.rewardTypePercent')}
          </option>
        </select>

        {showError && (
          <p className="text-xs text-destructive" role="alert">
            {t('step6.stamp.rewardValueEmptyError')}
          </p>
        )}

        {/* Contextual hint for the selected type */}
        {rewardType === 'amount_off' && (
          <p
            id="step6-reward-type-hint"
            className="text-xs text-muted-foreground"
          >
            {t('step6.stamp.rewardTypeAmountHint')}
          </p>
        )}
        {rewardType === 'percent_off' && (
          <p
            id="step6-reward-type-hint"
            className="text-xs text-muted-foreground"
          >
            {t('step6.stamp.rewardTypePercentHint')}
          </p>
        )}
      </div>
    </section>
  );
}
