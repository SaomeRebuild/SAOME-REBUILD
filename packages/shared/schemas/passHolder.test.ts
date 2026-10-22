/**
 * Pass-holder zod schemas — test contract.
 *
 * @module shared/schemas/passHolder.test
 *
 * The backend register path and the frontend purchase form both import
 * this file. Drift here means one side accepts a purchase the other
 * rejects (Rule 019 § 1).
 */

import { describe, it, expect } from 'vitest';
import {
  giftCardPurchaseInputSchema,
  giftCardSnapshotSchema,
  withGiftCardFences,
} from './passHolder';
import type { PublicGiftCardConfig } from '../types/passHolder';

const CONFIG: PublicGiftCardConfig = {
  unitAmount: 1,
  unitPoints: 1,
  checkoutMinPoints: 100,
  checkoutMaxPoints: 10_000,
  checkoutMinAmount: 100,
  checkoutMaxAmount: 10_000,
};

const CONFIG_100_PER_10: PublicGiftCardConfig = {
  unitAmount: 100,
  unitPoints: 10,
  checkoutMinPoints: 100,
  checkoutMaxPoints: 10_000,
  checkoutMinAmount: 100,
  checkoutMaxAmount: 10_000,
};

describe('giftCardPurchaseInputSchema', () => {
  it('accepts a positive integer points value', () => {
    expect(giftCardPurchaseInputSchema.parse({ points: 500 })).toEqual({
      points: 500,
    });
  });

  it('rejects zero / negative / fractional points with an i18n key', () => {
    for (const points of [0, -1, 10.5, Number.NaN]) {
      const result = giftCardPurchaseInputSchema.safeParse({ points });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'passHolder.validation.pointsInvalid',
        );
      }
    }
  });

  it('rejects a string points value (no coercion)', () => {
    const result = giftCardPurchaseInputSchema.safeParse({ points: '500' });
    expect(result.success).toBe(false);
  });
});

describe('withGiftCardFences', () => {
  it('accepts a points value inside the fences', () => {
    expect(withGiftCardFences(CONFIG).parse({ points: 500 })).toEqual({
      points: 500,
    });
  });

  it('rejects points below the checkout minimum', () => {
    const result = withGiftCardFences(CONFIG).safeParse({ points: 50 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'passHolder.validation.pointsBelowMin',
      );
      expect(result.error.issues[0].path).toEqual(['points']);
    }
  });

  it('rejects points above the checkout maximum', () => {
    const result = withGiftCardFences(CONFIG).safeParse({ points: 20_000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'passHolder.validation.pointsAboveMax',
      );
    }
  });

  it('rejects points that cannot be priced by the rate', () => {
    const result = withGiftCardFences(CONFIG_100_PER_10).safeParse({
      points: 505,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'passHolder.validation.pointsNotMultipleOfRate',
      );
    }
  });

  it('reports the same i18n keys as the shared logic module', () => {
    // Conformance: the zod wrapper must not translate or reword the
    // keys that `validateGiftCardPurchase` produces.
    const result = withGiftCardFences(CONFIG).safeParse({ points: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain(
        'passHolder.validation.pointsBelowMin',
      );
    }
  });
});

describe('giftCardSnapshotSchema', () => {
  const VALID = {
    points: 500,
    amount: 5000,
    currency: 'TWD',
    unitAmount: 100,
    unitPoints: 10,
    checkoutMinPoints: 100,
    checkoutMaxPoints: 10_000,
  };

  it('accepts a well-formed snapshot', () => {
    expect(giftCardSnapshotSchema.parse(VALID)).toEqual(VALID);
  });

  it('accepts ZAR snapshots', () => {
    expect(
      giftCardSnapshotSchema.parse({ ...VALID, currency: 'ZAR' }).currency,
    ).toBe('ZAR');
  });

  it('rejects an unknown currency (mirrors currencySchema enum)', () => {
    const result = giftCardSnapshotSchema.safeParse({
      ...VALID,
      currency: 'USD',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive unitPoints / unitAmount', () => {
    expect(
      giftCardSnapshotSchema.safeParse({ ...VALID, unitPoints: 0 }).success,
    ).toBe(false);
    expect(
      giftCardSnapshotSchema.safeParse({ ...VALID, unitAmount: -1 }).success,
    ).toBe(false);
  });

  it('rejects a missing field (the DB column must be self-contained)', () => {
    const { unitPoints: _dropped, ...partial } = VALID;
    expect(giftCardSnapshotSchema.safeParse(partial).success).toBe(false);
  });
});