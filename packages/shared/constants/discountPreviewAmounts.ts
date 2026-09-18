/**
 * Discount card preview amounts — currency-driven (single source of truth).
 *
 * @module shared/constants/discountPreviewAmounts
 * @description Used by `PassCardPreviewBody` (apps/frontend/...) to render
 * the demo values for discount-only display fields:
 *   - `pointsToNextTierDiscount` — 到下一級還差 / Amount to Next Tier
 *   - `accumulatedSpendDiscount` — 累積消費 / Accumulated Spending
 *
 * Mirrors `cashbackPreviewAmounts.ts` (2026-09-12) — same shape, same
 * currency-driven rationale (zh-TW Han suffix vs ZAR Latin prefix). The
 * demo values (234 / 556) differ from cashback's (562 / 3301) because
 * each card type's preview is independently sampled.
 *
 * Why this lives in shared/ and not in `passCard.{zh-TW,en}.ts`:
 *   1. Rule 023 § 翻譯書寫紀律: en translations may not contain Han
 *      characters (verify-i18n-keys.mjs § 4 hard fail). Putting "234元"
 *      in passCard.en.ts would fail the audit on every build.
 *   2. Rule 023 § 業務邏輯在 shared/: the currency → display-string mapping
 *      is business-display logic, not locale-specific UI text. The locale-
 *      specific part (label "到下一級還差" / "Amount to Next Tier")
 *      stays in i18n.
 *   3. The same value (e.g. "234元") is rendered for both locales when
 *      store.currency === 'TWD' — i18n would imply it changes per locale,
 *      which it does NOT.
 *
 * Keys are exhaustive over the `Currency` schema (TWD | ZAR) so a future
 * currency addition to the schema triggers a TypeScript error here.
 *
 * 2026-09-18 — added alongside Step 3 / preview discount_card extension.
 */

import type { Currency } from '../schemas/card';

/**
 * Demo discount card amounts per currency. Single source of truth — both
 * PassCardPreviewBody and its tests import from here.
 *
 * Keys are exhaustive over the `Currency` schema (TWD | ZAR) so a future
 * currency addition to the schema triggers a TypeScript error here.
 */
export const DISCOUNT_PREVIEW_AMOUNTS: Record<
  Currency,
  {
    pointsToNextTierDiscount: string;
    accumulatedSpendDiscount: string;
  }
> = {
  TWD: {
    pointsToNextTierDiscount: '234元',
    accumulatedSpendDiscount: '556元',
  },
  ZAR: {
    pointsToNextTierDiscount: 'R234',
    accumulatedSpendDiscount: 'R556',
  },
};