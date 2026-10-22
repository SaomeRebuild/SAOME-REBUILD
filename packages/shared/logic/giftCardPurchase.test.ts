/**
 * Gift-card purchase logic — test contract.
 *
 * @module shared/logic/giftCardPurchase.test
 *
 * Conformance tests pin the exchange-rate math + the two fences so the
 * public purchase page, the register API, and a future React Native app
 * all derive the same price from the same points. Drift here means a
 * customer sees one price and the backend charges another.
 */

import { describe, it, expect } from 'vitest';
import {
  pointsToAmount,
  buildGiftCardSnapshot,
  validateGiftCardPurchase,
} from './giftCardPurchase';
import type { PublicGiftCardConfig } from '../types/passHolder';

/** 1:1 rate, generous fence — the common default. */
const CONFIG_1_1: PublicGiftCardConfig = {
  unitAmount: 1,
  unitPoints: 1,
  checkoutMinPoints: 100,
  checkoutMaxPoints: 10_000,
  checkoutMinAmount: 100,
  checkoutMaxAmount: 10_000,
};

/** 100 元 = 10 點 (i.e. 1 元 = 0.1 點). */
const CONFIG_AMOUNT_100_POINTS_10: PublicGiftCardConfig = {
  unitAmount: 100,
  unitPoints: 10,
  checkoutMinPoints: 100,
  checkoutMaxPoints: 10_000,
  checkoutMinAmount: 100,
  checkoutMaxAmount: 10_000,
};

describe('pointsToAmount', () => {
  it('converts points to amount on a 1:1 rate', () => {
    expect(pointsToAmount(500, CONFIG_1_1)).toBe(500);
  });

  it('converts points on a 100元 = 10點 rate', () => {
    // 500 點 / 10 點 per unit = 50 units × 100 元 = 5000 元
    expect(pointsToAmount(500, CONFIG_AMOUNT_100_POINTS_10)).toBe(5000);
  });

  it('returns null when points are NOT divisible by unitPoints', () => {
    // 505 / 10 = 50.5 units → 5050 元 is fine, but 505 % 10 = 5 ≠ 0
    expect(pointsToAmount(505, CONFIG_AMOUNT_100_POINTS_10)).toBeNull();
  });

  it('returns null for non-integer / non-positive / non-finite points', () => {
    expect(pointsToAmount(0, CONFIG_1_1)).toBeNull();
    expect(pointsToAmount(-10, CONFIG_1_1)).toBeNull();
    expect(pointsToAmount(10.5, CONFIG_1_1)).toBeNull();
    expect(pointsToAmount(Number.NaN, CONFIG_1_1)).toBeNull();
    expect(pointsToAmount(Number.POSITIVE_INFINITY, CONFIG_1_1)).toBeNull();
  });

  it('returns null when the config carries a non-positive unit (corrupt row)', () => {
    const corrupt: PublicGiftCardConfig = {
      ...CONFIG_1_1,
      unitPoints: 0,
    };
    expect(pointsToAmount(100, corrupt)).toBeNull();
  });

  it('returns null when unitAmount is non-integer (corrupt row, never rounds)', () => {
    // templateSettingsSchema already pins unitAmount to `.int()`. If a
    // corrupt row ever slips a fractional rate past it, the only safe
    // answer is "cannot price" — rounding would silently charge the
    // customer an amount they never agreed to.
    const fractional: PublicGiftCardConfig = {
      ...CONFIG_1_1,
      unitAmount: 3.5,
    };
    expect(pointsToAmount(4, fractional)).toBeNull();
  });
});

describe('validateGiftCardPurchase', () => {
  it('accepts a points value inside both fences', () => {
    expect(validateGiftCardPurchase(500, CONFIG_1_1)).toEqual({ ok: true });
  });

  it('rejects points below checkoutMinPoints with an i18n key', () => {
    const result = validateGiftCardPurchase(50, CONFIG_1_1);
    expect(result).toEqual({
      ok: false,
      code: 'pointsBelowMin',
      message: 'passHolder.validation.pointsBelowMin',
    });
  });

  it('rejects points above checkoutMaxPoints with an i18n key', () => {
    const result = validateGiftCardPurchase(20_000, CONFIG_1_1);
    expect(result).toEqual({
      ok: false,
      code: 'pointsAboveMax',
      message: 'passHolder.validation.pointsAboveMax',
    });
  });

  it('accepts the exact fence boundaries', () => {
    expect(validateGiftCardPurchase(100, CONFIG_1_1)).toEqual({ ok: true });
    expect(validateGiftCardPurchase(10_000, CONFIG_1_1)).toEqual({ ok: true });
  });

  it('rejects points that are not divisible by unitPoints', () => {
    const result = validateGiftCardPurchase(505, CONFIG_AMOUNT_100_POINTS_10);
    expect(result).toEqual({
      ok: false,
      code: 'pointsNotMultipleOfRate',
      message: 'passHolder.validation.pointsNotMultipleOfRate',
    });
  });

  it('checks the fence BEFORE divisibility so the user sees the bound first', () => {
    // 5 點 is below the 100-point minimum AND not divisible — the
    // "too few points" message is the actionable one.
    const result = validateGiftCardPurchase(5, CONFIG_AMOUNT_100_POINTS_10);
    expect(result).toEqual({
      ok: false,
      code: 'pointsBelowMin',
      message: 'passHolder.validation.pointsBelowMin',
    });
  });

  it('rejects a non-positive / non-integer points value', () => {
    expect(validateGiftCardPurchase(0, CONFIG_1_1)).toEqual({
      ok: false,
      code: 'pointsInvalid',
      message: 'passHolder.validation.pointsInvalid',
    });
    expect(validateGiftCardPurchase(10.5, CONFIG_1_1)).toEqual({
      ok: false,
      code: 'pointsInvalid',
      message: 'passHolder.validation.pointsInvalid',
    });
  });

  it('rejects when the config fence is inverted (min > max) — corrupt row', () => {
    const corrupt: PublicGiftCardConfig = {
      ...CONFIG_1_1,
      checkoutMinPoints: 1_000,
      checkoutMaxPoints: 100,
    };
    const result = validateGiftCardPurchase(500, corrupt);
    expect(result.ok).toBe(false);
  });
});

describe('buildGiftCardSnapshot', () => {
  it('freezes the rate + fences + derived amount at purchase time', () => {
    const snapshot = buildGiftCardSnapshot(500, CONFIG_1_1, 'TWD');
    expect(snapshot).toEqual({
      points: 500,
      amount: 500,
      currency: 'TWD',
      unitAmount: 1,
      unitPoints: 1,
      checkoutMinPoints: 100,
      checkoutMaxPoints: 10_000,
    });
  });

  it('derives the amount from the frozen rate, not from a caller-supplied value', () => {
    const snapshot = buildGiftCardSnapshot(
      500,
      CONFIG_AMOUNT_100_POINTS_10,
      'ZAR',
    );
    expect(snapshot.amount).toBe(5000);
    expect(snapshot.currency).toBe('ZAR');
  });

  it('throws when the purchase is invalid (callers must validate first)', () => {
    expect(() => buildGiftCardSnapshot(5, CONFIG_1_1, 'TWD')).toThrow();
    expect(() =>
      buildGiftCardSnapshot(505, CONFIG_AMOUNT_100_POINTS_10, 'TWD'),
    ).toThrow();
  });

  it('produces a snapshot whose amount is re-derivable from its own frozen rate', () => {
    // Self-consistency contract: the DB row carries the rate, so a
    // receipt rendered months later can recompute the price without
    // reading the (possibly since-edited) template.
    const snapshot = buildGiftCardSnapshot(
      1_000,
      CONFIG_AMOUNT_100_POINTS_10,
      'TWD',
    );
    const recomputed =
      (snapshot.points / snapshot.unitPoints) * snapshot.unitAmount;
    expect(recomputed).toBe(snapshot.amount);
  });
});