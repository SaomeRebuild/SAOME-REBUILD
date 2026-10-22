/**
 * PassHolderMembershipTiers barrel — re-exports the public API of the
 * paid-membership registration sub-folder. Mirrors the L2 folder
 * convention used elsewhere in the codebase (e.g.
 * PassHolderRegistration/index.ts).
 */

export { PassHolderMembershipTiers } from './PassHolderMembershipTiers';
// 2026-10-23 — the gift-card section reuses the SAME payment CTA
// rather than writing a second one, so the button must be part of the
// public API. Re-exported here (not imported by relative path from a
// sibling folder) to keep the sub-folder boundary intact.
export { PassHolderPaymentButton } from './PassHolderPaymentButton';
export type {
  PassHolderMembershipTiersProps,
  PassHolderMembershipTierRowProps,
  PassHolderPaymentButtonProps,
  PaymentState,
  PaymentProvider,
} from './PassHolderMembershipTiers.types';
export { resolvePaymentProvider } from './PassHolderMembershipTiers.types';
