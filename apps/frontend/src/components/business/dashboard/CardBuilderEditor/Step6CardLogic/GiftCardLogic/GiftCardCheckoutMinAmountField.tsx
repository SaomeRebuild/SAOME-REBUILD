/**
 * GiftCardCheckoutMinAmountField — Gift card sub-field 7 (顧客單筆交易最小付款金額).
 *
 * 2026-10-20: New for checkout fence (PR 2 of 雙層 fence 補強). Mirrors
 * `GiftCardAmountField` structurally but bound to the
 * `giftCardCheckoutMinAmount` store field — the customer-facing lower
 * bound of per-transaction currency amount.
 *
 * Currency-aware unit placement (mirrors GiftCardAmountField pattern):
 *   - TWD zh-TW: 「消費 [input] 元」 → suffix
 *   - TWD en:    「Spend NT$ [input]」 → prefix
 *   - ZAR:       「Spend R [input]」    → prefix
 *
 * Within-fence cross-field: 拒絕 > `giftCardCheckoutMaxAmount`.
 *
 * Validation: when showValidation=true AND value 違反 invariant,
 * show red border + error message.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { GiftCardCheckoutMinAmountFieldProps } from './GiftCardLogic.types';

export function GiftCardCheckoutMinAmountField({
  showValidation,
}: GiftCardCheckoutMinAmountFieldProps) {
  const { t, i18n } = useTranslation('cardEditor');
  const value = useCardBuilderStore((s) => s.giftCardCheckoutMinAmount);
  const maxValue = useCardBuilderStore((s) => s.giftCardCheckoutMaxAmount);
  const currency = useCardBuilderStore((s) => s.currency);
  const setValue = useCardBuilderStore((s) => s.setGiftCardCheckoutMinAmount);

  // Currency-aware unit placement (mirrors GiftCardAmountField).
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').startsWith('zh');
  const unitPrefix = isZAR
    ? t('step6.gift.amountUnitZAR')
    : !isZhLocale
    ? t('step6.gift.amountUnitTWD')
    : '';
  const unitSuffix = isZAR
    ? ''
    : isZhLocale
    ? t('step6.gift.amountUnitTWD')
    : '';

  const isOutOfBounds =
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1;
  const isOverMax =
    typeof value === 'number' &&
    typeof maxValue === 'number' &&
    Number.isInteger(value) &&
    Number.isInteger(maxValue) &&
    value > maxValue;
  const isInvalid = showValidation && (isOutOfBounds || isOverMax);

  const displayValue =
    value === null || value === undefined ? '' : String(value);

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-gift-checkout-min-amount"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.gift.checkout.minAmountLabel')}
      </label>

      <div className="flex items-center gap-2">
        {unitPrefix && (
          <span className="shrink-0 text-sm text-muted-foreground">{unitPrefix}</span>
        )}
        <input
          id="step6-gift-checkout-min-amount"
          type="number"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') return;
            const num = parseFloat(raw);
            if (Number.isNaN(num)) return;
            // Reject values that lose precision (> Number.MAX_SAFE_INTEGER)
            // to prevent corrupted `1.0000000000000003e+21` from entering the store.
            if (!Number.isSafeInteger(num)) {
              console.warn(
                '[GiftCardCheckoutMinAmountField] rejected unsafe integer:',
                raw,
                '→',
                num,
              );
              return;
            }
            setValue(num);
          }}
          placeholder={t('step6.gift.checkout.placeholderMinAmount')}
          min={1}
          max={Number.MAX_SAFE_INTEGER}
          step={1}
          aria-label={t('step6.gift.checkout.minAmountLabel')}
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
          {isOverMax
            ? t('step6.gift.validation.minGreaterThanMax')
            : t('step6.gift.validation.positive')}
        </p>
      )}
    </section>
  );
}