/**
 * CouponDiscountTypeField — Coupon card sub-field 1 (折扣類型).
 *
 * 2026-09-19: New for coupon_card editor. Renders a 2-option radio group:
 *   - amount_off: 現金折扣 (couponDiscountAmount 生效)
 *   - percent_off: % 數折扣 (couponDiscountPercent 生效)
 *
 * Reads top-level `couponDiscountType` from store and writes via
 * `setCouponDiscountType`. Switching type ALSO clears the corresponding
 * other field — handled by the store setter (mirrors `setRewardType`
 * pattern at store.ts `setRewardType`).
 *
 * Visual pattern (Radio Card Pattern A — see apps/frontend/src/index.css):
 *   - Native `<input type="radio">` is hidden behind an absolutely-positioned
 *     transparent overlay that captures clicks across the whole label.
 *   - **Selected state** is driven entirely by the `:has(:checked)` CSS rule
 *     on the `.radio-card-primary` class — no React conditional, no inline
 *     style.
 *
 * Mirrors `MembershipExpiryModeField.tsx` (2-option, horizontal grid) and
 * `EarningModeField.tsx` (icon + label layout).
 */

import { useTranslation } from 'react-i18next';
import { DollarSignIcon, PercentIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { CouponDiscountTypeFieldProps } from './CouponCardLogic.types';
import type { CouponDiscountType } from '@saome/shared/constants';

const TYPE_ICONS = {
  amount_off: DollarSignIcon,
  percent_off: PercentIcon,
} as const;

const TYPE_ORDER: CouponDiscountType[] = ['amount_off', 'percent_off'];

export function CouponDiscountTypeField({
  showValidation,
}: CouponDiscountTypeFieldProps) {
  const { t } = useTranslation('cardEditor');
  const couponDiscountType = useCardBuilderStore((s) => s.couponDiscountType);
  const setCouponDiscountType = useCardBuilderStore((s) => s.setCouponDiscountType);

  // Validation: type must be selected (defaults to 'amount_off' so
  // technically always set, but showValidation flag covers the edge
  // case where DB loadSettings returns null/undefined).
  const isInvalid = showValidation && couponDiscountType === null;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="text-sm font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.coupon.discountTypeTitle')}
        </h3>
      </header>

      {/* Two side-by-side radio cards — Pattern A (primary fill, no inner dot).
          Selected visuals driven by `.radio-card-primary :has(:checked)` rule
          in index.css — single source of truth, no inline style. */}
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-label={t('step6.coupon.discountTypeTitle')}
        aria-invalid={isInvalid}
      >
        {TYPE_ORDER.map((type) => {
          const Icon = TYPE_ICONS[type];
          return (
            <label
              key={type}
              htmlFor={`step6-coupon-discount-type-${type}`}
              className="
                radio-card-primary group relative flex items-start gap-3 rounded-lg
                border border-border bg-card p-3
                transition-all duration-150
                hover:scale-[1.01]
                active:scale-[0.99]
                focus-within:outline-2 focus-within:outline-offset-2
                focus-within:outline-[var(--color-ring)]
              "
            >
              {/* Hidden native radio — absolutely-positioned overlay captures clicks across the whole label */}
              <input
                id={`step6-coupon-discount-type-${type}`}
                type="radio"
                name="step6-coupon-discount-type"
                value={type}
                checked={couponDiscountType === type}
                onChange={() => setCouponDiscountType(type)}
                className="absolute opacity-0 size-5 cursor-pointer top-3 left-3"
              />

              {/* Visual radio indicator — Pattern A: fills with SAOME 橘色 on selection
                  via `.radio-card-primary:has(:checked) .radio-card-fill` in index.css. */}
              <span
                aria-hidden="true"
                className="
                  radio-card-fill mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                  border-2 border-muted-foreground/40 bg-transparent
                  transition-colors duration-150
                "
              />

              {/* Icon + label */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Icon
                  size={14}
                  aria-hidden="true"
                  className="radio-card-icon text-muted-foreground transition-colors duration-150"
                />
                <span className="text-sm font-medium text-foreground">
                  {t(
                    type === 'amount_off'
                      ? 'step6.coupon.discountTypeAmount'
                      : 'step6.coupon.discountTypePercent',
                  )}
                </span>
              </div>
            </label>
          );
        })}
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.coupon.discountTypeRequiredError')}
        </p>
      )}
    </section>
  );
}
