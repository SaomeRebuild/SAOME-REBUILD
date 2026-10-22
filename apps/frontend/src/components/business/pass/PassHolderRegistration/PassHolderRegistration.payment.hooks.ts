/**
 * usePassHolderPayment — payment + purchase orchestration for the public
 * "Get Pass" page.
 *
 * 2026-10-23 — extracted from `PassHolderRegistration.tsx` so the main
 * L2 component stays within the ≤ 100-line budget (Rule 000 § A.2)
 * after the gift-card branch landed. Behavior is UNCHANGED: every
 * existing behavior is still pinned by `PassHolderRegistration.test.tsx`,
 * which was not modified by this refactor.
 *
 * What this hook owns:
 *   - the RHF form instance (`usePassHolderForm`)
 *   - tier selection + purchased-points state
 *   - the 3-segment payment state machine (idle → paying → paid)
 *   - the single-CTA flow: validate → simulate payment → register
 *   - the issuance retry handler
 *   - the submit-error banner state
 *
 * Stale-closure discipline (2026-10-16, preserved verbatim):
 *   `onCtaClick` suspends across a 1.5s `setTimeout`, so it CANNOT read
 *   closure-captured state — React will not have re-rendered. Every
 *   value read after the await comes from a ref that is re-assigned on
 *   each render. `onRetryIssuance` uses refs too because the form fields
 *   are unmounted by then.
 *
 * Rule 018 § 2 (DOM reconcile after the await): Chrome / 1Password
 * autofill during that 1.5s window writes to `input.value` without
 * updating RHF's `_formValues`, so the DOM is reconciled back into RHF
 * before `getValues()` is read. Without this the register payload
 * carries empty strings.
 */

import { useCallback, useRef, useState } from 'react';
import { passHolderService } from '@/services/passHolderService';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';
import type { PassHolderIssuanceView } from '@/components/business/pass/PassHolderPassDownload';
import {
  buildRegisterPayload,
  isGiftCardTemplate,
  isPaidMembershipTemplate,
  toSubmitErrorState,
  type SubmitErrorState,
} from './PassHolderRegistration.helpers';
import type { PaymentState } from './PassHolderMembershipTiers';
import { usePassHolderForm, type PassHolderFormValues } from './PassHolderRegistration.hooks';

/**
 * Simulated payment delay. Matches the pre-refactor constant exactly —
 * the tests advance timers by this value.
 */
export const PAYMENT_SIMULATED_DELAY_MS = 1500;

export interface UsePassHolderPaymentOptions {
  /** Public-safe template metadata. */
  template: PublicPassTemplate;
  /** Called after a successful registration (swaps the page to the success view). */
  onSubmit: () => void;
}

export interface UsePassHolderPaymentResult {
  /** RHF form instance — pass straight to `PassHolderRegistrationForm`. */
  form: ReturnType<typeof usePassHolderForm>;
  /** True when the template is a paid membership card with ≥ 1 tier. */
  isPaidMembership: boolean;
  /**
   * 2026-10-23 — true when the template is a gift card with a usable
   * purchase config. Mutually exclusive with `isPaidMembership`.
   */
  isGiftCard: boolean;
  /**
   * True when the register call must be suppressed: a payment-gated
   * template that has not completed payment, or (gift card) has no
   * points entered yet. Defense-in-depth behind the disabled CTA.
   */
  submitBlocked: boolean;
  /** Selected membership tier index, or null. */
  selectedTierIndex: number | null;
  setSelectedTierIndex: (index: number | null) => void;
  /** 2026-10-23 — purchased points for a gift card, or null. */
  purchasedPoints: number | null;
  setPurchasedPoints: (points: number | null) => void;
  /** 3-segment payment state machine driving the CTA visual. */
  paymentState: PaymentState;
  /** In-flight register request. */
  pending: boolean;
  /** Per-pass runtime artifact captured from the register response. */
  lastIssuance: PassHolderIssuanceView | null;
  /** Structured backend rejection for the error banner. */
  submitError: SubmitErrorState | null;
  /** Clear the error banner (the × button). */
  dismissSubmitError: () => void;
  /** Single-CTA click handler: validate → simulate payment → register. */
  onCtaClick: () => Promise<void>;
  /** Re-run register for issuance retry — no payment re-simulation. */
  onRetryIssuance: () => Promise<void>;
}

/**
 * Rule 018 § 2 — copy any DOM value RHF missed (autofill wrote to
 * `input.value` after React committed) back into the form store.
 * `shouldDirty: false` so autofill doesn't look like a user edit.
 */
function reconcileDomToForm(form: {
  getValues: ReturnType<typeof usePassHolderForm>['getValues'];
  setValue: ReturnType<typeof usePassHolderForm>['setValue'];
}): void {
  for (const name of ['name', 'phoneNumber', 'birthday', 'email'] as const) {
    const dom = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!dom) continue;
    if (dom.value !== form.getValues(name)) {
      form.setValue(name, dom.value, { shouldDirty: false });
    }
  }
}

export function usePassHolderPayment({
  template,
  onSubmit,
}: UsePassHolderPaymentOptions): UsePassHolderPaymentResult {
  const [pending, setPending] = useState(false);
  const [selectedTierIndex, setSelectedTierIndex] = useState<number | null>(null);
  const [purchasedPoints, setPurchasedPoints] = useState<number | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [submitError, setSubmitError] = useState<SubmitErrorState | null>(null);
  /**
   * 2026-10-19 — per-pass runtime artifact from the register response.
   * `null` = register was never attempted; `undefined` (surfaced as
   * `lastIssuance ?? undefined`) = backend omitted `issuance`.
   */
  const [lastIssuance, setLastIssuance] = useState<PassHolderIssuanceView | null>(null);

  const isPaidMembership = isPaidMembershipTemplate(template);
  const isGiftCard = isGiftCardTemplate(template);

  // Refs mirror state so a setTimeout-suspended handler always sees the
  // latest values instead of the closure's snapshot.
  const selectedTierIndexRef = useRef<number | null>(selectedTierIndex);
  selectedTierIndexRef.current = selectedTierIndex;
  const purchasedPointsRef = useRef<number | null>(purchasedPoints);
  purchasedPointsRef.current = purchasedPoints;
  const paymentStateRef = useRef<PaymentState>(paymentState);
  paymentStateRef.current = paymentState;
  const templateRef = useRef(template);
  templateRef.current = template;
  const isPaidMembershipRef = useRef(isPaidMembership);
  isPaidMembershipRef.current = isPaidMembership;
  const isGiftCardRef = useRef(isGiftCard);
  isGiftCardRef.current = isGiftCard;

  /**
   * Defense-in-depth gate. The CTA is already disabled in these states;
   * this stops a programmatic submit from bypassing the button.
   */
  const submitBlocked =
    isPaidMembership && (selectedTierIndex === null || paymentState !== 'paid')
      ? true
      : isGiftCard && (purchasedPoints === null || paymentState !== 'paid');

  const form = usePassHolderForm({
    onValidSubmit: async (values) => {
      if (submitBlocked) return;
      setPending(true);
      setSubmitError(null);
      try {
        const result = await passHolderService.register(
          templateRef.current.id,
          buildRegisterPayload(templateRef.current, values, {
            isPaidMembership: isPaidMembershipRef.current,
            selectedTierIndex: selectedTierIndexRef.current,
            paymentState: paymentStateRef.current,
            purchasedPoints: purchasedPointsRef.current,
          }),
        );
        setLastIssuance(result.issuance ?? null);
        onSubmit();
      } catch (err) {
        // 2026-10-17 — capture backend rejections so the UI gives
        // feedback instead of leaking an unhandled rejection.
        setSubmitError(toSubmitErrorState(err));
      } finally {
        setPending(false);
      }
    },
  });

  /**
   * Single-CTA click handler for the payment-gated flows (paid
   * membership + gift card). Drives "validate → simulate payment →
   * register" through the PaymentButton's onClick.
   *
   * Uses refs (not closure-captured state) to read the live tier /
   * points / payment values after the await boundary.
   */
  const onCtaClick = useCallback(async () => {
    // 1. Validate before paying — never a "paid but invalid" state.
    const isValid = await form.trigger();
    if (!isValid) return;

    // 2. Simulate payment (no-op if already paid).
    let livePaymentState: PaymentState = paymentStateRef.current;
    if (livePaymentState !== 'paid') {
      setPaymentState('paying');
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, PAYMENT_SIMULATED_DELAY_MS);
      });
      // Rule 018 § 2 — reconcile DOM → RHF inside the race window.
      reconcileDomToForm(form);
      setPaymentState('paid');
      livePaymentState = 'paid';
      // Yield so React commits 'paid' before downstream code reads state.
      await Promise.resolve();
    }

    // 3. Read live values via refs (past the await boundary).
    const liveTemplate = templateRef.current;
    const liveSelectedTierIndex = selectedTierIndexRef.current;
    const livePurchasedPoints = purchasedPointsRef.current;
    const liveIsPaidMembership = isPaidMembershipRef.current;
    const liveIsGiftCard = isGiftCardRef.current;

    if (
      livePaymentState !== 'paid' ||
      (liveIsPaidMembership && liveSelectedTierIndex === null) ||
      (liveIsGiftCard && livePurchasedPoints === null)
    ) {
      // Defensive: unreachable in normal flow (the CTA is disabled in
      // these states). Bypass register so we don't write phantom
      // pending-state rows in production.
      return;
    }

    setPending(true);
    setSubmitError(null);
    try {
      const result = await passHolderService.register(
        liveTemplate.id,
        buildRegisterPayload(liveTemplate, form.getValues(), {
          isPaidMembership: liveIsPaidMembership,
          selectedTierIndex: liveSelectedTierIndex,
          paymentState: livePaymentState,
          purchasedPoints: livePurchasedPoints,
        }),
      );
      setLastIssuance(result.issuance ?? null);
      onSubmit();
    } catch (err) {
      setSubmitError(toSubmitErrorState(err));
    } finally {
      setPending(false);
    }
  }, [form, onSubmit]);

  /**
   * Retry handler — re-invokes register with the last known values
   * WITHOUT re-simulating payment (the user already paid). Designed
   * for the "重試簽發" button on `PassHolderPassDownload`'s banner.
   *
   * Refs (not closure state) because the form fields are unmounted
   * once the success view replaced them; `form.getValues()` still
   * returns RHF's last committed values.
   */
  const onRetryIssuance = useCallback(async () => {
    const liveTemplate = templateRef.current;
    setPending(true);
    try {
      const result = await passHolderService.register(
        liveTemplate.id,
        buildRegisterPayload(liveTemplate, form.getValues(), {
          isPaidMembership: isPaidMembershipRef.current,
          selectedTierIndex: selectedTierIndexRef.current,
          paymentState: paymentStateRef.current,
          purchasedPoints: purchasedPointsRef.current,
        }),
      );
      setLastIssuance(result.issuance ?? null);
    } catch (err) {
      // We're in the success view — don't open the form's banner.
      // Surface ONLY via `lastIssuance.issuanceError`, which the
      // download view renders in place.
      setLastIssuance({ issuanceError: toSubmitErrorState(err).i18nKey });
    } finally {
      setPending(false);
    }
  }, [form]);

  const dismissSubmitError = useCallback(() => setSubmitError(null), []);

  return {
    form,
    isPaidMembership,
    isGiftCard,
    submitBlocked,
    selectedTierIndex,
    setSelectedTierIndex,
    purchasedPoints,
    setPurchasedPoints,
    paymentState,
    pending,
    lastIssuance,
    submitError,
    dismissSubmitError,
    onCtaClick,
    onRetryIssuance,
  };
}

export type { PassHolderFormValues };