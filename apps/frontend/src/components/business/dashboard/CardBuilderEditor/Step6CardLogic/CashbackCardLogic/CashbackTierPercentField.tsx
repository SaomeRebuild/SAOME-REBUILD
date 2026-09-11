/**
 * CashbackTierPercentField — Cashback tier sub-field 3 (回饋%).
 *
 * Renders an `<input type="number">` for the cashback percentage (1-100).
 * Integer-only, % suffix.
 *
 * Currency-agnostic: percent is currency-independent (5% means 5% in TWD
 * or ZAR). Differs from `CashbackTierThresholdField` which is currency-aware.
 *
 * Calls `updateCashbackTier(tierId, { cashbackPercent })` on each change.
 * Store guard: rejects < 1 or > 100, rounds to integer.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { CASHBACK_PERCENT_MIN, CASHBACK_PERCENT_MAX } from '@saome/shared/constants';
import type { CashbackTierPercentFieldProps } from './CashbackCardLogic.types';

export function CashbackTierPercentField({ showValidation, tierId }: CashbackTierPercentFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.cashbackTiers.find((tier) => tier.id === tierId),
  );
  const updateCashbackTier = useCardBuilderStore((s) => s.updateCashbackTier);

  if (!tier) return null;

  const cashbackPercent = tier.cashbackPercent;
  const isInvalid =
    showValidation &&
    (cashbackPercent < CASHBACK_PERCENT_MIN || cashbackPercent > CASHBACK_PERCENT_MAX);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-cashback-${tierId}-percent`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.cashback.tier.percentTitle')}
      </label>

      <div className="flex items-center gap-2">
        <input
          id={`step6-cashback-${tierId}-percent`}
          type="number"
          inputMode="numeric"
          value={cashbackPercent}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              // Empty → set to 1 (min valid percent). User can change later.
              updateCashbackTier(tierId, { cashbackPercent: 1 });
              return;
            }
            const num = parseFloat(raw);
            if (
              Number.isNaN(num) ||
              num < CASHBACK_PERCENT_MIN ||
              num > CASHBACK_PERCENT_MAX
            ) {
              return; // store guards out-of-range
            }
            updateCashbackTier(tierId, { cashbackPercent: Math.round(num) });
          }}
          placeholder={t('step6.cashback.tier.percentPlaceholder')}
          min={CASHBACK_PERCENT_MIN}
          max={CASHBACK_PERCENT_MAX}
          aria-label={t('step6.cashback.tier.percentTitle')}
          aria-invalid={isInvalid}
          className={`
            flex h-10 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm
            text-foreground ring-offset-background
            placeholder:text-muted-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
            ${isInvalid ? 'border-destructive' : 'border-input'}
          `}
        />
        <span className="shrink-0 text-sm text-muted-foreground">
          {t('step6.cashback.tier.percentUnit')}
        </span>
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {cashbackPercent > CASHBACK_PERCENT_MAX
            ? t('step6.cashback.tier.percentTooLargeError')
            : t('step6.cashback.tier.percentInvalidError')}
        </p>
      )}
    </div>
  );
}
