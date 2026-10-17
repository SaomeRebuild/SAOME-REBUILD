/**
 * PassHolderMembershipTiers — main L2 assembly for the paid-membership
 * registration flow. Renders below the 4 pass-delivery fields when
 * `template.isPaid === true` AND `template.membershipTiers.length > 0`.
 *
 * Composition (≤ 100 lines per Rule 000 §A.2):
 *   1. Section header (title + hint)
 *   2. `PassHolderMembershipTierRow` × N (Radio Card list)
 *   3. `PassHolderPaymentButton` (Payfast or Ecpay, currency-driven)
 *
 * All i18n keys resolve against the existing `passHolder` namespace
 * (`membership.*` block, see apps/frontend/src/i18n/locales/passHolder.*).
 */

import { useTranslation } from 'react-i18next';
import { PassHolderMembershipTierRow } from './PassHolderMembershipTierRow';
import { PassHolderPaymentButton } from './PassHolderPaymentButton';
import {
  currencySymbol,
  resolvePaymentProvider,
} from './PassHolderMembershipTiers.types';
import type { PassHolderMembershipTiersProps } from './PassHolderMembershipTiers.types';

export function PassHolderMembershipTiers({
  template,
  selectedTierIndex,
  onSelectTier,
  paymentState,
  onSimulatePayment,
  disabled,
}: PassHolderMembershipTiersProps) {
  const { t } = useTranslation('passHolder');
  const tiers = template.membershipTiers ?? [];
  const provider = resolvePaymentProvider(template.currency);
  const currency = template.currency ?? 'TWD';

  // Defensive guard — caller is expected to check, but never trust upstream.
  if (!tiers.length) return null;

  // 2026-10-16 — CTA shows amount + action so user knows what they pay
  // and what they get before clicking. Three-branch resolution:
  //   1. tier selected with cost > 0 → "Pay {amount} & Get Pass"
  //   2. tier selected with cost === null → "Get Free Pass"
  //   3. no tier selected → fallback to provider-specific "Pay with X"
  // The button sub-component is purely presentational; all translation
  // decisions happen here (Rule 023 § component-bound i18n discipline).
  const selectedTier =
    selectedTierIndex !== null ? tiers[selectedTierIndex] : undefined;
  const tierCost = selectedTier
    ? selectedTier.durationType === 'monthly'
      ? selectedTier.monthlyCost
      : selectedTier.yearlyCost
    : null;
  const idleLabel =
    selectedTier && tierCost !== null
      ? t('membership.payWithTierAction', {
          amount: `${currencySymbol(currency)} ${tierCost}`,
        })
      : selectedTier
        ? t('membership.payWithFreeTier')
        : provider === 'payfast'
          ? t('membership.payButton.payfast')
          : t('membership.payButton.ecpay');

  return (
    <section
      className="flex flex-col gap-3"
      data-testid="pass-holder-membership-tiers"
      aria-labelledby="pass-holder-membership-title"
    >
      <header className="flex flex-col gap-1">
        <h2
          id="pass-holder-membership-title"
          className="text-lg font-semibold"
          style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-family-heading)' }}
        >
          {t('membership.sectionTitle')}
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('membership.sectionHint')}
        </p>
      </header>

      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-labelledby="pass-holder-membership-title"
        data-testid="pass-holder-tier-list"
      >
        {tiers.map((tier, index) => (
          <PassHolderMembershipTierRow
            key={tier.name}
            tier={tier}
            index={index}
            currency={currency}
            labels={{
              costFree: t('membership.costFree'),
              perMonth: t('membership.perMonth'),
              perYear: t('membership.perYear'),
              rewardsLabel: t('membership.rewardsLabel'),
            }}
            selected={selectedTierIndex === index}
            onSelect={onSelectTier}
            disabled={disabled}
          />
        ))}
      </div>

      <PassHolderPaymentButton
        provider={provider}
        paymentState={paymentState}
        labels={{
          idleLabel,
          paying: t('membership.paying'),
          paid: t('membership.paid'),
        }}
        onClick={onSimulatePayment}
        disabled={disabled || selectedTierIndex === null}
      />
    </section>
  );
}
