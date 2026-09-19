/**
 * CouponDiscountPercentField — Coupon card sub-field 2b (% 數折扣).
 *
 * 2026-09-19: New for coupon_card editor. Conditional render — ONLY
 * visible when `couponDiscountType === 'percent_off'`. Mirrors the
 * layout of `DiscountTierPercentField.tsx` / `CashbackTierPercentField.tsx`
 * but without the per-row complexity (single value, not a tier row).
 *
 * No currency awareness — percent is currency-agnostic.
 *
 * Reads top-level `couponDiscountPercent` from store and writes via
 * `setCouponDiscountPercent`. Store guard:
 *   - null 允許（清空）
 *   - number 必須為整數 ∈ [COUPON_PERCENT_MIN=1, COUPON_PERCENT_MAX=100]
 *
 * Validation: when showValidation=true AND value is null OR < 1 OR > 100, show red border
 * + error message.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { CouponDiscountPercentFieldProps } from './CouponCardLogic.types';

export function CouponDiscountPercentField({ showValidation }: CouponDiscountPercentFieldProps) {
  const { t } = useTranslation('cardEditor');
  const couponDiscountType = useCardBuilderStore((s) => s.couponDiscountType);
  const couponDiscountPercent = useCardBuilderStore((s) => s.couponDiscountPercent);
  const setCouponDiscountPercent = useCardBuilderStore((s) => s.setCouponDiscountPercent);

  // Conditional render: only show when user picked 'percent_off'.
  if (couponDiscountType !== 'percent_off') return null;

  const isInvalid =
    showValidation &&
    (couponDiscountPercent === null ||
      !Number.isInteger(couponDiscountPercent) ||
      couponDiscountPercent < 1 ||
      couponDiscountPercent > 100);
  const displayValue = couponDiscountPercent === null ? '' : String(couponDiscountPercent);

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-coupon-discount-percent"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.coupon.percentTitle')}
      </label>

      <div className="flex items-center gap-2">
        <input
          id="step6-coupon-discount-percent"
          type="number"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              setCouponDiscountPercent(null);
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num)) return;
            // Store guard rejects non-integer / out-of-range
            setCouponDiscountPercent(num);
          }}
          placeholder={t('step6.coupon.percentPlaceholder')}
          min={1}
          max={100}
          aria-label={t('step6.coupon.percentTitle')}
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
          {t('step6.coupon.percentUnit')}
        </span>
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {couponDiscountPercent === null
            ? t('step6.coupon.percentRequiredError')
            : t('step6.coupon.percentInvalidError')}
        </p>
      )}
    </section>
  );
}
