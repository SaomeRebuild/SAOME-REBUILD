/**
 * PassHolderRegistration.helpers — small pure functions used by the
 * main L2 component. Lives next to `.tsx` per the L2 folder convention
 * (Rule 000 § A.1). Business logic stays out of the JSX;
 * `resolvePaymentFields` is the only "domain" function because the
 * shared/ side of the contract is just the `PublicPassTemplate` /
 * `PassHolderPayload` types — they don't dictate the composition
 * rules.
 *
 * 2026-10-16 — added `buildMembershipTierSnapshot` for the paid
 * membership flow. Pure function, fully unit-testable.
 *
 * 2026-10-27 — REMOVED `buildMembershipTierSnapshot`. The membership
 * tier snapshot is now derived SERVER-SIDE from the template's own
 * tier list (see
 * `packages/shared/logic/membershipTier.ts::resolveMembershipTierSnapshot`),
 * for the same reason the gift-card amount is: a client must not be
 * able to name a tier the tenant never offered nor quote a price the
 * tenant never set. The client now sends ONLY the tier INDEX it
 * picked, and the backend re-derives the rest — which also means a
 * FREE membership card gets a snapshot too (it has one tier with a
 * name, even though the public DTO does not expose tiers for it).
 */

import type {
  PassHolderPayload,
  PublicPassTemplate,
} from '@saome/shared/types/passHolder';
import { PassHolderError } from '@/services/passHolderService';
import type { PassHolderFormValues } from './PassHolderRegistration.hooks';
import type { PaymentProvider, PaymentState } from './PassHolderMembershipTiers';

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

/**
 * Structured state for the submit-error banner. Carries the i18n key
 * (for localization) plus the raw API payload (so we can show the
 * actual `received` value + `minBirthdayBoundary` for tooYoung errors).
 *
 * See `passHolderService.toPassHolderError` for how `params` is built
 * from `SaomeApiError.details`.
 *
 * 2026-10-23 — moved here from `PassHolderRegistration.tsx` when the
 * payment orchestration moved into `usePassHolderPayment`: both the hook
 * (which produces the error) and the component (which renders the
 * banner) need this type.
 */
export interface SubmitErrorState {
  i18nKey: string;
  /**
   * `details.issues[].received` from the backend. For a birthday refine
   * failure this is the value the API actually saw, which may differ
   * from what the user thought they entered (autofill, stale state).
   */
  received?: string;
  /**
   * `details.minBirthdayBoundary` from the backend. The latest date
   * the API considers "≥ 13 years old". Useful so the user can see the
   * API's threshold.
   */
  minBirthdayBoundary?: string;
}

/**
 * Resolve a thrown error into a localized i18n key. Mirrors
 * `passHolderService::toPassHolderError` but consumer-side: the
 * service throws raw errors, the component translates them.
 */
export function toSubmitErrorState(err: unknown): SubmitErrorState {
  if (err instanceof PassHolderError) {
    // `params` is `unknown` at the type level; narrow it to the actual
    // backend ValidationError envelope shape (see
    // `apps/backend/src/modules/pass-templates/routes/register.ts`).
    // Using a structural check keeps us safe if the backend ever adds
    // a new field — we just ignore it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = (err.params ?? {}) as any;
    const firstIssue = Array.isArray(params.issues) ? params.issues[0] : null;
    return {
      i18nKey: err.i18nKey,
      received:
        typeof firstIssue?.received === 'string' ? firstIssue.received : undefined,
      minBirthdayBoundary:
        typeof params.minBirthdayBoundary === 'string'
          ? params.minBirthdayBoundary
          : undefined,
    };
  }
  return { i18nKey: 'common.error.serverError' };
}

/**
 * Resolve a `SubmitErrorState` to a localized banner headline.
 *
 * Backend i18n keys are fully-qualified (`passHolder.errors.tooYoung`,
 * `common.error.serverError`) but `useTranslation(['passHolder',
 * 'common'])` binds a default namespace, so the leading
 * `<namespace>.` prefix must be stripped before lookup. An unknown
 * prefix is logged for ops follow-up and surfaced as a generic
 * message — a missing translation must never leak a raw key into the
 * UI.
 *
 * @returns the localized string, or `null` when there is no error.
 */
export function resolveBannerMessage(
  submitError: SubmitErrorState | null,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (submitError === null) return null;
  if (submitError.i18nKey.startsWith('passHolder.')) {
    return t(submitError.i18nKey.slice('passHolder.'.length));
  }
  if (submitError.i18nKey.startsWith('common.')) {
    return t(submitError.i18nKey.slice('common.'.length), { ns: 'common' });
  }
  // eslint-disable-next-line no-console
  console.warn(
    '[PassHolderRegistration] submitError has unknown namespace prefix:',
    submitError.i18nKey,
  );
  return t('error.serverError', { ns: 'common' });
}

/**
 * True when the template is a paid membership card WITH at least one
 * tier — the exact condition the existing tier picker / payment button
 * has always used. Exported so the hook, the component, and the tests
 * all agree on one definition.
 */
export function isPaidMembershipTemplate(template: PublicPassTemplate): boolean {
  return Boolean(template.isPaid && template.membershipTiers?.length);
}

/**
 * 2026-10-23 — true when the template is a gift card WITH a usable
 * purchase configuration.
 *
 * A gift card is always paid, but it is NOT a "paid membership card":
 * it has no `isPaid` flag and no tier list. When the tenant never
 * configured a rate (or the row is corrupt and the backend normalizer
 * returned `null`), the backend omits `giftCard` entirely and the page
 * renders NO purchase section — better than an input that rejects
 * everything.
 */
export function isGiftCardTemplate(template: PublicPassTemplate): boolean {
  return template.cardType === 'gift_card' && template.giftCard != null;
}

/**
 * Assemble the register payload for any card type.
 *
 * 2026-10-23 — this replaces three near-identical payload literals
 * (form submit / payment CTA / issuance retry) so the gift-card
 * extension is added in exactly ONE place. A future card type that
 * needs another field cannot accidentally miss one of the three paths.
 *
 * @param paidMembership  Whether to attach the membership tier snapshot.
 * @param values          Current RHF form values.
 * @param tierIndex       Selected tier index, or null.
 * @param paymentState    3-segment payment state machine.
 * @param points          Purchased points for a gift card, or null.
 */
export function buildRegisterPayload(
  template: PublicPassTemplate,
  values: PassHolderFormValues,
  opts: {
    isPaidMembership: boolean;
    selectedTierIndex: number | null;
    paymentState: PaymentState;
    purchasedPoints: number | null;
  },
): PassHolderPayload {
  // 2026-10-27 — the membership tier snapshot is NO LONGER built
  // here. It is derived server-side from the template's own tier list
  // (see
  // `packages/shared/logic/membershipTier.ts::resolveMembershipTierSnapshot`),
  // so a client cannot name a tier the tenant never offered nor quote
  // a price the tenant never set. The client sends only the tier
  // INDEX it picked, which the backend resolves against the
  // template.
  const { paymentProvider, paymentStatus } = resolvePaymentFields(
    opts.paymentState,
    template.currency,
  );
  return {
    ...values,
    selectedTierIndex: opts.selectedTierIndex ?? undefined,
    paymentProvider,
    paymentStatus,
    // 2026-10-23 — gift-card points. The backend RE-DERIVES the amount
    // from the template's own rate; we never send a price.
    purchasedPoints: opts.purchasedPoints ?? undefined,
  };
}
