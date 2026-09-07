/**
 * Balance preview display strings — currency-driven (single source of truth).
 *
 * @module shared/constants/balancePreview
 * @description Used by `PassCardPreviewHeader` (apps/frontend/...) to render
 * the 2-line "餘額 / 200元" preview block for {stamp_card, reward_card,
 * cashback_card} card types.
 *
 * The choice is driven by **store.currency** (Zustand), NOT by i18n locale:
 *   - TWD → "200元"
 *   - ZAR → "R100"
 *
 * Why this lives in shared/ and not in `passCard.{zh-TW,en}.ts`:
 *   1. Rule 023 § 翻譯書寫紀律: en translations may not contain Han
 *      characters (verify-i18n-keys.mjs § 4 hard fail). Putting "200元"
 *      in passCard.en.ts would fail the audit on every build.
 *   2. Rule 023 § 業務邏輯在 shared/: the currency → display-string mapping
 *      is business-display logic, not locale-specific UI text. The locale-
 *      specific part (label "餘額" / "Balance") stays in i18n.
 *   3. The same value (e.g. "200元") is rendered for both locales when
 *      store.currency === 'TWD' — i18n would imply it changes per locale,
 *      which it does NOT.
 *
 * When a real member row is wired up (Rule 019 § future), this constant
 * becomes a default / placeholder and the actual value comes from the
 * member's balance. For now it's a hard-coded demo preview (per plan §
 * 設計決策: 200 TWD = 100 ZAR, 1:0.5 rate).
 */

import type { Currency } from '../schemas/card';

/**
 * Demo balance amounts per currency. Single source of truth — both
 * PassCardPreviewHeader and its tests import from here.
 *
 * Keys are exhaustive over the `Currency` schema (TWD | ZAR) so a future
 * currency addition to the schema triggers a TypeScript error here.
 */
export const BALANCE_PREVIEW_AMOUNTS: Record<Currency, string> = {
  TWD: '200元',
  ZAR: 'R100',
};
