/**
 * Cashback preview amounts — Vitest conformance tests
 *
 * Pins the currency-driven display contract for cashback-only display
 * fields. Mirrors the (no-test) `BALANCE_PREVIEW_AMOUNTS` pattern but
 * adds explicit conformance assertions so future currency additions
 * cannot silently drift.
 *
 * Coverage:
 *   1. Currency key exhaustiveness (record shape = Record<Currency, ...>)
 *   2. TWD values match the legacy i18n strings (regression for migration
 *      from `passCard.zh-TW.ts::fieldPreview.{pointsToNextTierCashback,
 *      accumulatedSpendCashback}.value`)
 *   3. ZAR values are R-prefixed (no Han characters; en-locale-safe)
 *   4. No TWD Han-character ('元') leaks into ZAR (cross-currency isolation)
 *   5. Field key exhaustiveness (record shape per-currency)
 *
 * @see packages/shared/constants/cashbackPreviewAmounts.ts
 * @see packages/shared/schemas/card.ts (Currency schema: 'TWD' | 'ZAR')
 */

import { describe, expect, it } from 'vitest';
import { CASHBACK_PREVIEW_AMOUNTS } from './cashbackPreviewAmounts';

describe('CASHBACK_PREVIEW_AMOUNTS — currency key exhaustiveness', () => {
  it('exports both TWD and ZAR keys', () => {
    expect(Object.keys(CASHBACK_PREVIEW_AMOUNTS).sort()).toEqual(['TWD', 'ZAR']);
  });

  it('does NOT export any unexpected currency keys (e.g. USD, EUR)', () => {
    // If a new currency is added to the Currency schema, this test breaks
    // UNTIL the constant is updated. Combined with the exhaustive
    // `Record<Currency, ...>` type signature, TypeScript itself will
    // reject an unhandled currency at compile time.
    const keys = Object.keys(CASHBACK_PREVIEW_AMOUNTS);
    expect(keys.every((k) => k === 'TWD' || k === 'ZAR')).toBe(true);
  });
});

describe('CASHBACK_PREVIEW_AMOUNTS — TWD values', () => {
  it('pointsToNextTierCashback = "562元" (legacy i18n string preserved)', () => {
    expect(CASHBACK_PREVIEW_AMOUNTS.TWD.pointsToNextTierCashback).toBe('562元');
  });

  it('accumulatedSpendCashback = "3301元" (legacy i18n string preserved)', () => {
    expect(CASHBACK_PREVIEW_AMOUNTS.TWD.accumulatedSpendCashback).toBe('3301元');
  });

  it('TWD values contain Han "元" suffix (locale-appropriate)', () => {
    expect(CASHBACK_PREVIEW_AMOUNTS.TWD.pointsToNextTierCashback).toContain('元');
    expect(CASHBACK_PREVIEW_AMOUNTS.TWD.accumulatedSpendCashback).toContain('元');
  });
});

describe('CASHBACK_PREVIEW_AMOUNTS — ZAR values', () => {
  it('pointsToNextTierCashback starts with "R" (en-locale-safe, no Han)', () => {
    expect(CASHBACK_PREVIEW_AMOUNTS.ZAR.pointsToNextTierCashback).toBe('R562');
  });

  it('accumulatedSpendCashback starts with "R" (en-locale-safe, no Han)', () => {
    expect(CASHBACK_PREVIEW_AMOUNTS.ZAR.accumulatedSpendCashback).toBe('R3301');
  });

  it('ZAR values contain NO Han characters (verify-i18n cross-check)', () => {
    // Critical: en translations cannot contain Han characters per
    // Rule 023 § 翻譯書寫紀律. If a future edit accidentally introduces
    // a Han character into ZAR values, this test catches it before
    // the i18n smoke test (which runs at a different layer).
    const zars = [
      CASHBACK_PREVIEW_AMOUNTS.ZAR.pointsToNextTierCashback,
      CASHBACK_PREVIEW_AMOUNTS.ZAR.accumulatedSpendCashback,
    ];
    const hanRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/;
    zars.forEach((value) => {
      expect(value).not.toMatch(hanRegex);
    });
  });
});

describe('CASHBACK_PREVIEW_AMOUNTS — per-currency field key exhaustiveness', () => {
  /**
   * Both TWD and ZAR must expose exactly the same field keys. If a new
   * cashback field is added to the schema, both currency variants must
   * be updated in lock-step — this test catches asymmetric additions.
   */
  it('TWD and ZAR expose identical field key sets', () => {
    expect(Object.keys(CASHBACK_PREVIEW_AMOUNTS.TWD).sort()).toEqual(
      Object.keys(CASHBACK_PREVIEW_AMOUNTS.ZAR).sort(),
    );
  });

  it('field key set is exactly {pointsToNextTierCashback, accumulatedSpendCashback}', () => {
    const expectedKeys = ['accumulatedSpendCashback', 'pointsToNextTierCashback'];
    expect(Object.keys(CASHBACK_PREVIEW_AMOUNTS.TWD).sort()).toEqual(expectedKeys);
    expect(Object.keys(CASHBACK_PREVIEW_AMOUNTS.ZAR).sort()).toEqual(expectedKeys);
  });
});
