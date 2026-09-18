/**
 * DiscountSpecificExpiryDateField — Discount card sub-field (指定到期日).
 *
 * 2026-09-18: New for discount card editor.
 * Controlled component: parent (DiscountExpiryFields) provides `value` and
 * `onChange` for mutual exclusion with DiscountCustomExpiryDaysField.
 *
 * When the parent's onChange is invoked with a non-null value, the parent
 * clears the other expiry field (mutual exclusion enforced at handler level).
 *
 * Mirrors `MembershipSpecificExpiryDateField` pattern but exposed as
 * a controlled component so the parent can compose the mutual-exclusion
 * handler.
 */

import { useTranslation } from 'react-i18next';
import type { DiscountSpecificExpiryDateFieldProps } from './DiscountCardLogic.types';

/**
 * Get today's date in ISO YYYY-MM-DD format (local timezone).
 * Used to set `min` attribute on the date picker so users can't pick past dates.
 */
export function getTodayIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DiscountSpecificExpiryDateField({
  showValidation,
  value,
  onChange,
}: DiscountSpecificExpiryDateFieldProps) {
  const { t } = useTranslation('cardEditor');

  const todayIso = getTodayIsoDate();

  // Per user clarification 2026-09-18: card expiry is REQUIRED (at least
  // one of days/date must be set). The "value === null" case is no longer
  // flagged as invalid at the FIELD level — instead the section-level
  // `expiryBothNullError` message in DiscountExpiryFields covers the
  // "both are null" scenario. The field-level error here ONLY fires for
  // a non-null date that has already passed — so the red border on the
  // input means "this date is in the past, please pick a future date",
  // NOT "you must fill this field".
  const isInvalid =
    showValidation &&
    value !== null &&
    value < todayIso;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-discount-specific-expiry-date"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.discount.specificExpiryDateTitle')}
      </label>

      <input
        id="step6-discount-specific-expiry-date"
        type="date"
        value={value ?? ''}
        min={todayIso}
        onChange={(e) => {
          onChange(e.target.value === '' ? null : e.target.value);
        }}
        aria-label={t('step6.discount.specificExpiryDateTitle')}
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

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.discount.specificExpiryDatePastError')}
        </p>
      )}
    </div>
  );
}
