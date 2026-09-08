/**
 * RewardTierRewardValueField — Reward tier sub-field 4 (獎勵值).
 *
 * Renders an `<input type="number">` whose placeholder and unit label
 * change based on the selected `rewardType`:
 *   amount_off  → "輸入折抵金額" + currency unit (元 / R based on currency)
 *   percent_off → "輸入折抵%數" + "%" unit
 *
 * Currency-aware unit:
 *   - TWD: 元
 *   - ZAR: R
 * The unit is read from `store.currency` so it follows the user's Step 2 choice.
 *
 * Unit placement:
 *   - The unit is rendered as a PREFIX (left of the input), not a suffix.
 *   - 2026-09-09 fix: previous layout rendered `<input> 元`, which read as
 *     "50元" (unit glued to the value). Prefix matches currency conventions
 *     (NT$50 / R50 / %10) and aligns with the same fix applied to
 *     MaxDiscountAmountField / RewardValueField / AccrualThresholdField.
 *
 * Validation:
 *   - Negative numbers are rejected by `onChange`.
 *   - percent_off has additional cap at 100 (REWARD_PERCENT_MAX).
 *   - Store `updateRewardTier({ rewardValue })` rejects ≤ 0 (defensive).
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { REWARD_PERCENT_MIN, REWARD_PERCENT_MAX } from '@saome/shared/constants';
import type { RewardTierRewardValueFieldProps } from './RewardCardLogic.types';

export function RewardTierRewardValueField({ showValidation, tierId }: RewardTierRewardValueFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.rewardTiers.find((tier) => tier.id === tierId),
  );
  const currency = useCardBuilderStore((s) => s.currency);
  const updateRewardTier = useCardBuilderStore((s) => s.updateRewardTier);

  if (!tier) return null;

  const rewardType = tier.rewardType;
  const rewardValue = tier.rewardValue;

  const isAmount = rewardType === 'amount_off';
  const isPercent = rewardType === 'percent_off';
  const isSelected = rewardType !== null && rewardType !== undefined;
  const showError =
    showValidation && isSelected && (rewardValue === null || rewardValue === undefined || rewardValue <= 0);

  const placeholder = isAmount
    ? t('step6.reward.tier.rewardValueAmountPlaceholder')
    : isPercent
    ? t('step6.reward.tier.rewardValuePercentPlaceholder')
    : '';

  // Currency-aware unit for amount_off mode.
  const amountUnitKey =
    currency === 'ZAR'
      ? 'step6.reward.tier.rewardValueAmountUnitZAR'
      : 'step6.reward.tier.rewardValueAmountUnitTWD';

  const unitLabel = isPercent
    ? t('step6.reward.tier.rewardValuePercentUnit')
    : isAmount
    ? t(amountUnitKey)
    : '';

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-tier-${tierId}-reward-value`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.reward.tier.rewardValueTitle')}
      </label>

      {!isSelected && (
        <p className="text-xs text-muted-foreground">
          {t('step6.reward.tier.rewardTypePlaceholder')}
        </p>
      )}

      {isSelected && (
        <>
          {/* Unit rendered as a PREFIX (left of the input).
              Previous version rendered the unit as a suffix ("50 R"), which
              visually reads as "50R" — the unit is part of the displayed value
              rather than labelling the input. Prefix matches currency
              conventions (NT$50 / R50 / %10). Tests assert the unit text is
              rendered; order is intentionally reversed. */}
          <div className="flex items-center gap-2">
            {unitLabel && (
              <span className="shrink-0 text-sm text-muted-foreground">
                {unitLabel}
              </span>
            )}
            <input
              id={`step6-tier-${tierId}-reward-value`}
              type="number"
              inputMode="decimal"
              value={rewardValue ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  updateRewardTier(tierId, { rewardValue: null as unknown as number });
                  return;
                }
                const num = parseFloat(raw);
                if (Number.isNaN(num) || num <= 0) return; // store rejects ≤ 0
                updateRewardTier(tierId, { rewardValue: num });
              }}
              placeholder={placeholder}
              min={isPercent ? REWARD_PERCENT_MIN : undefined}
              max={isPercent ? REWARD_PERCENT_MAX : undefined}
              aria-label={t('step6.reward.tier.rewardValueTitle')}
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
          </div>

          {showError && (
            <p className="text-xs text-destructive" role="alert">
              {t('step6.reward.tier.rewardValueRequiredError')}
            </p>
          )}
          {rewardValue !== null && rewardValue !== undefined && rewardValue > 0 && isPercent && rewardValue > REWARD_PERCENT_MAX && (
            <p className="text-xs text-destructive" role="alert">
              {t('step6.reward.tier.rewardValueTooLargeError')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
