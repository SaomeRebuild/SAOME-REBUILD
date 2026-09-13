/**
 * MembershipCustomExpiryDaysField — Free membership card sub-field (有效天數).
 *
 * 2026-09-14: New for free membership card editor (isPaid=false).
 * Renders an `<input type="number">` for the custom validity days
 * (1-3650). Only shown when `membershipExpiryMode === 'custom_days'`.
 *
 * Mirrors `CashbackTierPercentField`'s pattern:
 *   - `inputMode="numeric"` for mobile keypad.
 *   - Reads top-level `membershipCustomExpiryDays` from store.
 *   - Writes via `setMembershipCustomExpiryDays`.
 *   - Store guard: rejects NaN, non-integer, out-of-range.
 *   - Range error message renders when showValidation is on AND value is invalid.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import {
  CUSTOM_EXPIRY_DAYS_MIN,
  CUSTOM_EXPIRY_DAYS_MAX,
} from '@saome/shared/constants/membership-card';
import type { MembershipCustomExpiryDaysFieldProps } from './MembershipCardLogic.types';

export function MembershipCustomExpiryDaysField({
  showValidation,
}: MembershipCustomExpiryDaysFieldProps) {
  const { t } = useTranslation('cardEditor');
  const days = useCardBuilderStore((s) => s.membershipCustomExpiryDays);
  const setDays = useCardBuilderStore((s) => s.setMembershipCustomExpiryDays);

  const isInvalid =
    showValidation &&
    (days === null ||
      days < CUSTOM_EXPIRY_DAYS_MIN ||
      days > CUSTOM_EXPIRY_DAYS_MAX);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-membership-custom-expiry-days"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.membership.freeCustomExpiryDaysTitle')}
      </label>

      <div className="flex items-center gap-2">
        <input
          id="step6-membership-custom-expiry-days"
          type="number"
          inputMode="numeric"
          value={days ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              setDays(null);
              return;
            }
            const num = parseInt(raw, 10);
            if (
              Number.isNaN(num) ||
              num < CUSTOM_EXPIRY_DAYS_MIN ||
              num > CUSTOM_EXPIRY_DAYS_MAX
            ) {
              // Set anyway — store guard clamps to range.
              // User sees feedback via validation error after Next click.
              setDays(num);
              return;
            }
            setDays(num);
          }}
          placeholder={t('step6.membership.freeCustomExpiryDaysPlaceholder')}
          min={CUSTOM_EXPIRY_DAYS_MIN}
          max={CUSTOM_EXPIRY_DAYS_MAX}
          aria-label={t('step6.membership.freeCustomExpiryDaysTitle')}
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
          {t('step6.membership.freeCustomExpiryDaysUnit')}
        </span>
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.membership.freeCustomExpiryDaysRangeError')}
        </p>
      )}
    </div>
  );
}
