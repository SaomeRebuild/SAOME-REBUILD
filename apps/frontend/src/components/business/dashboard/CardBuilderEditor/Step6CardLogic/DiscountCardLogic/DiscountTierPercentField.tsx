/**
 * DiscountTierPercentField — Discount tier sub-field 3 (折扣%).
 *
 * Renders an `<input type="number">` for the discount percentage (1-100).
 * Integer-only, % suffix.
 *
 * Currency-agnostic: percent is currency-independent (5% means 5% in TWD
 * or ZAR).
 *
 * Calls `updateDiscountTier(tierId, { discountPercent })` on each change.
 * Store guard: rejects < 1 or > 100, rounds to integer.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { DISCOUNT_PERCENT_MIN, DISCOUNT_PERCENT_MAX } from '@saome/shared/constants';
import type { DiscountTierPercentFieldProps } from './DiscountCardLogic.types';

export function DiscountTierPercentField({ showValidation, tierId }: DiscountTierPercentFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.discountTiers.find((tier) => tier.id === tierId),
  );
  const updateDiscountTier = useCardBuilderStore((s) => s.updateDiscountTier);

  if (!tier) return null;

  const discountPercent = tier.discountPercent;
  const isInvalid =
    showValidation &&
    (discountPercent < DISCOUNT_PERCENT_MIN || discountPercent > DISCOUNT_PERCENT_MAX);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-discount-${tierId}-percent`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.discount.tier.percentTitle')}
      </label>

      <div className="flex items-center gap-2">
        <input
          id={`step6-discount-${tierId}-percent`}
          type="number"
          inputMode="numeric"
          value={discountPercent}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              // Empty → set to 1 (min valid percent). User can change later.
              updateDiscountTier(tierId, { discountPercent: 1 });
              return;
            }
            const num = parseFloat(raw);
            if (
              Number.isNaN(num) ||
              num < DISCOUNT_PERCENT_MIN ||
              num > DISCOUNT_PERCENT_MAX
            ) {
              return; // store guards out-of-range
            }
            updateDiscountTier(tierId, { discountPercent: Math.round(num) });
          }}
          placeholder={t('step6.discount.tier.percentPlaceholder')}
          min={DISCOUNT_PERCENT_MIN}
          max={DISCOUNT_PERCENT_MAX}
          aria-label={t('step6.discount.tier.percentTitle')}
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
          {t('step6.discount.tier.percentUnit')}
        </span>
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {discountPercent > DISCOUNT_PERCENT_MAX
            ? t('step6.discount.tier.percentTooLargeError')
            : t('step6.discount.tier.percentInvalidError')}
        </p>
      )}
    </div>
  );
}
