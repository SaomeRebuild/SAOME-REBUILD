/**
 * RewardTierRewardValueField — Reward tier sub-field 4 (獎勵值).
 *
 * Renders an `<input type="number">` whose placeholder and unit label
 * change based on the selected `rewardType`:
 *   amount_off  → "輸入折抵金額" + currency unit (元 / R based on currency)
 *   percent_off → "輸入折抵%數" + "%" unit
 *
 * Currency-aware unit placement (2026-09-09 semantic fix):
 *   - TWD amount_off: 元 is a SUFFIX → [input] 元  (e.g. "50元")
 *   - ZAR amount_off: R  is a PREFIX  → R [input] (e.g. "R50", South African Rand convention)
 *   - percent_off:     %  is a SUFFIX → [input] %  (e.g. "10%")
 *
 * The unit is read from `store.currency` so it follows the user's Step 2 choice.
 * The % symbol is ALWAYS a suffix per convention (% goes after the number).
 * The R prefix for ZAR is preserved because South African Rand uses prefix notation.
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

  // Currency-aware unit keys (2026-09-09 semantic fix):
  // - amount_off: uses currency unit (元 for TWD, R for ZAR)
  // - percent_off: uses % (always suffix)
  const amountUnitTWD = t('step6.reward.tier.rewardValueAmountUnitTWD');
  const amountUnitZAR = t('step6.reward.tier.rewardValueAmountUnitZAR');
  const percentUnit = t('step6.reward.tier.rewardValuePercentUnit');

  // 2026-09-09 semantic fix: % and 元 are ALWAYS suffixes;
  // R (ZAR) is ALWAYS a prefix per South African Rand convention.
  const isZAR = currency === 'ZAR';
  const unitSuffix =
    isPercent ? percentUnit : isAmount ? (isZAR ? '' : amountUnitTWD) : '';
  const unitPrefix =
    isPercent ? '' : isAmount ? (isZAR ? amountUnitZAR : '') : '';

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
          {/* 2026-09-09 semantic fix: unit placement follows currency convention.
              - R (ZAR amount_off) is a PREFIX: "R 50"
              - 元 (TWD amount_off) is a SUFFIX: "50 元"
              - % (percent_off) is a SUFFIX: "10 %"
              Tests assert the correct suffix/prefix order. */}
          <div className="flex items-center gap-2">
            {unitPrefix && (
              <span className="shrink-0 text-sm text-muted-foreground">
                {unitPrefix}
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
            {unitSuffix && (
              <span className="shrink-0 text-sm text-muted-foreground">
                {unitSuffix}
              </span>
            )}
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
