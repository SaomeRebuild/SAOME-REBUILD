/**
 * Cashback card preview amounts — currency-driven (single source of truth).
 *
 * @module shared/constants/cashbackPreviewAmounts
 * @description Used by `PassCardPreviewBody` (apps/frontend/...) to render
 * the demo values for cashback-only display fields:
 *   - `pointsToNextTierCashback` — 到下個層級還差 / Amount to Next Tier
 *   - `accumulatedSpendCashback` — 已累積消費 / Accumulated Spending
 *
 * The choice is driven by **store.currency** (Zustand), NOT by i18n locale:
 *   - TWD → "562元" / "3301元"
 *   - ZAR → "R562" / "R3301"
 *
 * Why this lives in shared/ and not in `passCard.{zh-TW,en}.ts`:
 *   1. Rule 023 § 翻譯書寫紀律: en translations may not contain Han
 *      characters (verify-i18n-keys.mjs § 4 hard fail). Putting "562元"
 *      in passCard.en.ts would fail the audit on every build.
 *   2. Rule 023 § 業務邏輯在 shared/: the currency → display-string mapping
 *      is business-display logic, not locale-specific UI text. The locale-
 *      specific part (label "到下個層級還差" / "Amount to Next Tier")
 *      stays in i18n.
 *   3. The same value (e.g. "562元") is rendered for both locales when
 *      store.currency === 'TWD' — i18n would imply it changes per locale,
 *      which it does NOT.
 *
 * History (2026-09-13 ZAR pollution fix):
 *   Prior to this constant, the body component applied a regex-based
 *   `R` prefix formatter to ALL i18n-sourced field values, which
 *   contaminated non-amount fields (phone `+886...` → `R886...`,
 *   visitCount `5 次` → `R5`, etc.) for every card type. See plan
 *   `zar_preview_field_污染修正` for the full root-cause analysis.
 *   The body now reads cashback amounts from this map (like
 *   `BALANCE_PREVIEW_AMOUNTS` does for the balance preview block).
 *
 * Keys are exhaustive over the `Currency` schema (TWD | ZAR) so a future
 * currency addition to the schema triggers a TypeScript error here.
 */

import type { Currency } from '../schemas/card';

/**
 * Demo cashback card amounts per currency. Single source of truth — both
 * PassCardPreviewBody and its tests import from here.
 *
 * Keys are exhaustive over the `Currency` schema (TWD | ZAR) so a future
 * currency addition to the schema triggers a TypeScript error here.
 */
export const CASHBACK_PREVIEW_AMOUNTS: Record<
  Currency,
  {
    pointsToNextTierCashback: string;
    accumulatedSpendCashback: string;
  }
> = {
  TWD: {
    pointsToNextTierCashback: '562元',
    accumulatedSpendCashback: '3301元',
  },
  ZAR: {
    pointsToNextTierCashback: 'R562',
    accumulatedSpendCashback: 'R3301',
  },
};
