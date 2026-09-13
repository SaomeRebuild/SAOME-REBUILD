/**
 * MembershipTierDurationTypeField — Membership tier sub-field 2 (月/年卡單選).
 *
 * Renders two radio buttons (月費 / 年費). Only rendered when card-wide
 * `hasExpiry === true` (the parent `MembershipTierRow` controls visibility).
 *
 * Calls `updateMembershipTier(tierId, { durationType })` on change.
 * Store guard: only 'monthly' | 'yearly' | null allowed.
 *
 * Validation: when `showValidation` and tier's name is filled but durationType
 * is null, show an inline error.
 *
 * Visual: uses the shared `.radio-card-primary` CSS pattern
 * (`apps/frontend/src/index.css` line 216). Selected state drives the
 * border + bg tint + glow shadow via `:has(:checked)` — single source of
 * truth, no React conditional. The `.radio-card-fill` child span flips
 * to SAOME primary (orange #F97316) when the label's checked radio fires.
 *
 * Why this matters (regression 2026-09-13):
 *   The previous implementation used React conditional classes
 *   (`border-primary bg-primary/10 text-primary`) which only colored
 *   the border + a 10% bg tint — visually subtle, tenants reported they
 *   could not tell which Monthly/Yearly option was selected. The shared
 *   `.radio-card-primary` pattern gives a clearly distinguishable
 *   selected state (orange border + 5% bg + glow shadow + filled dot
 *   indicator), matching the pattern used by StampAccrualModeField and
 *   EarningModeField.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { MembershipTierDurationTypeFieldProps } from './MembershipCardLogic.types';

export function MembershipTierDurationTypeField({
  showValidation,
  tierId,
}: MembershipTierDurationTypeFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.membershipTiers.find((tier) => tier.id === tierId),
  );
  const updateMembershipTier = useCardBuilderStore((s) => s.updateMembershipTier);

  if (!tier) return null;

  const durationType = tier.durationType;
  const isInvalid = showValidation && durationType === null && tier.name.trim() !== '';

  // Helper to render a single radio-card option (monthly / yearly).
  // Each label is a `.radio-card-primary` element so the CSS `:has(:checked)`
  // pseudo selector drives the selected visuals (orange border + bg + glow).
  const renderOption = (
    value: 'monthly' | 'yearly',
    labelKey: string,
  ) => (
    <label
      htmlFor={`step6-membership-${tierId}-duration-${value}`}
      className="
        radio-card-primary group relative flex flex-1 cursor-pointer items-center
        justify-center gap-2 rounded-md border border-border bg-background
        px-3 py-2 text-sm font-medium
        transition-all duration-150
        hover:scale-[1.01]
        active:scale-[0.99]
        focus-within:outline-2 focus-within:outline-offset-2
        focus-within:outline-[var(--color-ring)]
      "
    >
      {/* Hidden native radio — visually hidden but accessible + clickable */}
      <input
        id={`step6-membership-${tierId}-duration-${value}`}
        type="radio"
        name={`step6-membership-${tierId}-duration`}
        value={value}
        checked={durationType === value}
        onChange={() => updateMembershipTier(tierId, { durationType: value })}
        className="sr-only"
        aria-label={t(labelKey)}
      />

      {/* Visual radio indicator — fills with SAOME primary (orange) on selection
          via `.radio-card-primary:has(:checked) .radio-card-fill` in index.css.
          Pattern A — single source of truth, no inner 8×8 dot. */}
      <span
        aria-hidden="true"
        className="
          radio-card-fill flex h-4 w-4 shrink-0 items-center justify-center rounded-full
          border-2 border-muted-foreground/40 bg-transparent
          transition-colors duration-150
        "
      />

      <span
        className="
          radio-card-icon text-foreground transition-colors duration-150
        "
      >
        {t(labelKey)}
      </span>
    </label>
  );

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="text-xs font-medium text-muted-foreground">
        {t('step6.membership.tier.durationTitle')}
      </legend>
      <div className="flex min-w-0 gap-2">
        {renderOption('monthly', 'step6.membership.tier.durationMonthly')}
        {renderOption('yearly', 'step6.membership.tier.durationYearly')}
      </div>
      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.membership.tier.durationRequiredError')}
        </p>
      )}
    </fieldset>
  );
}
