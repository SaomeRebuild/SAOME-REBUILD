/**
 * PassHolderRegistration.helpers — small pure functions used by the
 * main L2 component. Lives next to `.tsx` per the L2 folder convention
 * (Rule 000 § A.1). Business logic stays out of the JSX; the
 * `buildMembershipTierSnapshot` helper is the only "domain" function
 * because the shared/ side of the contract is just the `PublicPassTemplate`
 * / `MembershipTierSnapshot` types — they don't dictate the snapshot
 * composition rules.
 *
 * 2026-10-16 — added `buildMembershipTierSnapshot` for the paid
 * membership flow. Pure function, fully unit-testable.
 */

import type {
  MembershipTierSnapshot,
  PublicPassTemplate,
} from '@saome/shared/types/passHolder';
import type { PaymentProvider, PaymentState } from './PassHolderMembershipTiers';

/**
 * Build a frozen `MembershipTierSnapshot` for the selected tier.
 *
 * @param template  Public-safe template (must have `membershipTiers`)
 * @param index     0-based index into the tier list
 * @throws          Error if the index is out of range — this should be
 *                  unreachable because the picker UI only shows valid
 *                  indices, but we guard to keep the snapshot builder
 *                  defensive.
 */
export function buildMembershipTierSnapshot(
  template: PublicPassTemplate,
  index: number,
): MembershipTierSnapshot {
  const tiers = template.membershipTiers ?? [];
  const tier = tiers[index];
  if (!tier) {
    throw new Error(
      `[buildMembershipTierSnapshot] index ${index} out of range (tiers.length=${tiers.length})`,
    );
  }
  const currency = template.currency ?? 'TWD';
  const cost =
    tier.durationType === 'monthly' ? tier.monthlyCost : tier.yearlyCost;

  return {
    index,
    name: tier.name,
    durationType: tier.durationType,
    // null is preserved as-is — UI surfaces it as "Free" / "Trial"
    paidAmount: cost ?? null,
    currency,
  };
}

/**
 * Resolve the payment provider + status for the registration payload.
 * `state` drives `paymentStatus`; `currency` drives `paymentProvider`.
 * Returns undefined for either field when not in a `paid` state.
 *
 * 2026-10-18 — non-paid branch now returns `'not_required'` instead of
 * `'pending'`. Stamp cards / free reward / cashback / coupon / multipass
 * / gift / free-membership templates have no payment concept at all;
 * recording `'pending'` polluted queries that look for "unfinished
 * payments". See
 * runs/decisions/2026-10-18-payment-status-not-required-enum.md and
 * apps/backend/src/modules/pass-templates/schemas/request.ts for the
 * backend cross-field validation that enforces consistency.
 */
export function resolvePaymentFields(
  state: PaymentState,
  currency: PublicPassTemplate['currency'],
): { paymentProvider?: PaymentProvider; paymentStatus?: 'pending' | 'completed' | 'failed' | 'not_required' } {
  if (state !== 'paid') {
    // Non-paid templates (stamp / reward / cashback / free membership /
    // etc.) never have a payment concept — record that explicitly so
    // queries can distinguish from "paid but awaiting real gateway".
    return { paymentStatus: 'not_required' };
  }
  return {
    paymentProvider: currency === 'ZAR' ? 'payfast' : 'ecpay',
    paymentStatus: 'completed',
  };
}
