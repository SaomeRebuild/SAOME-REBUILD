/**
 * CouponIssueCountField — Coupon card sub-field 3 (一次發卷張數).
 *
 * 2026-09-19: New for coupon_card editor. ALWAYS rendered (no
 * conditional — issue count is independent of discount type).
 *
 * Mirrors the layout of `DiscountTierPercentField.tsx` but for integer
 * count with no upper cap per user decision 2026-09-19.
 *
 * Reads top-level `couponIssueCount` from store and writes via
 * `setCouponIssueCount`. Store guard: integer ≥ COUPON_ISSUE_COUNT_MIN=1.
 *
 * Validation: when showValidation=true AND value < 1 OR non-integer, show red border
 * + error message. Helper text below input explains the ≥ 1 rule.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { CouponIssueCountFieldProps } from './CouponCardLogic.types';

export function CouponIssueCountField({ showValidation }: CouponIssueCountFieldProps) {
  const { t } = useTranslation('cardEditor');
  const couponIssueCount = useCardBuilderStore((s) => s.couponIssueCount);
  const setCouponIssueCount = useCardBuilderStore((s) => s.setCouponIssueCount);

  const isInvalid =
    showValidation &&
    (!Number.isInteger(couponIssueCount) || couponIssueCount < 1);
  const displayValue = String(couponIssueCount);

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-coupon-issue-count"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.coupon.issueCountTitle')}
      </label>

      <div className="flex items-center gap-2">
        <input
          id="step6-coupon-issue-count"
          type="number"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              // Empty input: do NOT clear — always keep ≥ 1.
              // Store guard rejects < 1 so user typing 0 / -1 is silently
              // rejected; we re-render with the previous valid value.
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num)) return;
            setCouponIssueCount(Math.round(num));
          }}
          placeholder={t('step6.coupon.issueCountPlaceholder')}
          min={1}
          aria-label={t('step6.coupon.issueCountTitle')}
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
          {t('step6.coupon.issueCountUnit')}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">{t('step6.coupon.issueCountHint')}</p>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.coupon.issueCountInvalidError')}
        </p>
      )}
    </section>
  );
}
