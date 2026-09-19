/**
 * Coupon card preview amounts — currency-driven (single source of truth).
 *
 * @module shared/constants/couponPreviewAmounts
 * @description Used by `PassCardPreviewBody` (apps/frontend/...) to render
 * the demo value for the coupon-only display field:
 *   - `couponDiscount` — 折扣優惠 / Discount Offer
 *
 * Mirrors `cashbackPreviewAmounts.ts` (2026-09-12) and
 * `discountPreviewAmounts.ts` (2026-09-18) — same shape, same
 * currency-driven rationale (zh-TW Han suffix vs ZAR Latin prefix).
 *
 * Demo values:
 *   - TWD: "10元折扣" (cash discount display, suffix 元)
 *   - ZAR: "R10折扣" (cash discount display, prefix R)
 *
 * Why this lives in shared/ and not in `passCard.{zh-TW,en}.ts`:
 *   1. Rule 023 § 翻譯書寫紀律: en translations may not contain Han
 *      characters (verify-i18n-keys.mjs § 4 hard fail). Putting "10元折扣"
 *      in passCard.en.ts would fail the audit on every build.
 *   2. Rule 023 § 業務邏輯在 shared/: the currency → display-string mapping
 *      is business-display logic, not locale-specific UI text. The locale-
 *      specific part (label "折扣優惠" / "Discount Offer") stays in i18n.
 *   3. The same value (e.g. "10元折扣") is rendered for both locales when
 *      store.currency === 'TWD' — i18n would imply it changes per locale,
 *      which it does NOT.
 *
 * Keys are exhaustive over the `Currency` schema (TWD | ZAR) so a future
 * currency addition to the schema triggers a TypeScript error here.
 *
 * Note: the `couponRemainingCount` field is NOT in this map — its value
 * is a static demo "1張" / "1 sheet" sourced from i18n fieldPreview
 * (matching the existing phone/email/visitCount pattern). No live counter
 * yet because no redemption/issuance flow exists (user-confirmed scope,
 * 2026-09-19).
 *
 * Note: the `percent_off` variant ("10%折扣") is NOT in this map either
 * — it is store-derived from `couponDiscountPercent` and is therefore
 * computed inline in PassCardPreviewBody (same pattern as the
 * `discountTierBracket` field for discount_card).
 *
 * 2026-09-19 — added alongside Step 3 / preview coupon_card extension.
 */

import type { Currency } from '../schemas/card';

/**
 * Demo coupon card discount string per currency. Single source of truth —
 * both PassCardPreviewBody and its tests import from here.
 *
 * Keys are exhaustive over the `Currency` schema (TWD | ZAR) so a future
 * currency addition to the schema triggers a TypeScript error here.
 */
export const COUPON_PREVIEW_AMOUNTS: Record<
  Currency,
  {
    couponDiscount: string;
  }
> = {
  TWD: {
    couponDiscount: '10元折扣',
  },
  ZAR: {
    couponDiscount: 'R10折扣',
  },
};
