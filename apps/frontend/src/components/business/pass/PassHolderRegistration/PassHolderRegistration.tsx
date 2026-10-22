/**
 * PassHolderRegistration — main L2 assembly for the public "Get Pass"
 * page. Owns the form/Success state machine and delegates the payment
 * + purchase orchestration to `usePassHolderPayment`.
 *
 * 2026-10-23 — the payment state machine (tier selection, purchased
 * points, the 3-segment idle→paying→paid state, the single-CTA
 * validate → simulate → register flow, the issuance retry, and the
 * submit-error banner state) moved into
 * `usePassHolderPayment` (`PassHolderRegistration.payment.hooks.ts`).
 * This file is now presentation-only: it renders the header, the
 * error banner, the form, and whichever payment section the card type
 * calls for. Behavior is unchanged — every existing behavior is still
 * pinned by `PassHolderRegistration.test.tsx`, which this refactor did
 * not modify.
 *
 * `submitBlocked` (now owned by the hook) is defense-in-depth: the RHF
 * submit handler returns early if a payment-gated template has no
 * selection or no completed payment. The submit button is kept enabled
 * for discoverability but `onValidSubmit` won't fire while blocked.
 *
 * 2026-10-16 — Single-CTA refactor. When the template needs a payment,
 * the form's own SubmitButton is suppressed (`hideSubmit`) and the
 * PaymentButton becomes the only CTA. Clicking the PaymentButton
 *   1. Validates the form (programmatically via `trigger()`)
 *      — invalid → stop, errors surface on inputs
 *      — valid → continue
 *   2. Simulates the 1.5s payment (`paying → paid`)
 *   3. Calls `passHolderService.register` directly with the form values
 *      + latest tier / points / payment snapshot (bypasses the
 *      stale-closure pitfall of `form.submitForm()` whose `useCallback`
 *      deps recreate only on next render — but our async handler is
 *      mid-flight across a `setTimeout` boundary).
 *
 * 2026-10-23 — gift-card branch. A gift card is always paid but has no
 * tier list, so it gets its own `PassHolderGiftCard` section instead of
 * `PassHolderMembershipTiers`. The two are mutually exclusive.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PassHolderRegistrationHeader } from './PassHolderRegistrationHeader';
import { PassHolderRegistrationForm } from './PassHolderRegistrationForm';
import { PassHolderRegistrationFieldSet } from './PassHolderRegistrationFieldSet';
import { PassHolderSubmitErrorBanner } from './PassHolderSubmitErrorBanner';
import { PassHolderPassDownload } from '@/components/business/pass/PassHolderPassDownload';
import { PassHolderMembershipTiers } from './PassHolderMembershipTiers';
import { PassHolderGiftCard } from '../PassHolderGiftCard';
import { usePassHolderPayment } from './PassHolderRegistration.payment.hooks';
import { resolveBannerMessage } from './PassHolderRegistration.helpers';
import type { PassHolderRegistrationProps } from './PassHolderRegistration.types';

export function PassHolderRegistration({
  template,
  onSubmit,
  isSubmitting,
}: PassHolderRegistrationProps) {
  const { t } = useTranslation(['passHolder', 'common']);
  const [submitted, setSubmitted] = useState(false);

  const {
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
  } = usePassHolderPayment({
    template,
    onSubmit: () => {
      setSubmitted(true);
      onSubmit();
    },
  });

  // Resolve the banner's display key against both namespaces.
  // Backend-side i18n keys (e.g. 'passHolder.errors.tooYoung' or
  // 'common.error.serverError') are fully-qualified, but
  // `useTranslation(['passHolder', 'common'])` already binds a default
  // namespace, so the leading '<namespace>.' prefix must be stripped
  // before looking the key up. Fall back to a generic message if
  // neither namespace has the entry — a missing translation should
  // never silently become a raw key visible to the user.
  const bannerMessage = resolveBannerMessage(submitError, t);

  return (
    <article
      className="mx-auto flex w-full max-w-screen-sm flex-col gap-4"
      data-testid="pass-holder-registration"
    >
      <PassHolderRegistrationHeader template={template} />
      {submitted ? (
        <PassHolderPassDownload
          template={template}
          issuance={lastIssuance ?? undefined}
          onRetry={onRetryIssuance}
        />
      ) : (
        <PassHolderRegistrationFieldSet cardType={template.cardType}>
          {bannerMessage !== null && submitError !== null ? (
            <PassHolderSubmitErrorBanner
              message={bannerMessage}
              submitError={submitError}
              onDismiss={dismissSubmitError}
            />
          ) : null}
          <PassHolderRegistrationForm
            form={form}
            isSubmitting={isSubmitting ?? pending}
            // Both payment-gated paths (paid membership + gift card)
            // use the PaymentButton as their only CTA.
            hideSubmit={isPaidMembership || isGiftCard}
          />
          {isPaidMembership ? (
            <PassHolderMembershipTiers
              template={template}
              selectedTierIndex={selectedTierIndex}
              onSelectTier={setSelectedTierIndex}
              paymentState={paymentState}
              onSimulatePayment={onCtaClick}
              disabled={!submitBlocked && paymentState === 'paying'}
            />
          ) : isGiftCard ? (
            <PassHolderGiftCard
              config={template.giftCard!}
              currency={template.currency ?? 'TWD'}
              purchasedPoints={purchasedPoints}
              onPurchasedPointsChange={setPurchasedPoints}
              paymentState={paymentState}
              onSimulatePayment={onCtaClick}
              disabled={!submitBlocked && paymentState === 'paying'}
            />
          ) : null}
        </PassHolderRegistrationFieldSet>
      )}
    </article>
  );
}