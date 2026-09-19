/**
 * CouponDiscountAmountField — Coupon card sub-field 2a (現金折扣金額).
 *
 * 2026-09-19: New for coupon_card editor. Conditional render — ONLY
 * visible when `couponDiscountType === 'amount_off'`. Mirrors the
 * currency-aware pattern of `CashbackTierThresholdField.tsx` exactly:
 *   - TWD zh-TW: suffix 元 (e.g. "使用一次折扣 50元")
 *   - TWD en:    prefix NT$ (e.g. "Discount per Use NT$50")
 *   - ZAR:       prefix R (e.g. "Discount per Use R50")
 *
 * Reads top-level `couponDiscountAmount` from store and writes via
 * `setCouponDiscountAmount`. Store guard:
 *   - null 允許（清空）
 *   - number 必須 ≥ COUPON_AMOUNT_MIN=1 且 Number.isFinite
 *   - 無上限（user decision 2026-09-19）
 *
 * Validation: when showValidation=true AND value is null OR < 1, show red border
 * + error message.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { CouponDiscountAmountFieldProps } from './CouponCardLogic.types';

export function CouponDiscountAmountField({ showValidation }: CouponDiscountAmountFieldProps) {
  const { t, i18n } = useTranslation('cardEditor');
  const couponDiscountType = useCardBuilderStore((s) => s.couponDiscountType);
  const couponDiscountAmount = useCardBuilderStore((s) => s.couponDiscountAmount);
  const currency = useCardBuilderStore((s) => s.currency);
  const setCouponDiscountAmount = useCardBuilderStore((s) => s.setCouponDiscountAmount);

  // Conditional render: only show when user picked 'amount_off'.
  if (couponDiscountType !== 'amount_off') return null;

  // Currency-aware unit placement (mirrors CashbackTierThresholdField pattern).
  // - TWD zh-TW: 「使用一次折扣 [input] 元」  → suffix
  // - TWD en:    「使用一次折扣 NT$ [input]」 → prefix
  // - ZAR:       「使用一次折扣 R [input]」    → prefix
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').startsWith('zh');
  const unitPrefix = isZAR
    ? t('step6.coupon.amountUnitZAR')
    : !isZhLocale
    ? t('step6.coupon.amountUnitTWD') // TWD en: NT$ prefix
    : '';
  const unitSuffix = isZAR
    ? ''
    : isZhLocale
    ? t('step6.coupon.amountUnitTWD') // TWD zh-TW: 元 suffix
    : '';

  const isInvalid = showValidation && (couponDiscountAmount === null || couponDiscountAmount < 1);
  const displayValue = couponDiscountAmount === null ? '' : String(couponDiscountAmount);

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-coupon-discount-amount"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.coupon.amountTitle')}
      </label>

      <div className="flex items-center gap-2">
        {unitPrefix && (
          <span className="shrink-0 text-sm text-muted-foreground">{unitPrefix}</span>
        )}
        <input
          id="step6-coupon-discount-amount"
          type="number"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              setCouponDiscountAmount(null);
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num)) return;
            // Store guard rejects < 1
            setCouponDiscountAmount(num);
          }}
          placeholder={t('step6.coupon.amountPlaceholder')}
          min={1}
          aria-label={t('step6.coupon.amountTitle')}
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
        {unitSuffix && (
          <span className="shrink-0 text-sm text-muted-foreground">{unitSuffix}</span>
        )}
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {couponDiscountAmount === null
            ? t('step6.coupon.amountRequiredError')
            : t('step6.coupon.amountInvalidError')}
        </p>
      )}
    </section>
  );
}
