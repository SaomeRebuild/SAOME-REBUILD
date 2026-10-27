/**
 * Visit count formatting — "number + unit" pack for the `visitCount` slot.
 *
 * @module shared/logic/visitCount
 * @description The Wallet shows a visit counter as a "number + unit"
 * pack, not as a bare integer:
 *
 *   - zh-TW → `5 次`
 *   - en    → `5 times`
 *
 * The unit follows the TEMPLATE's language, not the reader's locale —
 * the same rule the discount tier slots follow (see
 * `logic/spendTier.ts::formatTierAmount`). A card authored in English
 * shows `5 times` even for a Traditional Chinese tenant, because the
 * card's audience is fixed by the template.
 *
 * WHY A SEPARATE LEAF MODULE (and not `logic/spendTier.ts`)
 * ------------------------------------------------------------------------
 * `spendTier.ts` owns the DISCOUNT card's tier ladder and its amount
 * slots. The visit counter is a different business concept that merely
 * shares the "number + unit" SHAPE. Merging them would couple an
 * unrelated counter to the tier resolver, and would make the tier
 * module's contract (which the coupon / gift / reward paths already
 * depend on) change whenever a counter's unit changes.
 *
 * WHY THE UNIT IS NOT IN THE i18n DICTIONARY
 * ------------------------------------------------------------------------
 * The unit is not UI chrome — it is part of the VALUE the Wallet
 * renders. Two consumers must agree on it byte for byte:
 *
 *   1. The backend, which writes `properties.visitCount` into the
 *      Passcreator payload.
 *   2. The editor preview, which must show what the issued pass shows.
 *
 * A shared i18n dictionary would only work if BOTH sides resolved the
 * same locale, and the backend resolves the TEMPLATE's language while
 * the preview resolves the APP's locale — two different inputs. Putting
 * the unit in a pure function keyed by `PassLanguage` removes that
 * mismatch entirely, and matches the precedent set by
 * `logic/spendTier.ts::formatTierAmount`.
 *
 * Rule references:
 *   - Rule 023 § Shared Package 邊界 — pure function, no I/O, no
 *     framework import, so React Native gets it for free.
 *   - Rule 024 § Mobile Future-Proof — no platform API is touched.
 *   - Rule 019 § D.3 — the formatted string is a wire contract with
 *     Passcreator and with the editor preview; both read it here.
 *
 * @see packages/shared/logic/passFieldFormatter.ts — emits the values
 * @see packages/shared/constants/visitCountPreview.ts — the preview demo value
 * @see runs/decisions/2026-10-27-visit-count-unit-display.md
 */

import type { PassLanguage } from '../i18n/fieldLabels';

/**
 * The placeholder rendered when a count cannot be formatted.
 *
 * Matches the fallback in `logic/spendTier.ts::formatTierAmount` and
 * `logic/currency.ts::formatCurrencyOrFallback` — one visual language
 * for "this value is not available".
 */
const INVALID_VALUE = '—';

/**
 * Render a visit count as the "number + unit" string the Wallet shows.
 *
 * @param count    — the visit count. A non-finite value renders as '—'.
 * @param language — the TEMPLATE's display language.
 *
 * @example
 *   formatVisitCount(5, 'zh-TW');  // '5 次'
 *   formatVisitCount(5, 'en');     // '5 times'
 */
export function formatVisitCount(
  count: number,
  language: PassLanguage,
): string {
  if (!Number.isFinite(count)) return INVALID_VALUE;

  switch (language) {
    case 'zh-TW':
      // Traditional Chinese puts the unit after the number, separated
      // by a space (matching the long-standing preview string '5 次').
      return `${count} 次`;
    case 'en':
      return `${count} times`;
    default: {
      // Exhaustiveness check — a new language is a compile error here
      // rather than a silent "undefined" on a live card.
      const _exhaustive: never = language;
      void _exhaustive;
      return INVALID_VALUE;
    }
  }
}
