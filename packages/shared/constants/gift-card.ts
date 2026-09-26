/**
 * Gift card constants — currency-driven display strings (single source of truth).
 *
 * @module shared/constants/gift-card
 * @description Used by `PassCardPreviewHeader` (apps/frontend/...) to render
 * the 2-line "點數 / 2363點" preview block for gift_card card type.
 *
 * The choice is driven by **store.currency** in principle, but for the
 * gift_card preview we ship a single static demo value (per user decision
 * 2026-09-27: "2363點" is a hardcoded display constant, NOT derived from
 * store). This matches the cashback card pattern (currency-driven map) but
 * simplifies by avoiding the currency dependency for a future demo value
 * — once member rows are wired, the value will come from the member's
 * actual point balance rather than this constant.
 *
 * Why this lives in shared/ and not in `passCard.{zh-TW,en}.ts`:
 *   1. Rule 023 § 翻譯書寫紀律: en translations may not contain Han
 *      characters (verify-i18n-keys.mjs § 4 hard fail). Putting "2363點"
 *      in passCard.en.ts would fail the audit on every build.
 *   2. Rule 023 § 業務邏輯在 shared/: the display-string is business-display
 *      logic, not locale-specific UI text. The locale-specific part
 *      (label "點數" / "Points") stays in i18n.
 *   3. The same value is rendered for both locales when gift_card is
 *      selected — i18n would imply it changes per locale, which it does NOT.
 *
 * When a real member row is wired up (Rule 019 § future), this constant
 * becomes a default / placeholder and the actual value comes from the
 * member's point balance. For now it's a hard-coded demo preview.
 */

import type { Currency } from '../schemas/card';

/**
 * Demo gift points amount (constant per plan § 0 設計決策 — pure visual
 * showcase, not derived from store). Single source of truth — both
 * PassCardPreviewHeader and its tests import from here.
 *
 * Keys are exhaustive over the `Currency` schema (TWD | ZAR) so a future
 * currency addition to the schema triggers a TypeScript error here.
 *
 * 2026-09-27: User-confirmed decision — same static "2363點" regardless of
 * currency. The TWD/ZAR distinction is preserved in the type system for
 * future migration (when points become store-driven), but the actual
 * display string is intentionally currency-invariant.
 */
export const GIFT_POINTS_PREVIEW_VALUE = '2363點';

/**
 * Default values for the gift card exchange rate editor.
 *
 * 2026-09-27 user-confirmed defaults: 1 unit of currency = 1 point.
 * These are the initial values for the new `giftCardAmount` /
 * `giftCardPoints` fields in the gift_card Step 6 editor. Both defaults
 * are 1 (positive integer, satisfying `z.number().int().positive()`).
 */
export const GIFT_CARD_DEFAULT_AMOUNT = 1;
export const GIFT_CARD_DEFAULT_POINTS = 1;

/**
 * Currency-aware unit label for the amount field (mirrors
 * `CouponDiscountAmountField.tsx` pattern):
 *   - TWD zh-TW: 「消費 [input] 元」 → suffix
 *   - TWD en:    「Spend NT$ [input]」 → prefix
 *   - ZAR:       「Spend R [input]」    → prefix
 *
 * Kept in shared/ because the placeholder strings double as i18n values
 * for `step6.gift.amountUnitTWD` / `amountUnitZAR`. The placeholders are
 * constants (NOT in passCard) for the same Rule 023 reason as above —
 * currency-driven, not locale-driven.
 *
 * (Note: the placeholders are also exposed via i18n keys for UI display.
 * See `step6.gift.amountUnitTWD` / `step6.gift.amountUnitZAR` in
 * `cardEditor.{zh-TW,en}.ts`. The shared constant is reserved for future
 * direct use if needed; for now the UI reads the i18n keys.)
 */
export const GIFT_CARD_UNIT_LABELS: Record<Currency, { prefix: string; suffix: string }> = {
  TWD: { prefix: '', suffix: '元' },
  ZAR: { prefix: 'R', suffix: '' },
};