/**
 * PassHolderGiftCard.types — local prop interfaces for the
 * `PassHolderGiftCard` L2 folder.
 *
 * Four-component split (Rule 000 § A.1):
 *   1. `PassHolderGiftCard`           — main assembly (≤ 100 lines)
 *   2. `PassHolderGiftCardExplanation` — rate + fences + usage copy
 *   3. `PassHolderGiftCardPurchase`   — points input + derived amount
 *   4. `PassHolderGiftCardTips`       — gifting hint
 *
 * Presentation only: the points→amount math lives in
 * `packages/shared/logic/giftCardPurchase.ts` so the page preview and
 * the backend's charge can never disagree, and money formatting lives in
 * `packages/shared/logic/currency.ts` so every figure on screen speaks
 * one format.
 */

import type { PublicGiftCardConfig } from '@saome/shared/types/passHolder';
import type { Currency } from '@saome/shared/schemas/card';
import type { PaymentState } from '../PassHolderRegistration/PassHolderMembershipTiers';

export interface PassHolderGiftCardProps {
  /**
   * Tenant-configured rate + per-checkout fences. Always present: the
   * parent only renders this section when `template.giftCard != null`
   * (the backend omits it entirely for a template with no usable rate).
   */
  config: PublicGiftCardConfig;
  /** Denomination for the derived amount (TWD → 綠界, ZAR → Payfast). */
  currency: Currency;
  /** Currently entered points, or null when the field is empty/invalid. */
  purchasedPoints: number | null;
  /**
   * Called with the parsed points value, or `null` when the input is
   * empty / not a positive integer. The parent stores it in the payment
   * hook and gates the CTA on it being non-null.
   */
  onPurchasedPointsChange: (points: number | null) => void;
  /** 3-segment payment state machine for the CTA visual. */
  paymentState: PaymentState;
  /** Single-CTA click handler (validate → simulate payment → register). */
  onSimulatePayment: () => void;
  /** When true, inputs render in a disabled state. */
  disabled?: boolean;
}

/** Copy + numbers for the rate/fence explanation block. */
export interface PassHolderGiftCardExplanationProps {
  config: PublicGiftCardConfig;
  currency: Currency;
  /** Pre-formatted strings so this component stays i18n-free. */
  labels: {
    sectionTitle: string;
    sectionHint: string;
    rateLabel: string;
    rateValue: string;
    rangeLabel: string;
    rangeValue: string;
    /**
     * Currency-side view of the SAME fence as `rangeValue`, rendered as
     * a third row. The merchant configures both dimensions in
     * CardBuilder Step 6, so the customer sees both.
     */
    amountRangeLabel: string;
    amountRangeValue: string;
    usageHint: string;
  };
}

/** Copy for the gifting hint block. */
export interface PassHolderGiftCardTipsProps {
  title: string;
  body: string;
}