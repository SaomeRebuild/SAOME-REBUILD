/**
 * PassHolderGiftCard barrel — re-exports the public API of the
 * gift-card purchase sub-folder. Mirrors the L2 folder convention used
 * by `PassHolderMembershipTiers/index.ts`.
 *
 * 2026-10-23 — the gift-card purchase flow. See
 * `runs/decisions/2026-10-23-gift-card-paid-registration.md`.
 */

export { PassHolderGiftCard } from './PassHolderGiftCard';
export { PassHolderGiftCardExplanation } from './PassHolderGiftCardExplanation';
export { PassHolderGiftCardPurchase } from './PassHolderGiftCardPurchase';
export type { PassHolderGiftCardPurchaseProps } from './PassHolderGiftCardPurchase';
export { PassHolderGiftCardTips } from './PassHolderGiftCardTips';
export type {
  PassHolderGiftCardProps,
  PassHolderGiftCardExplanationProps,
  PassHolderGiftCardTipsProps,
} from './PassHolderGiftCard.types';