/**
 * useGiftCardLabels — resolves every string the gift-card section
 * renders, in one place.
 *
 * Why a hook and not inline `t()` calls in the main component
 * (Rule 000 § A.3 Hook Extraction Strategy): the section speaks four
 * distinct copy blocks (explanation / tips / purchase / payment CTA)
 * and three of them interleave `t()` with number formatting. Doing
 * that inline pushed the main component past its 100-line budget and
 * made the currency format easy to drift — three separate inline
 * `NT$ ` / `R ` copies existed before this hook unified them.
 *
 * The single most important job here is the MONEY FORMAT. Every figure
 * the customer sees (exchange-rate unit, both fences, the derived
 * price, the CTA) goes through `formatCurrencyOrFallback`, so they all
 * speak one format (`NT$1,000` / `R1,000`, no space — the format
 * documented in `shared/logic/currency.ts`).
 *
 * The second job is TRANSLATION. `validateGiftCardPurchase` returns an
 * i18n key in `message`, never prose (Rule 023 § Shared Validation 用
 * i18n Key). `validationMessage` below is where that key becomes copy.
 * Nothing downstream ever receives a raw key.
 */

import { useTranslation } from 'react-i18next';
import { formatCurrencyOrFallback } from '@saome/shared/logic/currency';
import type { Currency } from '@saome/shared/schemas/card';
import type { PublicGiftCardConfig } from '@saome/shared/types/passHolder';
import { resolvePaymentProvider } from '../PassHolderRegistration/PassHolderMembershipTiers';

/** `10,000` — locale-aware grouping for the points fences. */
function formatPoints(value: number): string {
  return value.toLocaleString('en-US');
}

export interface GiftCardLabels {
  explanation: {
    sectionTitle: string;
    sectionHint: string;
    rateLabel: string;
    rateValue: string;
    rangeLabel: string;
    rangeValue: string;
    amountRangeLabel: string;
    amountRangeValue: string;
    usageHint: string;
  };
  tips: {
    title: string;
    body: string;
  };
  purchase: {
    pointsLabel: string;
    pointsPlaceholder: string;
    amountLabel: string;
    amountEmpty: string;
    hintLabel: string;
    hintValue: string;
  };
  payment: {
    idleLabel: string;
    paying: string;
    paid: string;
  };
  /**
   * The rejection reason, already translated — or null when the input
   * is empty or valid. Lives here so `PassHolderGiftCardPurchase` (a
   * pure view with no `t()`) can never render a raw i18n key.
   */
  validationMessage: string | null;
}

/**
 * @param config       — the tenant's rate + per-checkout fences.
 * @param currency     — denomination, decides symbol AND gateway.
 * @param preview      — pre-formatted derived price, or null when the
 *                       current points value cannot be purchased. Drives
 *                       whether the CTA says "pay X" or just "Payfast/Ecpay".
 * @param errorKey     — i18n key from `validateGiftCardPurchase`, or
 *                       null when the input is empty or valid. Resolved
 *                       HERE so no sub-component ever renders a raw key.
 */
export function useGiftCardLabels(
  config: PublicGiftCardConfig,
  currency: Currency,
  preview: string | null,
  errorKey: string | null,
): GiftCardLabels {
  const { t } = useTranslation('passHolder');

  // Every money figure shares one formatter. `unitAmount` is a bare
  // number in settings — passing it straight into `rateValue` rendered
  // 「每 1 可獲得 1 點」, which reads as "every 1 of what?".
  const rangePoints = t('gift.rangePoints', {
    min: formatPoints(config.checkoutMinPoints),
    max: formatPoints(config.checkoutMaxPoints),
  });

  return {
    explanation: {
      sectionTitle: t('gift.sectionTitle'),
      sectionHint: t('gift.sectionHint'),
      rateLabel: t('gift.rateLabel'),
      rateValue: t('gift.rateValue', {
        amount: formatCurrencyOrFallback(config.unitAmount, currency),
        points: config.unitPoints,
      }),
      rangeLabel: t('gift.rangeLabel'),
      rangeValue: rangePoints,
      // The amount fences are the currency-side view of the SAME fence
      // the points range above expresses. The merchant configures both
      // in CardBuilder Step 6; showing only points leaves the customer
      // unable to predict what their input will cost.
      amountRangeLabel: t('gift.amountRangeLabel'),
      amountRangeValue: t('gift.amountRangeValue', {
        min: formatCurrencyOrFallback(config.checkoutMinAmount, currency),
        max: formatCurrencyOrFallback(config.checkoutMaxAmount, currency),
      }),
      usageHint: t('gift.usageHint'),
    },
    tips: {
      title: t('gift.tipsTitle'),
      body: t('gift.tipsBody'),
    },
    purchase: {
      pointsLabel: t('gift.pointsLabel'),
      pointsPlaceholder: t('gift.pointsPlaceholder'),
      amountLabel: t('gift.amountLabel'),
      amountEmpty: t('gift.amountEmpty'),
      hintLabel: t('gift.fenceHintLabel'),
      hintValue: rangePoints,
    },
    payment: {
      idleLabel:
        preview === null
          ? resolvePaymentProvider(currency) === 'payfast'
            ? t('gift.payButton.payfast')
            : t('gift.payButton.ecpay')
          : t('gift.payWithAmountAction', { amount: preview }),
      paying: t('gift.paying'),
      paid: t('gift.paid'),
    },
    // `errorKey` is `passHolder.validation.pointsBelowMin` or similar —
    // a KEY, not prose. Resolving it in the one place that owns `t()`
    // is what keeps it off the screen.
    validationMessage: errorKey === null ? null : t(stripNamespace(errorKey)),
  };
}

/**
 * Namespace this component's copy is mounted under. Must match the
 * argument to `useTranslation` above.
 */
const NAMESPACE = 'passHolder';

/**
 * `useTranslation(NAMESPACE)` scopes lookups to that namespace, so
 * `t('passHolder.validation.x')` searches for
 * `passHolder.passHolder.validation.x`, misses, and i18next echoes the
 * key straight back onto the page — the exact leak this hook exists to
 * prevent.
 *
 * Shared logic builds FULL keys (`KEY_PREFIX` in
 * `packages/shared/logic/giftCardPurchase.ts`) on purpose: it cannot
 * know which namespace the consuming app mounts them under (Rule 023 §
 * Shared Validation 用 i18n Key). The app decides placement, so the
 * namespace prefix has to come off before the lookup.
 *
 * The strip is anchored and namespace-scoped so a hypothetical key that
 * merely CONTAINS `passHolder.` further down its path is left intact.
 */
function stripNamespace(key: string): string {
  return key.startsWith(`${NAMESPACE}.`)
    ? key.slice(NAMESPACE.length + 1)
    : key;
}