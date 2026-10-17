/**
 * PassHolderRegistration — main L2 assembly for the public "Get Pass"
 * page. Owns the form/Success state machine + the 2026-10-16 paid
 * membership flow (tier selection + simulated payment gate).
 *
 * `submitBlocked` is defense-in-depth: the RHF submit handler returns
 * early if a paid template has no tier selected or no completed
 * payment. The submit button is kept enabled for discoverability but
 * `onValidSubmit` won't fire while blocked.
 *
 * 2026-10-16 — Single-CTA refactor. When `isPaidTemplate`, the form's
 * own SubmitButton is suppressed (`hideSubmit` prop) and the
 * PaymentButton below becomes the only CTA. Clicking the PaymentButton
 *   1. Validates the form (programmatically via `trigger()`)
 *      — invalid → stop, errors surface on inputs
 *      — valid → continue
 *   2. Simulates the 1.5s payment (`paying → paid`)
 *   3. Calls `passHolderService.register` directly with the form values
 *      + latest tier / payment snapshot (bypasses the stale-closure
 *      pitfall of `form.submitForm()` whose `useCallback` deps
 *      recreate only on next render — but our async handler is mid-flight
 *      across a `setTimeout` boundary).
 * This collapses the prior two-step "Get Pass → Pay with Payfast"
 * interaction that confused users.
 *
 * 2026-10-17 — Backend-error capture. Both submit paths (form submit
 * and PaymentButton CTA) catch PassHolderError from `register` and
 * surface the localized i18n key in a dismissable banner above the
 * form. Without this catch, the rejected promise escaped as an
 * unhandled rejection (verified via vitest unhandled-rejection
 * tracking) and the user saw the raw i18n key in the console while
 * the UI gave no feedback. See feedback
 * `runs/improvements/feedback/20261017-pass-holder-backend-error-capture.md`.
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PassHolderRegistrationHeader } from './PassHolderRegistrationHeader';
import { PassHolderRegistrationForm } from './PassHolderRegistrationForm';
import { PassHolderRegistrationFieldSet } from './PassHolderRegistrationFieldSet';
import { PassHolderRegistrationSuccess } from './PassHolderRegistrationSuccess';
import { PassHolderMembershipTiers } from './PassHolderMembershipTiers';
import { usePassHolderForm } from './PassHolderRegistration.hooks';
import { passHolderService, PassHolderError } from '@/services/passHolderService';
import { buildMembershipTierSnapshot, resolvePaymentFields } from './PassHolderRegistration.helpers';
import type { PassHolderRegistrationProps } from './PassHolderRegistration.types';
import type { PaymentState } from './PassHolderMembershipTiers';

const PAYMENT_SIMULATED_DELAY_MS = 1500;

/**
 * Structured state for the submit-error banner. Carries the i18n key
 * (for localization) plus the raw API payload (so we can show the
 * actual `received` value + `minBirthdayBoundary` for tooYoung errors).
 *
 * See `passHolderService.toPassHolderError` for how `params` is built
 * from `SaomeApiError.details`.
 */
interface SubmitErrorState {
  i18nKey: string;
  /**
   * `details.issues[].received` from the backend. For a birthday refine
   * failure this is the value the API actually saw, which may differ
   * from what the user thought they entered (autofill, stale state).
   */
  received?: string;
  /**
   * `details.minBirthdayBoundary` from the backend. The latest date
   * the API considers "≥ 13 years old". Useful so the user can see
   * the API's threshold.
   */
  minBirthdayBoundary?: string;
}

/**
 * Resolve a thrown error into a localized i18n key. Mirrors
 * `passHolderService::toPassHolderError` but consumer-side: the
 * service throws raw errors, the component translates them.
 */
function toSubmitErrorState(err: unknown): SubmitErrorState {
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

export function PassHolderRegistration({
  template,
  onSubmit,
  isSubmitting,
}: PassHolderRegistrationProps) {
  const { t } = useTranslation(['passHolder', 'common']);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedTierIndex, setSelectedTierIndex] = useState<number | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  /**
   * 2026-10-17 — Surfaces backend-side rejections (e.g.
   * `passHolder.errors.tooYoung`) as a dismissable banner above the
   * form. Cleared on the next submit attempt so a stale error from a
   * previous attempt doesn't block the user from retrying with new
   * inputs. See file header for trace.
   *
   * `submitError` is a structured object (not just an i18n key) so we
   * can surface the API's `received` value + the `minBirthdayBoundary`
   * the server computed. For "I entered 1989 but got tooYoung" this
   * shows the user EXACTLY what the API got, which is the only way
   * to disambiguate a UI/autofill bug (received=2026) from a backend
   * math bug (received=1989-01-01).
   */
  const [submitError, setSubmitError] = useState<SubmitErrorState | null>(null);

  const isPaidTemplate = Boolean(template.isPaid && template.membershipTiers?.length);

  // Refs mirror state so a setTimeout-suspended click handler always
  // sees the latest values (avoiding the RHF stale-closure pitfall
  // described in the file header).
  const selectedTierIndexRef = useRef<number | null>(null);
  selectedTierIndexRef.current = selectedTierIndex;
  const paymentStateRef = useRef<PaymentState>('idle');
  paymentStateRef.current = paymentState;
  const templateRef = useRef(template);
  templateRef.current = template;
  const isPaidTemplateRef = useRef(isPaidTemplate);
  isPaidTemplateRef.current = isPaidTemplate;

  // Non-paid path: form's own SubmitButton drives form.handleSubmit →
  // onValidSubmit → register. We keep the simple hook-based submit
  // for the non-paid case (no setTimeout, no stale closure).
  // Paid path: onCtaClick below calls register directly with refs.
  const submitBlocked =
    isPaidTemplate && (selectedTierIndex === null || paymentState !== 'paid');
  const form = usePassHolderForm({
    onValidSubmit: async (values) => {
      if (submitBlocked) return;
      setPending(true);
      setSubmitError(null);
      try {
        const tierSnapshot =
          isPaidTemplate && selectedTierIndex !== null
            ? buildMembershipTierSnapshot(template, selectedTierIndex)
            : undefined;
        const { paymentProvider, paymentStatus } = resolvePaymentFields(
          paymentState,
          template.currency,
        );
        await passHolderService.register(template.id, {
          ...values,
          selectedTierIndex: selectedTierIndex ?? undefined,
          membershipTierSnapshot: tierSnapshot,
          paymentProvider,
          paymentStatus,
        });
        setSubmitted(true);
        onSubmit();
      } catch (err) {
        // 2026-10-17 — capture backend rejections (zod 400 / 5xx) and
        // surface the localized key in the banner. The banner clears
        // on the next submit attempt (see setSubmitError(null) above).
        setSubmitError(toSubmitErrorState(err));
      } finally {
        setPending(false);
      }
    },
  });

  /**
   * Single-CTA click handler for the paid-membership flow. Drives the
   * full chain "validate → simulate payment → register" through the
   * PaymentButton's onClick. Uses refs (not closure-captured state)
   * to read the live tier / payment values after the await boundary.
   *
   * Non-paid templates don't use this handler — their SubmitButton
   * drives `form.handleSubmit → onValidSubmit` (above).
   */
  const onCtaClick = useCallback(async () => {
    // 1. Validate form before paying (avoid "paid but invalid" state).
    const isValid = await form.trigger();
    if (!isValid) return;

    // 2. Simulate payment (no-op if already paid). After this block,
    //    `livePaymentStateLocal === 'paid'` because we just set it.
    let livePaymentStateLocal: PaymentState = paymentStateRef.current;
    if (livePaymentStateLocal !== 'paid') {
      setPaymentState('paying');
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, PAYMENT_SIMULATED_DELAY_MS);
      });
      setPaymentState('paid');
      livePaymentStateLocal = 'paid';
      // Yield so React commits 'paid' before downstream code reads state.
      await Promise.resolve();
    }

    // 3. Read remaining live values via refs (tier + template).
    const liveSelectedTierIndex = selectedTierIndexRef.current;
    const liveIsPaidTemplate = isPaidTemplateRef.current;
    const liveTemplate = templateRef.current;

    if (
      liveIsPaidTemplate &&
      (liveSelectedTierIndex === null || livePaymentStateLocal !== 'paid')
    ) {
      // Defensive: never reached in normal flow; the button is
      // disabled when no tier is selected. Bypass register so we
      // don't write phantom pending-state rows in production.
      return;
    }

    setPending(true);
    setSubmitError(null);
    try {
      const values = form.getValues();
      const tierSnapshot =
        liveIsPaidTemplate && liveSelectedTierIndex !== null
          ? buildMembershipTierSnapshot(liveTemplate, liveSelectedTierIndex)
          : undefined;
      const { paymentProvider, paymentStatus } = resolvePaymentFields(
        livePaymentStateLocal,
        liveTemplate.currency,
      );
      await passHolderService.register(liveTemplate.id, {
        ...values,
        selectedTierIndex: liveSelectedTierIndex ?? undefined,
        membershipTierSnapshot: tierSnapshot,
        paymentProvider,
        paymentStatus,
      });
      setSubmitted(true);
      onSubmit();
    } catch (err) {
      // 2026-10-17 — mirror `onValidSubmit`'s catch (Bug 4 umbrella).
      // Without this catch the rejected promise from `register` would
      // escape as an unhandled rejection and the user would see the
      // raw `passHolder.errors.*` key in the console while the UI
      // gave no feedback.
      setSubmitError(toSubmitErrorState(err));
    } finally {
      setPending(false);
    }
  }, [form, onSubmit]);

  // 2026-10-17 — UX hygiene: dismiss the error banner once the user
  // edits any form field, so they get a fresh slate when retrying.
  // Subscribing to `form.watch()` would re-render on every keystroke;
  // we use a one-shot effect on a sentinel instead: clearing on submit
  // (above) plus manual dismiss via the banner's close button.
  // Keeping this minimal — auto-clear on keystroke can feel jumpy.

  // Resolve the banner's display key against both namespaces.
  // Backend-side i18n keys (e.g. 'passHolder.errors.tooYoung' or
  // 'common.error.serverError') are fully-qualified, but
  // `useTranslation(['passHolder', 'common'])` already binds a
  // default namespace, so the leading '<namespace>.' prefix must be
  // stripped before looking the key up. Fall back to the raw key
  // (with a console warning) if neither namespace has the entry —
  // a missing translation should never silently become a raw key
  // visible to the user.
  const { bannerMessage, bannerDiagnostic } = (() => {
    if (submitError === null) return { bannerMessage: null, bannerDiagnostic: null };
    let msg: string;
    if (submitError.i18nKey.startsWith('passHolder.')) {
      msg = t(submitError.i18nKey.slice('passHolder.'.length));
    } else if (submitError.i18nKey.startsWith('common.')) {
      msg = t(submitError.i18nKey.slice('common.'.length), { ns: 'common' });
    } else {
      // Unknown namespace prefix — don't leak the raw key into the
      // banner; log for ops follow-up and surface a generic message.
      // eslint-disable-next-line no-console
      console.warn(
        '[PassHolderRegistration] submitError has unknown namespace prefix:',
        submitError.i18nKey,
      );
      msg = t('error.serverError', { ns: 'common' });
    }
    // 2026-10-17 — for tooYoung specifically, surface the API's
    // `received` value + `minBirthdayBoundary` so the user can
    // disambiguate a UI/autofill bug (received=2026) from a backend
    // math bug (received=1989-01-01). The diagnostic line lives
    // BELOW the localized message and is rendered in monospace +
    // smaller text so it doesn't compete with the user-facing copy.
    const diagnostic =
      submitError.i18nKey === 'passHolder.errors.tooYoung' &&
      (submitError.received !== undefined || submitError.minBirthdayBoundary !== undefined)
        ? {
            received: submitError.received,
            minBirthdayBoundary: submitError.minBirthdayBoundary,
          }
        : null;
    return { bannerMessage: msg, bannerDiagnostic: diagnostic };
  })();

  return (
    <article
      className="mx-auto flex w-full max-w-screen-sm flex-col gap-4"
      data-testid="pass-holder-registration"
    >
      <PassHolderRegistrationHeader template={template} />
      {submitted ? (
        <PassHolderRegistrationSuccess template={template} />
      ) : (
        <PassHolderRegistrationFieldSet cardType={template.cardType}>
          {bannerMessage !== null ? (
            <div
              role="alert"
              aria-live="polite"
              data-testid="pass-holder-submit-error"
              className="rounded-md border px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--color-destructive)',
                backgroundColor: 'var(--color-destructive-bg, rgba(220, 38, 38, 0.08))',
                color: 'var(--color-destructive)',
              }}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <span data-testid="pass-holder-submit-error-message">{bannerMessage}</span>
                  {bannerDiagnostic !== null ? (
                    <div
                      data-testid="pass-holder-submit-error-diagnostic"
                      className="mt-1 font-mono text-xs opacity-80"
                    >
                      {bannerDiagnostic.received !== undefined ? (
                        <span data-testid="pass-holder-submit-error-received">
                          {t('submitErrorDebug.receivedPrefix')}
                          {bannerDiagnostic.received}
                        </span>
                      ) : null}
                      {bannerDiagnostic.minBirthdayBoundary !== undefined ? (
                        <span data-testid="pass-holder-submit-error-boundary">
                          {bannerDiagnostic.received !== undefined ? ' · ' : ''}
                          {t('submitErrorDebug.boundaryMid')}
                          {bannerDiagnostic.minBirthdayBoundary}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitError(null)}
                  aria-label={t('submitErrorDismiss', '關閉') as string}
                  className="text-xs underline"
                  style={{ color: 'var(--color-destructive)' }}
                  data-testid="pass-holder-submit-error-dismiss"
                >
                  {t('submitErrorDismiss', '關閉')}
                </button>
              </div>
            </div>
          ) : null}
          <PassHolderRegistrationForm
            form={form}
            isSubmitting={isSubmitting ?? pending}
            hideSubmit={isPaidTemplate}
          />
          {isPaidTemplate ? (
            <PassHolderMembershipTiers
              template={template}
              selectedTierIndex={selectedTierIndex}
              onSelectTier={setSelectedTierIndex}
              paymentState={paymentState}
              onSimulatePayment={onCtaClick}
            />
          ) : null}
        </PassHolderRegistrationFieldSet>
      )}
    </article>
  );
}
