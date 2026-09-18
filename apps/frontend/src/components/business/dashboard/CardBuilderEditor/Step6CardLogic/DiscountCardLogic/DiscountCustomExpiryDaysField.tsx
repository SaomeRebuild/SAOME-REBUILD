/**
 * DiscountCustomExpiryDaysField — Discount card sub-field (有效天數).
 *
 * 2026-09-18: New for discount card editor.
 * Controlled component: parent (DiscountExpiryFields) provides `value` and
 * `onChange` for mutual exclusion with DiscountSpecificExpiryDateField.
 *
 * When the parent's onChange is invoked with a non-null value, the parent
 * clears the other expiry field (mutual exclusion enforced at handler level).
 *
 * Store guard: rejects NaN, non-integer, out-of-range.
 */

import { useTranslation } from 'react-i18next';
import {
  DISCOUNT_CUSTOM_EXPIRY_DAYS_MIN,
  DISCOUNT_CUSTOM_EXPIRY_DAYS_MAX,
} from '@saome/shared/constants';
import type { DiscountCustomExpiryDaysFieldProps } from './DiscountCardLogic.types';

export function DiscountCustomExpiryDaysField({
  showValidation,
  value,
  onChange,
}: DiscountCustomExpiryDaysFieldProps) {
  const { t } = useTranslation('cardEditor');

  // Per user clarification 2026-09-18: card expiry is REQUIRED (at least
  // one of days/date must be set). The "value === null" case is no longer
  // flagged as invalid at the FIELD level — instead the section-level
  // `expiryBothNullError` message in DiscountExpiryFields covers the
  // "both are null" scenario. The field-level error here ONLY fires for
  // genuinely out-of-range values (e.g. user typed 9999) — so the red
  // border on the input means "this value is wrong, please fix it",
  // NOT "you must fill this field".
  const isInvalid =
    showValidation &&
    value !== null &&
    (value < DISCOUNT_CUSTOM_EXPIRY_DAYS_MIN ||
      value > DISCOUNT_CUSTOM_EXPIRY_DAYS_MAX);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-discount-custom-expiry-days"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.discount.customExpiryDaysTitle')}
      </label>

      <div className="flex items-center gap-2">
        <input
          id="step6-discount-custom-expiry-days"
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              onChange(null);
              return;
            }
            const num = parseInt(raw, 10);
            if (
              Number.isNaN(num) ||
              num < DISCOUNT_CUSTOM_EXPIRY_DAYS_MIN ||
              num > DISCOUNT_CUSTOM_EXPIRY_DAYS_MAX
            ) {
              // Set anyway — store guard clamps to range.
              // User sees feedback via validation error after Next click.
              onChange(num);
              return;
            }
            onChange(num);
          }}
          placeholder={t('step6.discount.customExpiryDaysPlaceholder')}
          min={DISCOUNT_CUSTOM_EXPIRY_DAYS_MIN}
          max={DISCOUNT_CUSTOM_EXPIRY_DAYS_MAX}
          aria-label={t('step6.discount.customExpiryDaysTitle')}
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
          {t('step6.discount.customExpiryDaysUnit')}
        </span>
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.discount.customExpiryDaysRangeError')}
        </p>
      )}
    </div>
  );
}
