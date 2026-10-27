/**
 * Discount card preview amounts — demo NUMBERS (the strings come from
 * the shared tier formatter).
 *
 * @module shared/constants/discountPreviewAmounts
 * @description The demo values shown by `PassCardPreviewBody` for the
 * discount-only amount fields:
 *   - `pointsToNextTierDiscount` — 到下一級還差 / Amount to Next Tier
 *   - `accumulatedSpendDiscount` — 累積消費 / Accumulated Spending
 *
 * 2026-10-27 — these became plain NUMBERS, and the display string is
 * now produced by `formatTierAmount`
 * (`packages/shared/logic/spendTier.ts`) — the SAME function the
 * backend uses to build the Wallet payload.
 *
 * WHY: the Wallet shows a "number + unit" pack whose unit placement
 * follows the TEMPLATE's language (`10元` for zh-TW, `NT$ 10` for
 * en, `R10` for ZAR). A per-currency string map cannot express that
 * — it would need a currency × language matrix, and the preview would
 * drift from the Wallet the moment either dimension changed.
 *
 * The formatter is now the single source of truth for BOTH surfaces,
 * which is the only way the editor preview and the issued pass can be
 * guaranteed to agree.
 *
 * WHY THE VALUES LIVE IN shared/ AND NOT IN i18n
 *   - Rule 023 § 翻譯書寫紀律: en translations may not contain Han
 *     characters (verify-i18n-keys.mjs § 4 hard fail). Putting "10元"
 *     in passCard.en.ts would fail the audit on every build.
 *   - Rule 024 § 業務邏輯在 shared/: the currency → display-string
 *     mapping is business-display logic, not locale-specific UI text.
 *
 * The demo values (234 / 556) differ from cashback's (562 / 3301)
 * because each card type's preview is independently sampled.
 *
 * @see packages/shared/logic/spendTier.ts — formatTierAmount
 * @see packages/shared/schemas/card/ (Currency schema: 'TWD' | 'ZAR')
 */

/**
 * Demo discount card amounts, as plain numbers.
 *
 * The currency / language rendering is applied by `formatTierAmount`,
 * so this map does NOT need a currency dimension — the same number
 * renders as `234元` (zh-TW TWD), `NT$ 234` (en TWD) or `R234`
 * (ZAR).
 *
 * The currency exhaustiveness guard now lives in `formatTierAmount`
 * itself (an exhaustive switch over the `Currency` union), which is
 * where the currency actually matters.
 */
export const DISCOUNT_PREVIEW_AMOUNTS: {
  pointsToNextTierDiscount: number;
  accumulatedSpendDiscount: number;
} = {
  pointsToNextTierDiscount: 234,
  accumulatedSpendDiscount: 556,
};
