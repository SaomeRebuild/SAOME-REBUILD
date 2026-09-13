/**
 * MembershipExpiryModeField — Free membership card sub-field (到期設定 模式).
 *
 * 2026-09-14: New for free membership card editor (isPaid=false).
 * Renders a two-option radio group:
 *   - custom_days: 自訂 N 天後到期 (customExpiryDays)
 *   - specific_date: 指定到期日 (specificExpiryDate, ISO YYYY-MM-DD)
 *
 * Reads top-level `membershipExpiryMode` from store and writes via
 * `setMembershipExpiryMode`. Switching mode ALSO clears the corresponding
 * other field — handled by the store setter (mirrors `setEarningMode` /
 * `setHasExpiry` pattern).
 *
 * Mirrors `EarningModeField`'s pattern (radio card layout), but with only
 * 2 options (vs EarningModeField's 3) and a horizontal layout (vs stacked)
 * to suit the free-card compact UI.
 *
 * Visual pattern (Radio Card Pattern A — see apps/frontend/src/index.css):
 *   - Native `<input type="radio">` is hidden behind an absolutely-positioned
 *     transparent overlay that captures clicks across the whole label.
 *   - **Selected state** is driven entirely by the `:has(:checked)` CSS rule
 *     on the `.radio-card-primary` class — no React conditional, no inline
 *     style.
 */

import { useTranslation } from 'react-i18next';
import { CalendarDaysIcon, CalendarClockIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { MembershipExpiryModeFieldProps } from './MembershipCardLogic.types';

const MODE_ICONS = {
  custom_days: CalendarDaysIcon,
  specific_date: CalendarClockIcon,
} as const;

const MODE_ORDER: Array<'custom_days' | 'specific_date'> = [
  'custom_days',
  'specific_date',
];

export function MembershipExpiryModeField({
  showValidation,
}: MembershipExpiryModeFieldProps) {
  const { t } = useTranslation('cardEditor');
  const membershipExpiryMode = useCardBuilderStore((s) => s.membershipExpiryMode);
  const setMembershipExpiryMode = useCardBuilderStore((s) => s.setMembershipExpiryMode);

  const isInvalid = showValidation && membershipExpiryMode === null;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h4
          className="text-sm font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.membership.freeExpiryModeTitle')}
        </h4>
      </header>

      {/* Two side-by-side radio cards — Pattern A (primary fill, no inner dot).
          Selected visuals driven by `.radio-card-primary :has(:checked)` rule
          in index.css — single source of truth, no inline style. */}
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-label={t('step6.membership.freeExpiryModeTitle')}
        aria-invalid={isInvalid}
      >
        {MODE_ORDER.map((mode) => {
          const Icon = MODE_ICONS[mode];
          return (
            <label
              key={mode}
              htmlFor={`step6-membership-expiry-mode-${mode}`}
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
                id={`step6-membership-expiry-mode-${mode}`}
                type="radio"
                name="step6-membership-expiry-mode"
                value={mode}
                checked={membershipExpiryMode === mode}
                onChange={() => setMembershipExpiryMode(mode)}
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
                    mode === 'custom_days'
                      ? 'step6.membership.freeExpiryModeCustomDays'
                      : 'step6.membership.freeExpiryModeSpecificDate',
                  )}
                </span>
              </div>
            </label>
          );
        })}
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.membership.freeExpiryModeRequiredError')}
        </p>
      )}
    </section>
  );
}
