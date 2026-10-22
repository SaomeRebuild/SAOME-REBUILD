/**
 * PassHolderGiftCardTips — gifting hint.
 *
 * A gift card's most common intent is "buy it FOR someone else", and the
 * 4 pass-delivery fields above are easy to mistake for the buyer's own
 * details. This block removes that ambiguity before the customer pays.
 *
 * Purely presentational — strings arrive pre-resolved.
 */

import type { PassHolderGiftCardTipsProps } from './PassHolderGiftCard.types';

export function PassHolderGiftCardTips({ title, body }: PassHolderGiftCardTipsProps) {
  return (
    <aside
      className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm"
      data-testid="pass-holder-gift-card-tips"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-muted, rgba(148, 163, 184, 0.12))',
      }}
    >
      <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
        {title}
      </span>
      <span style={{ color: 'var(--color-muted-foreground)' }}>{body}</span>
    </aside>
  );
}