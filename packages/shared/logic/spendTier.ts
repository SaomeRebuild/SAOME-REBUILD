/**
 * Spend tier resolution + display formatting for discount-style cards.
 *
 * @module shared/logic/spendTier
 * @description Two independent concerns, deliberately in one module
 * because they answer the same business question ("which tier is this
 * holder in, and how much more do they have to spend?"):
 *
 *  1. `resolveSpendTier` — maps (tier ladder, accumulated spend) onto
 *     the current tier, the next tier, and the spend gap between the
 *     holder and the next tier.
 *  2. `formatTierAmount` / `formatTierPercent` — renders the numbers
 *     as the "number + unit" strings the Wallet shows.
 *
 * WHY A SEPARATE FORMATTER (and not `logic/currency.ts::formatCurrency`)
 * ------------------------------------------------------------------------
 * `formatCurrency` renders MONEY for the backFields / purchase UI:
 * `NT$1,000` (thousands separators, no locale switch). The tier slots
 * on a discount card are a different surface:
 *
 *   - The unit placement depends on the TEMPLATE's language, not the
 *     reader's locale — a card authored in English shows `NT$ 10`
 *     even for a Traditional Chinese tenant, because the card's
 *     audience is fixed by the template.
 *   - There are no thousands separators: the values are small gaps
 *     ("10元"), not ledger amounts.
 *
 * Mixing the two would mean editing a formatter that the coupon,
 * gift-card and reward paths already depend on. Keeping the tier
 * formatter separate means those paths cannot regress.
 *
 * TIER RESOLUTION MIRRORS THE LEGACY PLUGIN
 * ------------------------------------------------------------------------
 * `saome_pe_discount_resolve_tier` in the legacy WordPress plugin
 * (`SAOME-Passcreator-Engine/modules/passcreator-discount-card.php`):
 *
 *   1. Sort the tiers by threshold ascending.
 *   2. Walk them; the LAST tier whose threshold is <= total spend is
 *      the current tier. A holder below even the first threshold
 *      still gets the first (base) tier.
 *   3. The gap to the next tier is `next.threshold - totalSpend`,
 *      floored at zero. With no next tier the gap is zero.
 *
 * A card issued by the old plugin and a card issued here therefore
 * resolve the same tier for the same spend — which matters because a
 * tenant may migrate mid-life.
 *
 * Rule references:
 *   - Rule 023 § Shared Package 邊界 — pure functions, no I/O, no
 *     framework import, so React Native gets them for free.
 *   - Rule 024 § Mobile Future-Proof — no platform API is touched.
 *   - Rule 019 § D.3 — the formatted string is a wire contract with
 *     Passcreator and with the editor preview; both read it here.
 *
 * @see packages/shared/logic/passFieldFormatter.ts — emits the values
 * @see runs/decisions/2026-10-27-pass-holder-spend-and-discount-tier.md
 */

import type { Currency } from '../schemas/card';
import type { PassLanguage } from '../i18n/fieldLabels';

/**
 * One rung of a spend ladder.
 *
 * `percent` is the discount (or cashback) percentage the tier grants.
 */
export interface SpendTierRule {
  /** The tier's display name — e.g. '一般會員'. */
  name: string;
  /** Accumulated spend required to REACH this tier. 0 = base tier. */
  thresholdSpend: number;
  /** The percentage this tier grants. */
  percent: number;
}

/**
 * The outcome of resolving a holder's accumulated spend against a
 * tier ladder.
 */
export interface ResolvedSpendTier {
  /** The tier the holder currently sits in. */
  current: SpendTierRule;
  /** The tier above, or null when the holder is already at the top. */
  next: SpendTierRule | null;
  /**
   * How much more the holder must spend to reach `next`.
   *
   * Zero when there is no next tier, and never negative.
   */
  spendToNext: number;
}

/**
 * The shape the template settings use for a discount tier.
 *
 * Mirrors `discountSettingsSchema.discountTiers[]` in
 * `packages/shared/schemas/card/templateSettings/discount.ts` — the
 * persisted column name is `discountPercent`, the resolver's is
 * `percent`.
 */
export interface DiscountTierSetting {
  name: string;
  thresholdSpend: number;
  discountPercent: number;
}

/**
 * The placeholder rendered when a value cannot be formatted.
 *
 * Matches the fallback in `logic/currency.ts::formatCurrencyOrFallback`.
 */
const INVALID_VALUE = '—';

/**
 * Resolve a holder's tier from their accumulated spend.
 *
 * @param rules       — the tier ladder. Sorted internally, so the
 *                      caller's order does not matter.
 * @param totalSpend  — the holder's accumulated spend. NaN and
 *                      -Infinity are treated as zero; +Infinity
 *                      resolves to the top tier.
 * @returns           — the resolved tier, or null when the template
 *                      has no tiers at all (there is nothing to show).
 */
export function resolveSpendTier(
  rules: readonly SpendTierRule[],
  totalSpend: number,
): ResolvedSpendTier | null {
  if (!Array.isArray(rules) || rules.length === 0) return null;

  // A NaN spend must not silently become NaN in every comparison
  // below (NaN >= x is always false, which would strand the holder in
  // the base tier regardless of their real spend). -Infinity is
  // clamped for the same reason.
  //
  // +Infinity is deliberately NOT clamped: "infinitely much spend"
  // legitimately means the top tier, which is also what the legacy
  // plugin's float comparison produces.
  const spend =
    Number.isNaN(totalSpend) || totalSpend === Number.NEGATIVE_INFINITY
      ? 0
      : totalSpend;

  const sorted = [...rules].sort((a, b) => a.thresholdSpend - b.thresholdSpend);

  // The base tier is the fallback for a holder below every threshold.
  let current = sorted[0];
  let next: SpendTierRule | null = null;

  for (let i = 0; i < sorted.length; i += 1) {
    const rule = sorted[i];
    if (spend >= rule.thresholdSpend) {
      // Still within reach — this is the current tier, and the tier
      // after it is the next one.
      current = rule;
      next = sorted[i + 1] ?? null;
    } else {
      // Beyond reach — this is the next tier, and nothing above it.
      next = rule;
      break;
    }
  }

  const spendToNext = next ? Math.max(0, next.thresholdSpend - spend) : 0;

  return { current, next, spendToNext };
}

/**
 * Render a spend amount as the "number + unit" string the Wallet shows.
 *
 * The unit placement follows the TEMPLATE's language:
 *
 *   - TWD + zh-TW → `10元`   (unit suffix, Han)
 *   - TWD + en    → `NT$ 10` (unit prefix)
 *   - ZAR         → `R10`    (unit prefix, same in both languages —
 *                               the rand symbol is not localised)
 *
 * Amounts keep up to two decimals and drop trailing zeros, so a whole
 * number reads `10` rather than `10.00`.
 *
 * @param amount   — the amount. A non-finite value renders as '—'.
 * @param currency — the card's currency.
 * @param language — the card's display language.
 */
export function formatTierAmount(
  amount: number,
  currency: Currency,
  language: PassLanguage,
): string {
  if (!Number.isFinite(amount)) return INVALID_VALUE;

  const numeric = formatAmountNumber(amount);

  switch (currency) {
    case 'TWD':
      // Traditional Chinese puts the unit after the number; English
      // uses the ISO 4217 symbol in front.
      return language === 'zh-TW' ? `${numeric}元` : `NT$ ${numeric}`;
    case 'ZAR':
      // The rand symbol is identical in both languages.
      return `R${numeric}`;
    default: {
      // Exhaustiveness check — a new currency is a compile error here
      // rather than a silent "undefined" on a live card.
      const _exhaustive: never = currency;
      void _exhaustive;
      return INVALID_VALUE;
    }
  }
}

/**
 * Render a tier percentage.
 *
 * @param percent — the percentage. A non-finite value renders as '—'.
 */
export function formatTierPercent(percent: number): string {
  if (!Number.isFinite(percent)) return INVALID_VALUE;
  return `${formatAmountNumber(percent)}%`;
}

/**
 * Map the template's persisted tier shape onto the resolver's shape.
 *
 * Rows with a non-finite threshold or percentage are DROPPED rather
 * than repaired: a corrupt row must not become a tier that silently
 * claims the holder reached it (or never will). Dropping it degrades
 * to a shorter ladder, which is the safe direction.
 *
 * @param tiers — the template's `settings.discountTiers`, possibly absent.
 */
export function normalizeDiscountTiers(
  tiers: readonly DiscountTierSetting[] | null | undefined,
): SpendTierRule[] {
  if (!Array.isArray(tiers)) return [];

  const normalized: SpendTierRule[] = [];
  for (const tier of tiers) {
    if (!tier || typeof tier !== 'object') continue;
    if (!Number.isFinite(tier.thresholdSpend)) continue;
    if (!Number.isFinite(tier.discountPercent)) continue;
    normalized.push({
      name: tier.name,
      thresholdSpend: tier.thresholdSpend,
      percent: tier.discountPercent,
    });
  }
  return normalized;
}

/**
 * Render a number with at most two decimals and no trailing zeros.
 *
 * `10` → `10`, `8.5` → `8.5`, `10.256` → `10.26`.
 */
function formatAmountNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  // `toString` drops the trailing zeros for us: 10.00 → '10'.
  return String(rounded);
}
