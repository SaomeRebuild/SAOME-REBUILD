/**
 * GiftCardAmountField — Gift card sub-field 1 (消費金額).
 *
 * 2026-09-27: New for gift_card editor. Always rendered (no conditional
 * branch — gift card has only one rule, not radio-selected like coupon).
 *
 * Currency-aware unit placement (mirrors CashbackTierThresholdField +
 * CouponDiscountAmountField pattern):
 *   - TWD zh-TW: 「消費 [input] 元」 → suffix
 *   - TWD en:    「Spend NT$ [input]」 → prefix
 *   - ZAR:       「Spend R [input]」    → prefix
 *
 * Reads top-level `giftCardAmount` from store and writes via
 * `setGiftCardAmount`. Store guard:
 *   - 整數 ≥ 1; rejects ≤ 0, NaN, 非整數 (mirrors setRewardValue)
 *   - No null support (gift card must always have a defined rate;
 *     defaults to 1 in initialState)
 *
 * Validation: when showValidation=true AND value ≤ 0 (defensive — store
 * setter already rejects, but a corrupted DB row could leak through
 * loadSettings), show red border + error message.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { GiftCardAmountFieldProps } from './GiftCardLogic.types';

export function GiftCardAmountField({ showValidation }: GiftCardAmountFieldProps) {
  const { t, i18n } = useTranslation('cardEditor');
  const giftCardAmount = useCardBuilderStore((s) => s.giftCardAmount);
  const currency = useCardBuilderStore((s) => s.currency);
  const setGiftCardAmount = useCardBuilderStore((s) => s.setGiftCardAmount);

  // Currency-aware unit placement (mirrors CouponDiscountAmountField pattern).
  // - TWD zh-TW: 「消費 [input] 元」  → suffix
  // - TWD en:    「Spend NT$ [input]」 → prefix
  // - ZAR:       「Spend R [input]」    → prefix
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').startsWith('zh');
  const unitPrefix = isZAR
    ? t('step6.gift.amountUnitZAR')
    : !isZhLocale
    ? t('step6.gift.amountUnitTWD') // TWD en: NT$ prefix
    : '';
  const unitSuffix = isZAR
    ? ''
    : isZhLocale
    ? t('step6.gift.amountUnitTWD') // TWD zh-TW: 元 suffix
    : '';

  // Invalid if value is ≤ 0 or not a finite integer. Store setter already
  // rejects these, but defensive re-check handles corrupted DB rows.
  const isInvalid =
    showValidation &&
    (typeof giftCardAmount !== 'number' ||
      !Number.isFinite(giftCardAmount) ||
      giftCardAmount <= 0);
  const displayValue = giftCardAmount === null || giftCardAmount === undefined
    ? ''
    : String(giftCardAmount);

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-gift-amount"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.gift.amountLabel')}
      </label>

      <div className="flex items-center gap-2">
        {unitPrefix && (
          <span className="shrink-0 text-sm text-muted-foreground">{unitPrefix}</span>
        )}
        <input
          id="step6-gift-amount"
          type="number"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              // Don't reset to null/empty — keep the previous value (store
              // has no null support; gift card must always have a defined
              // rate). Setting to 0 would be rejected by the store setter,
              // so we just bail out.
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num)) return;
            // Store guard rejects ≤ 0 / non-integer; <input type="number">
            // already constrains typing to digits, but paste can sneak in
            // decimals / negatives — let the setter reject them.
            setGiftCardAmount(num);
          }}
          placeholder={t('step6.gift.placeholderAmount')}
          min={1}
          aria-label={t('step6.gift.amountLabel')}
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
          {giftCardAmount <= 0
            ? t('step6.gift.validation.positive')
            : t('step6.gift.validation.required')}
        </p>
      )}
    </section>
  );
}