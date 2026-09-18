/**
 * Discount card preview amounts — Vitest conformance tests
 *
 * Pins the currency-driven display contract for discount-only display
 * fields. Mirrors `cashbackPreviewAmounts.test.ts` (2026-09-12).
 *
 * Coverage:
 *   1. Currency key exhaustiveness (record shape = Record<Currency, ...>)
 *   2. TWD values match expected demo strings (234元 / 556元)
 *   3. ZAR values are R-prefixed (no Han characters; en-locale-safe)
 *   4. No TWD Han-character ('元') leaks into ZAR (cross-currency isolation)
 *   5. Field key exhaustiveness (record shape per-currency)
 *
 * @see packages/shared/constants/discountPreviewAmounts.ts
 * @see packages/shared/schemas/card.ts (Currency schema: 'TWD' | 'ZAR')
 */

import { describe, expect, it } from 'vitest';
import { DISCOUNT_PREVIEW_AMOUNTS } from './discountPreviewAmounts';

describe('DISCOUNT_PREVIEW_AMOUNTS — currency key exhaustiveness', () => {
  it('exports both TWD and ZAR keys', () => {
    expect(Object.keys(DISCOUNT_PREVIEW_AMOUNTS).sort()).toEqual(['TWD', 'ZAR']);
  });

  it('does NOT export any unexpected currency keys (e.g. USD, EUR)', () => {
    // If a new currency is added to the Currency schema, this test breaks
    // UNTIL the constant is updated. Combined with the exhaustive
    // `Record<Currency, ...>` type signature, TypeScript itself will
    // reject an unhandled currency at compile time.
    const keys = Object.keys(DISCOUNT_PREVIEW_AMOUNTS);
    expect(keys.every((k) => k === 'TWD' || k === 'ZAR')).toBe(true);
  });
});

describe('DISCOUNT_PREVIEW_AMOUNTS — TWD values', () => {
  it('pointsToNextTierDiscount = "234元" (demo string for the TWD card type)', () => {
    expect(DISCOUNT_PREVIEW_AMOUNTS.TWD.pointsToNextTierDiscount).toBe('234元');
  });

  it('accumulatedSpendDiscount = "556元" (demo string for the TWD card type)', () => {
    expect(DISCOUNT_PREVIEW_AMOUNTS.TWD.accumulatedSpendDiscount).toBe('556元');
  });

  it('TWD values contain Han "元" suffix (locale-appropriate)', () => {
    expect(DISCOUNT_PREVIEW_AMOUNTS.TWD.pointsToNextTierDiscount).toContain('元');
    expect(DISCOUNT_PREVIEW_AMOUNTS.TWD.accumulatedSpendDiscount).toContain('元');
  });
});

describe('DISCOUNT_PREVIEW_AMOUNTS — ZAR values', () => {
  it('pointsToNextTierDiscount starts with "R" (en-locale-safe, no Han)', () => {
    expect(DISCOUNT_PREVIEW_AMOUNTS.ZAR.pointsToNextTierDiscount).toBe('R234');
  });

  it('accumulatedSpendDiscount starts with "R" (en-locale-safe, no Han)', () => {
    expect(DISCOUNT_PREVIEW_AMOUNTS.ZAR.accumulatedSpendDiscount).toBe('R556');
  });

  it('ZAR values contain NO Han characters (verify-i18n cross-check)', () => {
    // Critical: en translations cannot contain Han characters per
    // Rule 023 § 翻譯書寫紀律. If a future edit accidentally introduces
    // a Han character into ZAR values, this test catches it before
    // the i18n smoke test (which runs at a different layer).
    const zars = [
      DISCOUNT_PREVIEW_AMOUNTS.ZAR.pointsToNextTierDiscount,
      DISCOUNT_PREVIEW_AMOUNTS.ZAR.accumulatedSpendDiscount,
    ];
    const hanRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/;
    zars.forEach((value) => {
      expect(value).not.toMatch(hanRegex);
    });
  });
});

describe('DISCOUNT_PREVIEW_AMOUNTS — per-currency field key exhaustiveness', () => {
  /**
   * Both TWD and ZAR must expose exactly the same field keys. If a new
   * discount field is added to the schema, both currency variants must
   * be updated in lock-step — this test catches asymmetric additions.
   */
  it('TWD and ZAR expose identical field key sets', () => {
    expect(Object.keys(DISCOUNT_PREVIEW_AMOUNTS.TWD).sort()).toEqual(
      Object.keys(DISCOUNT_PREVIEW_AMOUNTS.ZAR).sort(),
    );
  });

  it('field key set is exactly {pointsToNextTierDiscount, accumulatedSpendDiscount}', () => {
    const expectedKeys = ['accumulatedSpendDiscount', 'pointsToNextTierDiscount'];
    expect(Object.keys(DISCOUNT_PREVIEW_AMOUNTS.TWD).sort()).toEqual(expectedKeys);
    expect(Object.keys(DISCOUNT_PREVIEW_AMOUNTS.ZAR).sort()).toEqual(expectedKeys);
  });
});