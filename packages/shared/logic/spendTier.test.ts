/**
 * Spend tier resolution + amount formatting — test contract.
 *
 * @module shared/logic/spendTier.test
 *
 * Pins two independent contracts:
 *
 *  1. `resolveSpendTier` — which tier a holder is in and how much more
 *     they must spend to reach the next one. The algorithm mirrors the
 *     legacy WordPress plugin's `saome_pe_discount_resolve_tier`, so a
 *     card issued by the old system and a card issued by this one
 *     resolve the same tier for the same spend.
 *
 *  2. `formatTierAmount` / `formatTierPercent` — the "number + unit"
 *     strings the Wallet shows. The unit placement depends on the
 *     TEMPLATE's language (not the reader's locale): an English
 *     discount card shows `NT$ 10`, a Traditional Chinese one shows
 *     `10元`, and a South African one always shows `R10`.
 *
 * Rule references:
 *   - Rule 023 § Shared Package 邊界 — pure functions, no I/O, no
 *     framework imports, so React Native gets them for free.
 *   - Rule 024 § Mobile Future-Proof — no platform API used.
 */

import { describe, it, expect } from 'vitest';
import {
  formatTierAmount,
  formatTierPercent,
  normalizeDiscountTiers,
  resolveSpendTier,
  type SpendTierRule,
} from './spendTier';
import type { Currency } from '../schemas/card';
import type { PassLanguage } from '../i18n/fieldLabels';

/** Two-tier ladder: a free base tier plus a paid tier at spend 10. */
const LADDER: SpendTierRule[] = [
  { name: 'basic', thresholdSpend: 0, percent: 1 },
  { name: 'premium', thresholdSpend: 10, percent: 5 },
];

/** Three-tier ladder for the "already at the top" case. */
const LADDER_THREE: SpendTierRule[] = [
  { name: 'basic', thresholdSpend: 0, percent: 1 },
  { name: 'silver', thresholdSpend: 10, percent: 3 },
  { name: 'gold', thresholdSpend: 20, percent: 8 },
];

describe('resolveSpendTier', () => {
  it('returns null when the template has no tiers', () => {
    expect(resolveSpendTier([], 0)).toBeNull();
  });

  it('resolves the first tier at zero spend and reports the gap to the second', () => {
    const resolved = resolveSpendTier(LADDER, 0);
    expect(resolved?.current.name).toBe('basic');
    expect(resolved?.current.percent).toBe(1);
    expect(resolved?.next?.name).toBe('premium');
    expect(resolved?.spendToNext).toBe(10);
  });

  it('shrinks the gap as spend accumulates', () => {
    expect(resolveSpendTier(LADDER, 2)?.spendToNext).toBe(8);
    expect(resolveSpendTier(LADDER, 7)?.spendToNext).toBe(3);
  });

  it('promotes the holder when a threshold is reached', () => {
    const resolved = resolveSpendTier(LADDER, 10);
    expect(resolved?.current.name).toBe('premium');
    expect(resolved?.current.percent).toBe(5);
    expect(resolved?.next).toBeNull();
    expect(resolved?.spendToNext).toBe(0);
  });

  it('reports the next tier while one is still ahead', () => {
    const resolved = resolveSpendTier(LADDER_THREE, 15);
    expect(resolved?.current.name).toBe('silver');
    expect(resolved?.next?.name).toBe('gold');
    expect(resolved?.spendToNext).toBe(5);
  });

  it('reports no next tier once the top tier is reached', () => {
    const resolved = resolveSpendTier(LADDER_THREE, 25);
    expect(resolved?.current.name).toBe('gold');
    expect(resolved?.next).toBeNull();
    expect(resolved?.spendToNext).toBe(0);
  });

  it('sorts unsorted rules before resolving', () => {
    const unsorted: SpendTierRule[] = [
      { name: 'premium', thresholdSpend: 10, percent: 5 },
      { name: 'basic', thresholdSpend: 0, percent: 1 },
    ];
    const resolved = resolveSpendTier(unsorted, 0);
    expect(resolved?.current.name).toBe('basic');
    expect(resolved?.next?.name).toBe('premium');
    expect(resolved?.spendToNext).toBe(10);
  });

  it('falls back to the lowest tier when even the first threshold is unmet', () => {
    const strict: SpendTierRule[] = [
      { name: 'bronze', thresholdSpend: 5, percent: 1 },
      { name: 'silver', thresholdSpend: 10, percent: 3 },
    ];
    const resolved = resolveSpendTier(strict, 0);
    expect(resolved?.current.name).toBe('bronze');
    expect(resolved?.spendToNext).toBe(5);
  });

  it('treats a non-finite spend as zero', () => {
    expect(resolveSpendTier(LADDER, Number.NaN)?.spendToNext).toBe(10);
    expect(resolveSpendTier(LADDER, Number.POSITIVE_INFINITY)?.current.name).toBe('premium');
  });

  it('never reports a negative gap', () => {
    expect(resolveSpendTier(LADDER, 10)?.spendToNext).toBe(0);
    expect(resolveSpendTier(LADDER_THREE, 99)?.spendToNext).toBe(0);
  });
});

describe('formatTierAmount', () => {
  it('suffixes TWD with the Han unit in Traditional Chinese', () => {
    expect(formatTierAmount(10, 'TWD', 'zh-TW')).toBe('10元');
  });

  it('prefixes TWD with NT$ in English', () => {
    expect(formatTierAmount(10, 'TWD', 'en')).toBe('NT$ 10');
  });

  it('always prefixes ZAR with R, in both languages', () => {
    expect(formatTierAmount(10, 'ZAR', 'zh-TW')).toBe('R10');
    expect(formatTierAmount(10, 'ZAR', 'en')).toBe('R10');
  });

  it('keeps a fractional amount and drops trailing zeros', () => {
    expect(formatTierAmount(8.5, 'TWD', 'zh-TW')).toBe('8.5元');
    expect(formatTierAmount(10.25, 'TWD', 'en')).toBe('NT$ 10.25');
    expect(formatTierAmount(10, 'TWD', 'zh-TW')).toBe('10元');
  });

  it('rounds to two decimals, matching the legacy plugin', () => {
    expect(formatTierAmount(10.256, 'TWD', 'zh-TW')).toBe('10.26元');
  });

  it('returns a dash for a non-finite amount', () => {
    expect(formatTierAmount(Number.NaN, 'TWD', 'zh-TW')).toBe('—');
  });
});

describe('formatTierPercent', () => {
  it('renders a whole percent without a space', () => {
    expect(formatTierPercent(1)).toBe('1%');
    expect(formatTierPercent(35)).toBe('35%');
  });

  it('keeps a fractional percent', () => {
    expect(formatTierPercent(2.5)).toBe('2.5%');
  });

  it('returns a dash for a non-finite percent', () => {
    expect(formatTierPercent(Number.NaN)).toBe('—');
  });
});

describe('normalizeDiscountTiers', () => {
  it('maps the template schema shape onto the resolver shape', () => {
    expect(
      normalizeDiscountTiers([
        { name: 'basic', thresholdSpend: 0, discountPercent: 1 },
        { name: 'premium', thresholdSpend: 10, discountPercent: 5 },
      ]),
    ).toEqual([
      { name: 'basic', thresholdSpend: 0, percent: 1 },
      { name: 'premium', thresholdSpend: 10, percent: 5 },
    ]);
  });

  it('returns an empty list for missing input', () => {
    expect(normalizeDiscountTiers(undefined)).toEqual([]);
    expect(normalizeDiscountTiers(null)).toEqual([]);
    expect(normalizeDiscountTiers([])).toEqual([]);
  });

  it('drops rows with unusable thresholds or percentages', () => {
    expect(
      normalizeDiscountTiers([
        { name: 'ok', thresholdSpend: 0, discountPercent: 1 },
        { name: 'bad-threshold', thresholdSpend: Number.NaN, discountPercent: 2 },
        { name: 'bad-percent', thresholdSpend: 5, discountPercent: Number.NaN },
      ]),
    ).toEqual([{ name: 'ok', thresholdSpend: 0, percent: 1 }]);
  });
});

/** Compile-time guard: the currency union is exhaustive. */
const _currencies: Currency[] = ['TWD', 'ZAR'];
const _languages: PassLanguage[] = ['zh-TW', 'en'];
void _currencies;
void _languages;
