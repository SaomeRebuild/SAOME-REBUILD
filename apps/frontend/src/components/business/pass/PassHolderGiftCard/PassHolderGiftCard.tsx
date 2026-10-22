/**
 * PassHolderGiftCard — main L2 assembly for the gift-card purchase
 * flow. Renders below the 4 pass-delivery fields when the template is
 * a `gift_card` WITH a usable rate configured.
 *
 * Composition (≤ 100 lines per Rule 000 § A.2):
 *   1. `PassHolderGiftCardExplanation` — rate + fences + usage copy
 *   2. `PassHolderGiftCardTips`       — gifting hint
 *   3. `PassHolderGiftCardPurchase`   — points input + derived amount
 *   4. `PassHolderPaymentButton`      — 綠界 (TWD) or Payfast (ZAR)
 *
 * All i18n keys resolve against the existing `passHolder` namespace
 * (`gift.*` block) — no new namespace, so `src/test/i18n.ts` needed no
 * change (Rule 023 § 元件化原則: this component is feature-scoped, not
 * cross-feature reusable, so it rides the `passHolder` feature
 * namespace rather than getting its own).
 *
 * The payment CTA is the SAME component the paid-membership flow uses.
 * We deliberately reuse it instead of writing a gift-specific button —
 * one payment button means one set of state visuals and one logo
 * mapping to maintain.
 */

import { useTranslation } from 'react-i18next';
import {
  pointsToAmount,
  validateGiftCardPurchase,
} from '@saome/shared/logic/giftCardPurchase';
import { PassHolderGiftCardExplanation } from './PassHolderGiftCardExplanation';
import { PassHolderGiftCardPurchase } from './PassHolderGiftCardPurchase';
import { PassHolderGiftCardTips } from './PassHolderGiftCardTips';
import {
  PassHolderPaymentButton,
  resolvePaymentProvider,
} from '../PassHolderRegistration/PassHolderMembershipTiers';
import type { PassHolderGiftCardProps } from './PassHolderGiftCard.types';

/** `10,000` — locale-aware grouping for the fence copy. */
function formatPoints(value: number): string {
  return value.toLocaleString('en-US');
}

export function PassHolderGiftCard({
  config,
  currency,
  purchasedPoints,
  onPurchasedPointsChange,
  paymentState,
  onSimulatePayment,
  disabled,
}: PassHolderGiftCardProps) {
  const { t } = useTranslation('passHolder');
  const provider = resolvePaymentProvider(currency);

  const rangeValue = t('gift.rangePoints', {
    min: formatPoints(config.checkoutMinPoints),
    max: formatPoints(config.checkoutMaxPoints),
  });

  /**
   * The CTA is gated on `validateGiftCardPurchase`, NOT on priceability
   * alone. Both produce `null`-style failures, but they fail DIFFERENT
   * reasons:
   *   - 50 points on a "100 元 = 10 點" rate IS priceable (5 units),
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

  const derived = isPurchasable ? pointsToAmount(purchasedPoints as number, config) : null;
  const preview =
    derived === null
      ? null
      : `${currency === 'ZAR' ? 'R' : 'NT$'} ${derived.toLocaleString('en-US')}`;

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="pass-holder-gift-card"
      aria-labelledby="pass-holder-gift-card-title"
    >
      <PassHolderGiftCardExplanation
        config={config}
        currency={currency}
        labels={{
          sectionTitle: t('gift.sectionTitle'),
          sectionHint: t('gift.sectionHint'),
          rateLabel: t('gift.rateLabel'),
          rateValue: t('gift.rateValue', {
            amount: config.unitAmount,
            points: config.unitPoints,
          }),
          rangeLabel: t('gift.rangeLabel'),
          rangeValue,
          usageHint: t('gift.usageHint'),
        }}
      />

      <PassHolderGiftCardTips
        title={t('gift.tipsTitle')}
        body={t('gift.tipsBody')}
      />

      <PassHolderGiftCardPurchase
        config={config}
        currency={currency}
        purchasedPoints={purchasedPoints}
        onPurchasedPointsChange={onPurchasedPointsChange}
        labels={{
          pointsLabel: t('gift.pointsLabel'),
          pointsPlaceholder: t('gift.pointsPlaceholder'),
          amountLabel: t('gift.amountLabel'),
          amountEmpty: t('gift.amountEmpty'),
          hintLabel: t('gift.fenceHintLabel'),
          hintValue: rangeValue,
        }}
        disabled={disabled}
      />

      <PassHolderPaymentButton
        provider={provider}
        paymentState={paymentState}
        labels={{
          // CTA shows the derived price so the customer confirms the
          // amount at the moment of commitment, not just in the field
          // above (mirrors the membership tier picker's behavior).
          // `pointsToAmount` is the SAME function the backend charges
          // with — a second copy of this arithmetic would be free to
          // drift (Rule 023 § shared package).
          idleLabel:
            preview === null
              ? provider === 'payfast'
                ? t('gift.payButton.payfast')
                : t('gift.payButton.ecpay')
              : t('gift.payWithAmountAction', { amount: preview }),
          paying: t('gift.paying'),
          paid: t('gift.paid'),
        }}
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