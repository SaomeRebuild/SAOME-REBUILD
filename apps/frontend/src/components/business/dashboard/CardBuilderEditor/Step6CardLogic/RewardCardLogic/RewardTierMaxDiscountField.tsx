/**
 * RewardTierMaxDiscountField — Reward tier sub-field 5 (最高折抵金額).
 *
 * CONDITIONALLY rendered: only shown when `rewardType === 'percent_off'`.
 *
 * Renders an `<input type="number">` for setting the per-use discount ceiling.
 *
 * 2026-09-09 currency placement fix: ZAR uses prefix notation (R first,
 * amount after) per South African Rand convention. TWD keeps suffix
 * notation (元 after) per zh-TW convention. EN uses prefix for both
 * (NT$50 / R50).
 *
 * Behavior:
 *   - Currency-aware unit (元 for TWD as suffix, R for ZAR as prefix).
 *   - `null` in the store also means "no cap" (user cleared the field).
 *   - `updateRewardTier({ maxDiscountAmount })` clamps to [0, MAX_DISCOUNT_AMOUNT_MAX].
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_DISCOUNT_AMOUNT_MAX } from '@saome/shared/constants';
import type { RewardTierMaxDiscountFieldProps } from './RewardCardLogic.types';

export function RewardTierMaxDiscountField({ showValidation: _showValidation, tierId }: RewardTierMaxDiscountFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.rewardTiers.find((tier) => tier.id === tierId),
  );
  const currency = useCardBuilderStore((s) => s.currency);
  const updateRewardTier = useCardBuilderStore((s) => s.updateRewardTier);

  if (!tier) return null;

  // Only visible in percent_off mode.
  if (tier.rewardType !== 'percent_off') return null;

  const maxDiscountAmount = tier.maxDiscountAmount;
  const isEmpty = maxDiscountAmount === null;

  // 2026-09-09 currency placement fix: ZAR uses prefix notation (R first,
  // amount after) per South African Rand convention; TWD keeps suffix
  // (元 after) per zh-TW convention. Compute the two adornments from the
  // existing `maxDiscountUnitTWD/ZAR` i18n keys.
  const isZAR = currency === 'ZAR';
  const unitPrefix = isZAR ? t('step6.reward.tier.maxDiscountUnitZAR') : '';
  const unitSuffix = isZAR ? '' : t('step6.reward.tier.maxDiscountUnitTWD');

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-tier-${tierId}-max-discount`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.reward.tier.maxDiscountTitle')}
      </label>

      <div className="flex items-center gap-2">
        {/* 2026-09-09: ZAR renders R BEFORE the input; TWD keeps 元 AFTER. */}
        {unitPrefix && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {unitPrefix}
          </span>
        )}
        <input
          id={`step6-tier-${tierId}-max-discount`}
          type="number"
          inputMode="decimal"
          value={isEmpty ? '' : String(maxDiscountAmount ?? '')}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              updateRewardTier(tierId, { maxDiscountAmount: null });
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num) || num < 0) return;
            updateRewardTier(tierId, { maxDiscountAmount: Math.round(num) });
          }}
          placeholder={t('step6.reward.tier.maxDiscountPlaceholder')}
          min={0}
          max={MAX_DISCOUNT_AMOUNT_MAX}
          aria-describedby={`step6-tier-${tierId}-max-discount-hint`}
          className={`
            flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
            text-foreground ring-offset-background
            placeholder:text-muted-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          `}
        />
        {unitSuffix && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {unitSuffix}
          </span>
        )}
      </div>

      {/* Helper text */}
      <div id={`step6-tier-${tierId}-max-discount-hint`} className="flex flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">
          {t('step6.reward.tier.maxDiscountHelper')}
        </p>
        {isEmpty && (
          <p className="text-xs italic text-muted-foreground">
            {t('step6.reward.tier.maxDiscountOptional')}
          </p>
        )}
      </div>
    </div>
  );
}
