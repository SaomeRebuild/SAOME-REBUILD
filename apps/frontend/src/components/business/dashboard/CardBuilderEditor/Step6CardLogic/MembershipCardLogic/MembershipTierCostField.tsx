/**
 * MembershipTierCostField — Membership tier sub-field 3 (月費/年費/終身費).
 *
 * Renders a `<input type="number">` for the cost. Currency-aware rendering.
 *
 * Two operating modes (controlled by `lifetimeMode` prop):
 *
 *   1. **With-expiry mode** (lifetimeMode=false, default):
 *      Only rendered when card-wide `hasExpiry === true` (parent `MembershipTierRow`
 *      controls visibility). Reads/writes:
 *        - durationType === 'monthly' → `monthlyCost`
 *        - durationType === 'yearly'  → `yearlyCost`
 *        - durationType === null      → renders disabled (no duration selected).
 *
 *   2. **Lifetime mode** (lifetimeMode=true):
 *      Rendered when card-wide `hasExpiry === false`. Reads/writes `lifetimeCost`.
 *      The field is always enabled (no durationType dependency). Label changes
 *      to "終身費用" / "Lifetime Cost" and placeholder/hint updates.
 *
 *      2026-09-13: added per user clarification — even when "no expiry" is
 *      selected, the fee input must remain visible. Tenants use this to sell
 *      the right to a lifetime tier at a one-time price (consumer directly
 *      purchases lifetime membership).
 *
 * Currency-aware rendering (mirrors `CashbackTierThresholdField` pattern):
 *   - TWD zh-TW: suffix 元 (e.g. "月費 100元" / "終身費用 3000元")
 *   - TWD en:    prefix NT$ (e.g. "Monthly Fee NT$100" / "Lifetime Cost NT$3000")
 *   - ZAR:       prefix R (e.g. "Monthly Fee R100" / "Lifetime Cost R3000")
 *
 * cost = 0 IS a legitimate value (= "free" membership tier). The store guard
 * rejects < 0 only.
 *
 * Calls `updateMembershipTier(tierId, { monthlyCost | yearlyCost | lifetimeCost })`
 * on each change.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { MembershipTierCostFieldProps } from './MembershipCardLogic.types';

export function MembershipTierCostField({
  showValidation,
  tierId,
  lifetimeMode = false,
}: MembershipTierCostFieldProps) {
  const { t, i18n } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.membershipTiers.find((tier) => tier.id === tierId),
  );
  const currency = useCardBuilderStore((s) => s.currency);
  const updateMembershipTier = useCardBuilderStore((s) => s.updateMembershipTier);

  if (!tier) return null;

  // Determine which cost field we're editing based on mode.
  let activeCost: number | null;
  let costFieldName: 'monthlyCost' | 'yearlyCost' | 'lifetimeCost';
  let isInvalid: boolean;
  let disabled: boolean;
  let labelKey: string;
  let placeholderKey: string;

  if (lifetimeMode) {
    // Lifetime mode: writes to lifetimeCost. Field is always enabled.
    activeCost = tier.lifetimeCost;
    costFieldName = 'lifetimeCost';
    // In lifetime mode, cost=null is invalid ONLY when showValidation is on.
    // We don't gate on tier.name since the user may add the cost first then
    // the name (mirrors the with-expiry validation pattern).
    isInvalid = showValidation && (activeCost === null || activeCost < 0);
    disabled = false;
    labelKey = 'step6.membership.tier.lifetimeCostTitle';
    placeholderKey = 'step6.membership.tier.lifetimeCostPlaceholder';
  } else {
    // With-expiry mode: based on durationType.
    const { durationType } = tier;
    activeCost = durationType === 'yearly' ? tier.yearlyCost : tier.monthlyCost;
    costFieldName =
      durationType === 'yearly' ? 'yearlyCost' : 'monthlyCost';
    isInvalid =
      showValidation && durationType !== null && (activeCost === null || activeCost < 0);
    disabled = durationType === null;
    labelKey = 'step6.membership.tier.costTitle';
    placeholderKey =
      durationType === 'yearly'
        ? 'step6.membership.tier.costYearlyPlaceholder'
        : 'step6.membership.tier.costMonthlyPlaceholder';
  }

  // Currency-aware unit placement
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').startsWith('zh');
  const unitPrefix = isZAR
    ? t('step6.membership.tier.costUnitZAR')
    : !isZhLocale
    ? t('step6.membership.tier.costUnitTWD') // TWD en: NT$ prefix
    : '';
  const unitSuffix = isZAR
    ? ''
    : isZhLocale
    ? t('step6.membership.tier.costUnitTWD') // TWD zh-TW: 元 suffix
    : '';

  const displayValue = activeCost === null ? '' : String(activeCost);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-membership-${tierId}-cost`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t(labelKey)}
      </label>

      <div className="flex items-center gap-2">
        {unitPrefix && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {unitPrefix}
          </span>
        )}
        <input
          id={`step6-membership-${tierId}-cost`}
          type="number"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              updateMembershipTier(tierId, { [costFieldName]: null } as Partial<typeof tier>);
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num) || num < 0) return; // store guards < 0
            updateMembershipTier(tierId, { [costFieldName]: num } as Partial<typeof tier>);
          }}
          placeholder={t(placeholderKey)}
          min={0}
          disabled={disabled}
          aria-label={t(labelKey)}
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
          <span className="shrink-0 text-sm text-muted-foreground">
            {unitSuffix}
          </span>
        )}
      </div>

      {/* Helper text: cost=0 means "free membership tier" */}
      <p className="text-xs text-muted-foreground">
        {lifetimeMode
          ? t('step6.membership.tier.lifetimeCostZeroIsFree')
          : t('step6.membership.tier.costZeroIsFree')}
      </p>
    </div>
  );
}