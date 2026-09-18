/**
 * DiscountExpiryFields — Discount card section (卡片有效期限，必填).
 *
 * 2026-09-18: Updated per user clarification — card expiry is REQUIRED
 * (not optional). The user must fill at least one of:
 *   1. <DiscountCustomExpiryDaysField />   — custom validity days (1-3650)
 *   2. <DiscountSpecificExpiryDateField /> — specific expiry date (ISO YYYY-MM-DD)
 *
 * If both are null, the workspace's `isDiscountStep6Valid()` returns false
 * and the "Next" button is disabled. This component also surfaces an
 * inline `expiryBothNullError` message under the section header when
 * `showValidation` is true and both fields are empty.
 *
 * Mutual exclusion logic lives HERE (at the field handler level), NOT in
 * the store setter — the store setters are pure functions, so each field's
 * `onChange` clears the other when it sets a non-null value.
 *
 * Mirrors `PassValidDaysField` ↔ `ExpiryDateField` pattern from Step 2,
 * with the extra "at least one must be filled" gate layered on top.
 *
 * Both fields always visible (no `hasDiscountExpiry` toggle — matches user
 * clarification: "no toggle"). User simply fills one of the two.
 */

import { useTranslation } from 'react-i18next';
import { CalendarIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { DiscountCustomExpiryDaysField } from './DiscountCustomExpiryDaysField';
import { DiscountSpecificExpiryDateField } from './DiscountSpecificExpiryDateField';
import type { DiscountExpiryFieldsProps } from './DiscountCardLogic.types';

export function DiscountExpiryFields({ showValidation }: DiscountExpiryFieldsProps) {
  const { t } = useTranslation('cardEditor');

  const days = useCardBuilderStore((s) => s.discountCustomExpiryDays);
  const date = useCardBuilderStore((s) => s.discountSpecificExpiryDate);
  const setDays = useCardBuilderStore((s) => s.setDiscountCustomExpiryDays);
  const setDate = useCardBuilderStore((s) => s.setDiscountSpecificExpiryDate);

  /**
   * Mutual exclusion handler for days input.
   * Setting a non-null value clears the date (the other field).
   */
  const handleDaysChange = (newDays: number | null) => {
    setDays(newDays);
    if (newDays !== null) setDate(null);
  };

  /**
   * Mutual exclusion handler for date input.
   * Setting a non-null value clears the days (the other field).
   */
  const handleDateChange = (newDate: string | null) => {
    setDate(newDate);
    if (newDate !== null) setDays(null);
  };

  // Per user clarification 2026-09-18: card expiry is REQUIRED for discount
  // cards. The user must fill at least ONE of (days, date). If both are null
  // AND showValidation is on (the user has tried to advance past Step 6),
  // surface the inline `expiryBothNullError` message at the section level
  // so the user immediately understands the constraint without having to
  // inspect each field individually.
  const bothAreNull = days === null && date === null;
  const showBothNullError = showValidation && bothAreNull;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="flex items-center gap-2 text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          <CalendarIcon size={16} aria-hidden="true" className="text-primary" />
          {t('step6.discount.expiryTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.discount.expiryHint')}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <DiscountCustomExpiryDaysField
          showValidation={showValidation}
          value={days}
          onChange={handleDaysChange}
        />
        <DiscountSpecificExpiryDateField
          showValidation={showValidation}
          value={date}
          onChange={handleDateChange}
        />
      </div>

      {/* Both-null error — shown when the user tried to advance past Step 6
          but neither expiry field is filled. (Required-by-clause: at least
          one must be set; otherwise use Cashback card.) Sits between the
          two field rows so it's read AFTER the user sees each field but
          BEFORE the tier list below. */}
      {showBothNullError && (
        <p
          className="text-sm font-medium text-destructive"
          role="alert"
          data-testid="discount-expiry-both-null-error"
        >
          {t('step6.discount.expiryBothNullError')}
        </p>
      )}

      {/* When the date field is set, show a hint reminding the user that the
          days field was cleared (the field handler already did this; this is
          just UX feedback so the user understands what happened). Only shown
          when the both-null error is NOT also active (otherwise the two
          messages would compete for the user's attention). */}
      {date !== null && !showBothNullError && (
        <p className="text-xs text-muted-foreground">
          {t('step6.discount.specificExpiryDateHint')}
        </p>
      )}
    </section>
  );
}
