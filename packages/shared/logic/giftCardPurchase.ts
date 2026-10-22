/**
 * Gift-card purchase logic — the single source of truth for turning a
 * points amount into a currency price.
 *
 * @module shared/logic/giftCardPurchase
 * @description A gift card sells POINTS, not tiers. The tenant configures
 * a rate in CardBuilder Step 6: `giftCardAmount` currency units buy
 * `giftCardPoints` points. This module owns the math and the fences so
 * the public purchase page, the register API, and a future React Native
 * app all agree on the price.
 *
 * Why the logic lives here and not in the API route (Rule 000 § D.4 /
 * Rule 023 § shared package):
 *   1. The frontend needs it to preview the price as the customer types.
 *   2. The backend MUST re-run the same function before charging —
 *      a client-supplied amount is never trusted. Sharing the function
 *      means the two can't drift.
 *   3. Zero web-only APIs, so RN migration is free.
 *
 * Money rounding: `unitAmount` and `unitPoints` are both positive
 * INTEGERs in `templateSettingsSchema`, and we require `points` to be an
 * exact multiple of `unitPoints`. `(points / unitPoints)` is then an
 * exact integer and the product is an exact integer — no rounding rule
 * is needed, and no `Math.round` drift can occur between the preview the
 * customer saw and the amount the backend charges.
 *
 * i18n: every failure returns an **i18n key**, never a raw string
 * (Rule 023 § Shared Validation 用 i18n Key).
 *
 * @see runs/decisions/2026-10-23-gift-card-paid-registration.md
 */

import type {
  GiftCardSnapshot,
  PublicGiftCardConfig,
} from '../types/passHolder';
import type { Currency } from '../schemas/card';

/**
 * Result of `validateGiftCardPurchase`.
 *
 * On failure we return BOTH a stable machine-readable `code` and an
 * i18n key. `code` lets the UI pick a control state (e.g. "too small"
 * gets a gentler hint than "bad rate") without string-matching the
 * translated message.
 */
export type GiftCardPurchaseValidation =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'pointsInvalid'
        | 'pointsBelowMin'
        | 'pointsAboveMax'
        | 'pointsNotMultipleOfRate'
        | 'configInvalid';
      /** i18n key, e.g. `passHolder.validation.pointsBelowMin`. */
      message: string;
    };

const KEY_PREFIX = 'passHolder.validation.';

function fail(
  code: Extract<GiftCardPurchaseValidation, { ok: false }>['code'],
): Extract<GiftCardPurchaseValidation, { ok: false }> {
  return { ok: false, code, message: `${KEY_PREFIX}${code}` };
}

/**
 * Structural guard for a projected config. The backend normalizer can
 * emit `null` for a partially-configured template, and the JSONB column
 * is free-form, so a corrupt row must not crash the purchase page — it
 * should render nothing instead.
 */
function isUsableConfig(config: PublicGiftCardConfig): boolean {
  return (
    Number.isFinite(config.unitAmount) &&
    config.unitAmount > 0 &&
    Number.isInteger(config.unitAmount) &&
    Number.isFinite(config.unitPoints) &&
    config.unitPoints > 0 &&
    Number.isInteger(config.unitPoints) &&
    Number.isFinite(config.checkoutMinPoints) &&
    Number.isFinite(config.checkoutMaxPoints) &&
    config.checkoutMinPoints > 0 &&
    config.checkoutMaxPoints >= config.checkoutMinPoints
  );
}

/**
 * Validate a points input against the template's per-checkout fences.
 *
 * Check order matters and is pinned by tests — the user gets the most
 * ACTIONABLE message first:
 *   1. `configInvalid`      — the template itself is broken; nothing the
 *                            customer can fix. Render no purchase UI.
 *   2. `pointsInvalid`      — empty / non-integer / non-positive input.
 *   3. `pointsBelowMin` /
 *      `pointsAboveMax`     — the explicit bounds. Checked before
 *                            divisibility because "you bought too few"
 *                            is far more useful than "not a multiple".
 *   4. `pointsNotMultipleOfRate` — the rate can't produce a whole
 *                            currency amount for this points value.
 *
 * @param points  Customer's points input (may be any number; NaN-safe).
 * @param config  Projected gift-card configuration.
 */
export function validateGiftCardPurchase(
  points: number,
  config: PublicGiftCardConfig,
): GiftCardPurchaseValidation {
  if (!isUsableConfig(config)) {
    return fail('configInvalid');
  }
  if (!Number.isFinite(points) || !Number.isInteger(points) || points <= 0) {
    return fail('pointsInvalid');
  }
  if (points < config.checkoutMinPoints) {
    return fail('pointsBelowMin');
  }
  if (points > config.checkoutMaxPoints) {
    return fail('pointsAboveMax');
  }
  if (points % config.unitPoints !== 0) {
    return fail('pointsNotMultipleOfRate');
  }
  return { ok: true };
}

/**
 * Convert a points amount to the currency amount the customer pays.
 *
 * Returns `null` when the conversion is not expressible — i.e. when the
 * points value is not a whole multiple of `unitPoints` (which would
 * force a fractional currency amount), or when either input is not a
 * usable positive integer. Callers should treat `null` as "cannot price
 * this right now" and keep the CTA disabled rather than guessing.
 *
 * @example
 *   pointsToAmount(500, { unitAmount: 100, unitPoints: 10, ... })  // 5000
 *   pointsToAmount(505, { unitAmount: 100, unitPoints: 10, ... })  // null
 */
export function pointsToAmount(
  points: number,
  config: PublicGiftCardConfig,
): number | null {
  if (!isUsableConfig(config)) return null;
  if (!Number.isFinite(points) || !Number.isInteger(points) || points <= 0) {
    return null;
  }
  if (points % config.unitPoints !== 0) return null;
  const units = points / config.unitPoints;
  const amount = units * config.unitAmount;
  // Defensive: a future schema loosening to fractional `unitAmount`
  // must not hand a fractional currency amount to the payment layer.
  return Number.isInteger(amount) ? amount : null;
}

/**
 * Build the frozen purchase snapshot persisted to
 * `public.pass_holders.gift_card_snapshot`.
 *
 * The amount is ALWAYS derived here from the supplied config — there is
 * deliberately no `amount` parameter, so no caller (frontend or backend)
 * can inject a price. The backend passes the TEMPLATE's config (read
 * fresh from `settings`), not a client-sent one.
 *
 * @throws when the purchase is invalid. Callers must surface the
 *         `validateGiftCardPurchase` message instead of persisting a
 *         snapshot they cannot justify.
 */
export function buildGiftCardSnapshot(
  points: number,
  config: PublicGiftCardConfig,
  currency: Currency,
): GiftCardSnapshot {
  const validation = validateGiftCardPurchase(points, config);
  if (!validation.ok) {
    throw new Error(
      `[buildGiftCardSnapshot] invalid gift-card purchase (${validation.code}) for ${points} points`,
    );
  }
  const amount = pointsToAmount(points, config);
  if (amount === null) {
    // Unreachable: validate already rejected the divisibility case.
    // Kept as a hard guard so a future change to either function can't
    // silently persist `amount: null` into JSONB.
    throw new Error(
      `[buildGiftCardSnapshot] unpriceable gift-card purchase for ${points} points`,
    );
  }
  return {
    points,
    amount,
    currency,
    unitAmount: config.unitAmount,
    unitPoints: config.unitPoints,
    checkoutMinPoints: config.checkoutMinPoints,
    checkoutMaxPoints: config.checkoutMaxPoints,
  };
}