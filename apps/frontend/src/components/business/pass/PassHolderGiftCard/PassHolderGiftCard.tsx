/**
 * PassHolderGiftCard — main L2 assembly for the gift-card purchase
 * flow. Renders below the 4 pass-delivery fields when the template is
 * a `gift_card` WITH a usable rate configured.
 *
 * Composition (Rule 000 § A.2):
 *   1. `PassHolderGiftCardExplanation` — rate + both fences + usage copy
 *   2. `PassHolderGiftCardTips`       — gifting hint
 *   3. `PassHolderGiftCardPurchase`   — points input + derived amount
 *   4. `PassHolderPaymentButton`      — 綠界 (TWD) or Payfast (ZAR)
 *
 * All copy is resolved by `useGiftCardLabels` rather than inline
 * `t()` calls. That hook owns the two things that used to go wrong:
 * the money format (one formatter for every figure instead of three
 * drifting `NT$ ` / `R ` copies) and the validation key (translated
 * once, so `passHolder.validation.*` can never reach the DOM).
 *
 * The payment CTA is the SAME component the paid-membership flow uses.
 * We deliberately reuse it instead of writing a gift-specific button —
 * one payment button means one set of state visuals and one logo
 * mapping to maintain.
 */

import {
  pointsToAmount,
  validateGiftCardPurchase,
} from '@saome/shared/logic/giftCardPurchase';
import { formatCurrencyOrFallback } from '@saome/shared/logic/currency';
import { PassHolderGiftCardExplanation } from './PassHolderGiftCardExplanation';
import { PassHolderGiftCardPurchase } from './PassHolderGiftCardPurchase';
import { PassHolderGiftCardTips } from './PassHolderGiftCardTips';
import { useGiftCardLabels } from './PassHolderGiftCard.hooks';
import {
  PassHolderPaymentButton,
  resolvePaymentProvider,
} from '../PassHolderRegistration/PassHolderMembershipTiers';
import type { PassHolderGiftCardProps } from './PassHolderGiftCard.types';

export function PassHolderGiftCard({
  config,
  currency,
  purchasedPoints,
  onPurchasedPointsChange,
  paymentState,
  onSimulatePayment,
  disabled,
}: PassHolderGiftCardProps) {
  const provider = resolvePaymentProvider(currency);

  /**
   * The CTA is gated on `validateGiftCardPurchase`, NOT on priceability
   * alone. Both produce `null`-style failures, but they fail DIFFERENT
   * reasons:
   *   - 50 points on a "NT$100 = 10 點" rate IS priceable (5 units),
   *     but it is below `checkoutMinPoints`, so the backend rejects it.
   *   - 505 points is priceable in magnitude but NOT a whole multiple
   *     of the rate, so there is no exact amount to charge.
   * Gating on priceability alone would leave the CTA enabled for a
   * purchase the backend refuses — the exact "click then 400" dead end
   * the inline validation exists to prevent.
   */
  const validation =
    purchasedPoints === null
      ? null
      : validateGiftCardPurchase(purchasedPoints, config);
  const isPurchasable = validation !== null && validation.ok;

  // The validator's `message` is an i18n KEY. It is handed to the label
  // hook as `errorKey`, never rendered here.
  const errorKey =
    validation !== null && !validation.ok ? validation.message : null;

  // `pointsToAmount` is the SAME function the backend charges with — a
  // second copy of this arithmetic would be free to drift (Rule 023 §
  // shared package). Null when the value cannot be priced, which also
  // keeps the CTA from naming an amount.
  const derived = isPurchasable
    ? pointsToAmount(purchasedPoints as number, config)
    : null;
  const preview =
    derived === null ? null : formatCurrencyOrFallback(derived, currency);

  const labels = useGiftCardLabels(config, currency, preview, errorKey);

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="pass-holder-gift-card"
      aria-labelledby="pass-holder-gift-card-title"
    >
      <PassHolderGiftCardExplanation
        config={config}
        currency={currency}
        labels={labels.explanation}
      />

      <PassHolderGiftCardTips title={labels.tips.title} body={labels.tips.body} />

      <PassHolderGiftCardPurchase
        config={config}
        currency={currency}
        purchasedPoints={purchasedPoints}
        onPurchasedPointsChange={onPurchasedPointsChange}
        validationMessage={labels.validationMessage}
        labels={labels.purchase}
        disabled={disabled}
      />

      <PassHolderPaymentButton
        provider={provider}
        paymentState={paymentState}
        labels={labels.payment}
        onClick={onSimulatePayment}
        // Blocked until a VALID points value exists — the same
        // `validateGiftCardPurchase` gate the backend enforces in
        // `deriveGiftCardPurchase`, so the CTA can never offer a
        // purchase the API would reject.
        disabled={disabled || !isPurchasable}
      />
    </section>
  );
}