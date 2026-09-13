/**
 * MembershipSpecificExpiryDateField — Free membership card sub-field (指定到期日).
 *
 * 2026-09-14: New for free membership card editor (isPaid=false).
 * Renders an `<input type="date">` for the specific expiry date
 * (ISO YYYY-MM-DD). Only shown when `membershipExpiryMode === 'specific_date'`.
 *
 * Mirrors `ExpiryDateField` (Step 2) pattern:
 *   - Native HTML date input — RN migration will replace with react-native-datepicker.
 *   - `min={today}` — prevents user from picking a past date.
 *   - Reads top-level `membershipSpecificExpiryDate` from store.
 *   - Writes via `setMembershipSpecificExpiryDate`.
 *   - Store guard: rejects strings not matching /^\d{4}-\d{2}-\d{2}$/.
 *
 * Mobile-friendly: native date picker gives consistent UX across iOS/Android
 * browsers. RN migration swaps this for react-native-datepicker.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { MembershipSpecificExpiryDateFieldProps } from './MembershipCardLogic.types';

/**
 * Get today's date in ISO YYYY-MM-DD format (local timezone).
 * Used to set `min` attribute on the date picker so users can't pick past dates.
 *
 * Exported for unit testing.
 */
export function getTodayIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function MembershipSpecificExpiryDateField({
  showValidation,
}: MembershipSpecificExpiryDateFieldProps) {
  const { t } = useTranslation('cardEditor');
  const date = useCardBuilderStore((s) => s.membershipSpecificExpiryDate);
  const setDate = useCardBuilderStore((s) => s.setMembershipSpecificExpiryDate);

  const todayIso = getTodayIsoDate();
  const isInvalid =
    showValidation &&
    (date === null || date < todayIso);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-membership-specific-expiry-date"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.membership.freeSpecificExpiryDateTitle')}
      </label>

      <input
        id="step6-membership-specific-expiry-date"
        type="date"
        value={date ?? ''}
        min={todayIso}
        onChange={(e) => {
          setDate(e.target.value === '' ? null : e.target.value);
        }}
        aria-label={t('step6.membership.freeSpecificExpiryDateTitle')}
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
          {date === null
            ? t('step6.membership.freeSpecificExpiryDateRequiredError')
            : t('step6.membership.freeSpecificExpiryDatePastError')}
        </p>
      )}
    </div>
  );
}
