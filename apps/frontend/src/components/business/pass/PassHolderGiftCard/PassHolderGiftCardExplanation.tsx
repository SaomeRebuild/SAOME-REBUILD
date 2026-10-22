/**
 * PassHolderGiftCardExplanation — states the tenant's own exchange rate
 * and per-checkout fences before the customer buys anything.
 *
 * Why this block exists: a gift card sells POINTS, not money. Without
 * an explicit "1 unit = N points, you can buy between X and Y" the
 * customer has no way to predict what the input below will cost, and
 * the CTA looks arbitrary. This is the block that makes the purchase
 * legible.
 *
 * Purely presentational — all strings arrive pre-resolved from the
 * parent so this file contains no `t()` calls and no business logic
 * (Rule 000 § A.2).
 */

import type { PassHolderGiftCardExplanationProps } from './PassHolderGiftCard.types';

export function PassHolderGiftCardExplanation({
  labels,
}: PassHolderGiftCardExplanationProps) {
  return (
    <header
      className="flex flex-col gap-2"
      data-testid="pass-holder-gift-card-explanation"
      aria-labelledby="pass-holder-gift-card-title"
    >
      <h2
        id="pass-holder-gift-card-title"
        className="text-lg font-semibold"
        style={{
          color: 'var(--color-foreground)',
          fontFamily: 'var(--font-family-heading)',
        }}
      >
        {labels.sectionTitle}
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
        {labels.sectionHint}
      </p>
      <dl
        className="flex flex-col gap-1 text-sm"
        data-testid="pass-holder-gift-card-rate"
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <dt style={{ color: 'var(--color-muted-foreground)' }}>{labels.rateLabel}</dt>
          <dd
            data-testid="pass-holder-gift-card-rate-value"
            style={{ color: 'var(--color-foreground)' }}
          >
            {labels.rateValue}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <dt style={{ color: 'var(--color-muted-foreground)' }}>{labels.rangeLabel}</dt>
          <dd
            data-testid="pass-holder-gift-card-range-value"
            style={{ color: 'var(--color-foreground)' }}
          >
            {labels.rangeValue}
          </dd>
        </div>
      </dl>
      <p
        className="text-sm"
        style={{ color: 'var(--color-muted-foreground)' }}
        data-testid="pass-holder-gift-card-usage"
      >
        {labels.usageHint}
      </p>
    </header>
  );
}