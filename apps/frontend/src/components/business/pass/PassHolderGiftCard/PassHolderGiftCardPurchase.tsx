/**
 * PassHolderGiftCardPurchase — points input + derived (read-only)
 * currency amount.
 *
 * The customer types POINTS; the amount is derived by
 * `pointsToAmount` from the tenant's own rate. There is deliberately no
 * amount input: a price the customer can edit is a price the backend
 * would have to distrust.
 *
 * This is a pure view: it runs no validator and holds no `t()`. The
 * parent calls `validateGiftCardPurchase` (the SAME function the backend
 * runs), resolves the rejection copy, and passes it down as
 * `validationMessage` — so the customer sees the fence message inline
 * instead of round-tripping for a 400 (Rule 032 § 2), and no i18n key
 * can leak into the DOM.
 *
 * The derived amount shows three states:
 *   - no input            → "—" placeholder, CTA blocked
 *   - rejected input      → the parent's translated reason
 *   - valid               → the exact amount, CTA enabled
 *
 * `font-size: 16px` on the input satisfies the mobile iOS no-zoom rule
 * (RWD § 表單在 mobile 的處理); the label sits ABOVE the input for the
 * same reason.
 */

import { useId } from 'react';
import { pointsToAmount } from '@saome/shared/logic/giftCardPurchase';
import { formatCurrencyOrFallback } from '@saome/shared/logic/currency';
import type { Currency } from '@saome/shared/schemas/card';
import type { PublicGiftCardConfig } from '@saome/shared/types/passHolder';

export interface PassHolderGiftCardPurchaseProps {
  config: PublicGiftCardConfig;
  currency: Currency;
  /** Current parsed points, or null when the input is empty/unparseable. */
  purchasedPoints: number | null;
  onPurchasedPointsChange: (points: number | null) => void;
  /**
   * ALREADY-TRANSLATED rejection copy from the parent, or null when the
   * input is empty or valid.
   *
   * This component has no `t()` on purpose (it stays a pure view), so
   * it must never receive an i18n KEY. `validateGiftCardPurchase`
   * returns `passHolder.validation.pointsBelowMin` as `message` — that
   * is a key, not prose. Rendering it here leaked the raw key onto the
   * page. The parent resolves it and hands over finished copy.
   */
  validationMessage: string | null;
  /** Pre-formatted copy resolved by the parent. */
  labels: {
    pointsLabel: string;
    pointsPlaceholder: string;
    amountLabel: string;
    amountEmpty: string;
    hintLabel: string;
    hintValue: string;
  };
  disabled?: boolean;
}

export function PassHolderGiftCardPurchase({
  config,
  currency,
  purchasedPoints,
  onPurchasedPointsChange,
  validationMessage,
  labels,
  disabled,
}: PassHolderGiftCardPurchaseProps) {
  const pointsId = useId();
  const amountId = useId();
  const hintId = useId();

  const derivedAmount =
    purchasedPoints === null ? null : pointsToAmount(purchasedPoints, config);

  // The message shown under the input: the parent's already-translated
  // rejection reason when the value is invalid, otherwise the derived
  // amount. An unpriceable value (not a multiple of the rate) has no
  // amount to show, but it DOES have a `validationMessage` — the reason
  // — so it reads as an explanation rather than "no points entered".
  const statusText =
    validationMessage ??
    (derivedAmount !== null
      ? formatCurrencyOrFallback(derivedAmount, currency)
      : labels.amountEmpty);

  const isInvalid = validationMessage !== null;

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="pass-holder-gift-card-purchase"
    >
      <label
        htmlFor={pointsId}
        className="text-sm font-medium"
        style={{ color: 'var(--color-foreground)' }}
      >
        {labels.pointsLabel}
      </label>
      <input
        id={pointsId}
        name="giftCardPoints"
        type="number"
        inputMode="numeric"
        // No `min`/`max` HTML attributes: the fences are inclusive and
        // `validateGiftCardPurchase` already reports them with copy the
        // customer can act on. A native tooltip would be in English.
        value={purchasedPoints ?? ''}
        placeholder={labels.pointsPlaceholder}
        aria-describedby={`${amountId} ${hintId}`}
        aria-invalid={isInvalid}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw.trim() === '') {
            onPurchasedPointsChange(null);
            return;
          }
          // Non-integer input stays in the DOM while typing but is not
          // propagated to state — `Number.parseInt` yields NaN for
          // garbage, which we surface as "no points entered".
          const parsed = Number(raw);
          onPurchasedPointsChange(
            Number.isInteger(parsed) && parsed > 0 ? parsed : null,
          );
        }}
        data-testid="pass-holder-gift-card-points-input"
        className="min-h-[48px] w-full rounded-lg border px-3 py-2"
        style={{
          // 16px (not 14px) so iOS Safari does NOT zoom on focus.
          fontSize: '16px',
          color: 'var(--color-foreground)',
          backgroundColor: 'var(--color-background)',
          borderColor: isInvalid ? 'var(--color-destructive)' : 'var(--color-border)',
        }}
      />

      <div
        className="flex items-baseline justify-between gap-2 text-sm"
        id={amountId}
      >
        <span style={{ color: 'var(--color-muted-foreground)' }}>
          {labels.amountLabel}
        </span>
        {/* `aria-live` so a screen reader announces the amount as the
            customer types — the price is the whole point of the field. */}
        <span
          aria-live="polite"
          data-testid="pass-holder-gift-card-amount"
          style={{
            color: isInvalid
              ? 'var(--color-destructive)'
              : 'var(--color-foreground)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {statusText}
        </span>
      </div>

      <p id={hintId} className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
        {labels.hintLabel} {labels.hintValue}
      </p>
    </div>
  );
}