/**
 * Discount card preview amounts — Vitest conformance tests
 *
 * Pins the discount preview demo values contract. Mirrors
 * `cashbackPreviewAmounts.test.ts` (2026-09-12).
 *
 * Coverage:
 *   1. The demo values are plain NUMBERS (not pre-formatted strings)
 *   2. Field key exhaustiveness
 *
 * 2026-10-27: the values became NUMBERS. The display string is now
 * produced by `formatTierAmount`
 * (`packages/shared/logic/spendTier.ts`) — the SAME shared function the
 * backend uses to build the Wallet payload. The currency / language
 * exhaustiveness guards moved there, where the currency actually
 * matters.
 *
 * @see packages/shared/constants/discountPreviewAmounts.ts
 * @see packages/shared/logic/spendTier.ts — formatTierAmount
 */

import { describe, expect, it } from 'vitest';
import { DISCOUNT_PREVIEW_AMOUNTS } from './discountPreviewAmounts';
import { formatTierAmount } from '../logic/spendTier';

describe('DISCOUNT_PREVIEW_AMOUNTS — demo values are numbers', () => {
  it('exposes the two discount amount fields as plain numbers', () => {
    expect(typeof DISCOUNT_PREVIEW_AMOUNTS.pointsToNextTierDiscount).toBe('number');
    expect(typeof DISCOUNT_PREVIEW_AMOUNTS.accumulatedSpendDiscount).toBe('number');
    expect(DISCOUNT_PREVIEW_AMOUNTS.pointsToNextTierDiscount).toBe(234);
    expect(DISCOUNT_PREVIEW_AMOUNTS.accumulatedSpendDiscount).toBe(556);
  });

  it('field key set is exactly {pointsToNextTierDiscount, accumulatedSpendDiscount}', () => {
    expect(Object.keys(DISCOUNT_PREVIEW_AMOUNTS).sort()).toEqual([
      'accumulatedSpendDiscount',
      'pointsToNextTierDiscount',
    ]);
  });
});

describe('DISCOUNT_PREVIEW_AMOUNTS — rendered through the shared tier formatter', () => {
  /**
   * The preview must show EXACTLY what the Wallet shows. The Wallet
   * formats the same numbers with the same `formatTierAmount`, so
   * these assertions pin the preview↔Wallet agreement.
   */
  it('renders the same strings the Wallet payload carries', () => {
    const { pointsToNextTierDiscount, accumulatedSpendDiscount } =
      DISCOUNT_PREVIEW_AMOUNTS;

    // zh-TW + TWD → Han unit suffix.
    expect(formatTierAmount(pointsToNextTierDiscount, 'TWD', 'zh-TW')).toBe('234元');
    expect(formatTierAmount(accumulatedSpendDiscount, 'TWD', 'zh-TW')).toBe('556元');

    // en + TWD → NT$ prefix.
    expect(formatTierAmount(pointsToNextTierDiscount, 'TWD', 'en')).toBe('NT$ 234');
    expect(formatTierAmount(accumulatedSpendDiscount, 'TWD', 'en')).toBe('NT$ 556');

    // ZAR → R prefix in both languages.
    expect(formatTierAmount(pointsToNextTierDiscount, 'ZAR', 'zh-TW')).toBe('R234');
    expect(formatTierAmount(accumulatedSpendDiscount, 'ZAR', 'en')).toBe('R556');
  });

  it('carries NO Han characters for the ZAR rendering (verify-i18n cross-check)', () => {
    // Critical: en translations cannot contain Han characters per
    // Rule 023 § 翻譯書寫紀律. If a future edit accidentally introduces
    // a Han character into a ZAR rendering, this test catches it
    // before the i18n smoke test (which runs at a different layer).
    const hanRegex = /[一-鿿㐀-䶿]/;
    const zars = [
      formatTierAmount(DISCOUNT_PREVIEW_AMOUNTS.pointsToNextTierDiscount, 'ZAR', 'zh-TW'),
      formatTierAmount(DISCOUNT_PREVIEW_AMOUNTS.accumulatedSpendDiscount, 'ZAR', 'en'),
    ];
    zars.forEach((value) => {
      expect(value).not.toMatch(hanRegex);
    });
  });
});
