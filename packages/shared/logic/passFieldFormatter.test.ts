/**
 * Pass field formatter — conformance tests.
 *
 * @module shared/logic/passFieldFormatter.test
 *
 * The properties pinned here:
 *
 *   1. Only BOUND keys are emitted (the template decides the slots).
 *   2. Numbers stay numbers — never currency strings.
 *   3. Gift points NEVER land in the balance slot (and vice versa).
 *   4. Dates use the Passcreator `Y-m-d H:i` format, UTC-anchored.
 *   5. All 8 card types produce a valid payload.
 */

import { describe, it, expect } from 'vitest';
import {
  FACE_FIELD_METRIC,
  formatPasscreatorDateTime,
  formatPassValues,
} from './passFieldFormatter';
import { cardTypeSchema, type CardType } from '../schemas/card';
import {
  emptyPassValuesMetrics,
  type PassValuesSnapshot,
} from '../schemas/passValues';

const ALL_CARD_TYPES: CardType[] = [...cardTypeSchema.options];

function snapshot(overrides: Partial<PassValuesSnapshot> = {}): PassValuesSnapshot {
  return {
    metrics: { ...emptyPassValuesMetrics(), ...(overrides.metrics ?? {}) },
    expiryDate: overrides.expiryDate ?? null,
  };
}

describe('formatPasscreatorDateTime', () => {
  it('formats a business date as Passcreator expects', () => {
    expect(formatPasscreatorDateTime('2027-10-23')).toBe('2027-10-23 00:00');
  });

  it('returns null for a missing / malformed date', () => {
    expect(formatPasscreatorDateTime(null)).toBeNull();
    expect(formatPasscreatorDateTime(undefined)).toBeNull();
    expect(formatPasscreatorDateTime('')).toBeNull();
    expect(formatPasscreatorDateTime('not-a-date')).toBeNull();
    expect(formatPasscreatorDateTime('2027/10/23')).toBeNull();
  });

  it('rejects a calendar date that does not exist', () => {
    expect(formatPasscreatorDateTime('2026-02-30')).toBeNull();
    expect(formatPasscreatorDateTime('2025-02-29')).toBeNull();
  });
});

describe('formatPassValues — all 8 card types', () => {
  it.each(ALL_CARD_TYPES)('cardType=%s produces a valid payload', (cardType) => {
    const result = formatPassValues({
      cardType,
      snapshot: snapshot({ expiryDate: '2027-10-23' }),
      boundFieldKeys: [],
    });
    expect(result.properties).toBeTypeOf('object');
    // Every payload has exactly one header property.
    expect(Object.keys(result.properties)).toHaveLength(1);
  });

  it('a null card type produces an EMPTY payload (no guessed slot)', () => {
    const result = formatPassValues({
      cardType: null,
      snapshot: snapshot({ metrics: { ...emptyPassValuesMetrics(), giftPoints: 500 } }),
      boundFieldKeys: ['visitCount'],
    });
    expect(result.properties).toEqual({});
    expect(result.storedValue).toBeUndefined();
    expect(result.expirationDate).toBeUndefined();
  });
});

describe('formatPassValues — header slot binding', () => {
  it('gift_card binds `giftPoints`', () => {
    const result = formatPassValues({
      cardType: 'gift_card',
      snapshot: snapshot({ metrics: { ...emptyPassValuesMetrics(), giftPoints: 500 } }),
      boundFieldKeys: [],
    });
    expect(result.properties).toEqual({ giftPoints: 500 });
  });

  it('the balance cards bind `balance`', () => {
    for (const cardType of ['stamp_card', 'reward_card', 'cashback_card', 'multipass'] as const) {
      const result = formatPassValues({
        cardType,
        snapshot: snapshot(),
        boundFieldKeys: [],
      });
      expect(Object.keys(result.properties), cardType).toEqual(['balance']);
    }
  });

  it('membership_card binds `memberExpiry`', () => {
    const result = formatPassValues({
      cardType: 'membership_card',
      snapshot: snapshot({ expiryDate: '2027-10-23' }),
      boundFieldKeys: [],
    });
    expect(result.properties).toEqual({ memberExpiry: '2027-10-23 00:00' });
  });

  it('discount_card binds `discountExpiry`', () => {
    const result = formatPassValues({
      cardType: 'discount_card',
      snapshot: snapshot({ expiryDate: '2027-10-23' }),
      boundFieldKeys: [],
    });
    expect(result.properties).toEqual({ discountExpiry: '2027-10-23 00:00' });
  });

  it('coupon_card binds `couponExpiry`', () => {
    const result = formatPassValues({
      cardType: 'coupon_card',
      snapshot: snapshot({ expiryDate: '2027-10-23' }),
      boundFieldKeys: [],
    });
    expect(result.properties).toEqual({ couponExpiry: '2027-10-23 00:00' });
  });
});

describe('formatPassValues — gift points vs currency balance', () => {
  it('a gift card NEVER emits a `balance` property', () => {
    const result = formatPassValues({
      cardType: 'gift_card',
      snapshot: snapshot({
        metrics: {
          ...emptyPassValuesMetrics(),
          giftPoints: 500,
          pointsBalance: 999,
          spendAccumulated: 1234,
        },
      }),
      boundFieldKeys: [],
    });
    expect(result.properties).not.toHaveProperty('balance');
    expect(result.properties.giftPoints).toBe(500);
  });

  it('a balance card NEVER emits a `giftPoints` property', () => {
    for (const cardType of ['stamp_card', 'reward_card', 'cashback_card', 'multipass'] as const) {
      const result = formatPassValues({
        cardType,
        snapshot: snapshot({
          metrics: { ...emptyPassValuesMetrics(), giftPoints: 500 },
        }),
        boundFieldKeys: [],
      });
      expect(result.properties, cardType).not.toHaveProperty('giftPoints');
    }
  });

  it('a gift card NEVER emits a storedValue (points are not currency)', () => {
    const result = formatPassValues({
      cardType: 'gift_card',
      snapshot: snapshot({ metrics: { ...emptyPassValuesMetrics(), giftPoints: 500 } }),
      boundFieldKeys: [],
    });
    expect(result.storedValue).toBeUndefined();
  });

  it('the balance cards DO emit a storedValue equal to the balance property', () => {
    for (const cardType of ['stamp_card', 'reward_card', 'cashback_card', 'multipass'] as const) {
      const result = formatPassValues({
        cardType,
        snapshot: snapshot({
          metrics: { ...emptyPassValuesMetrics(), stampCount: 7, pointsBalance: 7, spendAccumulated: 7 },
        }),
        boundFieldKeys: [],
      });
      expect(result.storedValue, cardType).toBe(result.properties.balance);
    }
  });

  it('each balance card type reads ITS OWN metric (no cross-contamination)', () => {
    const metrics = {
      ...emptyPassValuesMetrics(),
      stampCount: 11,
      pointsBalance: 22,
      spendAccumulated: 33,
    };
    expect(
      formatPassValues({ cardType: 'stamp_card', snapshot: snapshot({ metrics }), boundFieldKeys: [] })
        .properties.balance,
    ).toBe(11);
    expect(
      formatPassValues({ cardType: 'reward_card', snapshot: snapshot({ metrics }), boundFieldKeys: [] })
        .properties.balance,
    ).toBe(22);
    expect(
      formatPassValues({ cardType: 'cashback_card', snapshot: snapshot({ metrics }), boundFieldKeys: [] })
        .properties.balance,
    ).toBe(33);
    expect(
      formatPassValues({ cardType: 'multipass', snapshot: snapshot({ metrics }), boundFieldKeys: [] })
        .properties.balance,
    ).toBe(11);
  });
});

describe('formatPassValues — only BOUND keys are emitted', () => {
  it('emits a bound runtime field', () => {
    const result = formatPassValues({
      cardType: 'stamp_card',
      snapshot: snapshot({ metrics: { ...emptyPassValuesMetrics(), visitCount: 3 } }),
      boundFieldKeys: ['visitCount'],
    });
    expect(result.properties.visitCount).toBe(3);
  });

  it('does NOT emit an UNBOUND field even when the snapshot has a value', () => {
    const result = formatPassValues({
      cardType: 'stamp_card',
      snapshot: snapshot({ metrics: { ...emptyPassValuesMetrics(), visitCount: 3 } }),
      boundFieldKeys: [],
    });
    expect(result.properties).not.toHaveProperty('visitCount');
  });

  it('does NOT emit an identity field (those ride along with the create call)', () => {
    const result = formatPassValues({
      cardType: 'membership_card',
      snapshot: snapshot({ expiryDate: '2027-10-23' }),
      boundFieldKeys: ['memberName', 'phone', 'email', 'birthday'],
    });
    expect(result.properties).not.toHaveProperty('memberName');
    expect(result.properties).not.toHaveProperty('phone');
    expect(result.properties).not.toHaveProperty('email');
    expect(result.properties).not.toHaveProperty('birthday');
  });

  it('does NOT emit a tier-derived field (it is not a runtime metric)', () => {
    const result = formatPassValues({
      cardType: 'reward_card',
      snapshot: snapshot(),
      boundFieldKeys: ['pointsToNextTier', 'discountTierBracket', 'couponRemainingCount'],
    });
    expect(result.properties).not.toHaveProperty('pointsToNextTier');
    expect(result.properties).not.toHaveProperty('discountTierBracket');
    expect(result.properties).not.toHaveProperty('couponRemainingCount');
  });

  it('skips null / undefined bound slots', () => {
    const result = formatPassValues({
      cardType: 'stamp_card',
      snapshot: snapshot({ metrics: { ...emptyPassValuesMetrics(), visitCount: 3 } }),
      boundFieldKeys: [null, 'visitCount', undefined],
    });
    expect(result.properties.visitCount).toBe(3);
    expect(Object.keys(result.properties)).toHaveLength(2); // balance + visitCount
  });

  it('FACE_FIELD_METRIC never maps to `giftPoints` (gift points are header-only)', () => {
    // A gift card's points belong in the header slot. If a face field
    // ever mapped to `giftPoints`, a template binding it would render
    // the prepaid balance in a random slot.
    expect(Object.values(FACE_FIELD_METRIC)).not.toContain('giftPoints');
  });
});

/**
 * The stamp-family face fields are NOT direct metric reads.
 *
 * Their labels promise a DERIVED quantity, and the derivation needs
 * inputs this formatter does not have:
 *
 *   - `totalStamps` (總印章數 / Total Stamps) — the card's grid
 *     CAPACITY (rows × stamps-per-row). It is a TEMPLATE constant:
 *     identical for every holder of that template. It is not the
 *     holder's collected count.
 *   - `stampsRemaining` (還差幾個章 / Stamps Remaining) — the count
 *     still needed to reach the reward. That is a function of the
 *     template's reward threshold (Step 6 `stampsPerVisitStamps` /
 *     `stampsPerSpendStamps`) and the accrual mode, not a plain
 *     difference against the grid capacity.
 *   - `availableRewards` (可用獎勵 / Available Rewards) — how many
 *     rewards are redeemable. The legacy plugin tracked this as a
 *     counter SEPARATE from the stamp progress, incremented when a
 *     reward threshold was crossed. Its rule is Scanner-phase
 *     business semantics (see the blocked Scanner plan).
 *   - `multipassCompleted` (累積已滿 / Cumulative Completed) — a
 *     tier-progress quantity, derived from the tier thresholds.
 *
 * Mapping them to the raw `stampCount` would put the COLLECTED count
 * into a slot that promises "how many more are needed" — the holder
 * would read "3 stamps remaining" when they actually have 3 of 10
 * collected. A wrong number on a live Wallet card is worse than an
 * unset slot, so these are deliberately NOT emitted.
 *
 * The header `balance` slot is unaffected: it reads `stampCount`
 * through `HEADER_BALANCE_METRIC` (a separate, exact mapping).
 */
describe('formatPassValues — template-derived stamp fields are NOT emitted', () => {
  const TEMPLATE_DERIVED_STAMP_FIELDS = [
    'totalStamps',
    'stampsRemaining',
    'availableRewards',
    'multipassCompleted',
  ] as const;

  it.each(TEMPLATE_DERIVED_STAMP_FIELDS)(
    '%s is absent from FACE_FIELD_METRIC',
    (fieldKey) => {
      expect(Object.keys(FACE_FIELD_METRIC)).not.toContain(fieldKey);
    },
  );

  it.each(TEMPLATE_DERIVED_STAMP_FIELDS)(
    'a bound %s slot is NOT emitted (no wrong number on the Wallet)',
    (fieldKey) => {
      const result = formatPassValues({
        cardType: 'stamp_card',
        snapshot: snapshot({
          metrics: { ...emptyPassValuesMetrics(), stampCount: 3 },
        }),
        boundFieldKeys: [fieldKey],
      });
      expect(result.properties).not.toHaveProperty(fieldKey);
      // The header balance is still emitted — the slot under test is
      // the only thing that must be absent.
      expect(result.properties.balance).toBe(3);
    },
  );

  it('the exact metric reads ARE still emitted', () => {
    // Guards against over-correcting: the four fields whose label IS
    // the metric keep working.
    //
    // 2026-10-27: `accumulatedSpendDiscount` moved OUT of this map —
    // the discount card shows a unit-carrying display string for it,
    // not a bare number. It is emitted by the discount branch of
    // `formatPassValues` instead (see the discount-card suite below).
    expect(Object.keys(FACE_FIELD_METRIC).sort()).toEqual([
      'accumulatedSpendCashback',
      'currentPoints',
      'visitCount',
    ]);
  });
});

describe('formatPassValues — value types', () => {
  it('numeric metrics are emitted as JSON numbers, not currency strings', () => {
    const result = formatPassValues({
      cardType: 'stamp_card',
      snapshot: snapshot({ metrics: { ...emptyPassValuesMetrics(), visitCount: 12 } }),
      boundFieldKeys: ['visitCount'],
    });
    expect(typeof result.properties.balance).toBe('number');
    expect(typeof result.properties.visitCount).toBe('number');
    expect(result.properties.visitCount).not.toContain('元');
    expect(result.properties.visitCount).not.toContain('R');
  });

  it('a fractional spendAccumulated stays a number', () => {
    const result = formatPassValues({
      cardType: 'cashback_card',
      snapshot: snapshot({
        metrics: { ...emptyPassValuesMetrics(), spendAccumulated: 199.99 },
      }),
      boundFieldKeys: ['accumulatedSpendCashback'],
    });
    expect(result.properties.balance).toBe(199.99);
    expect(result.properties.accumulatedSpendCashback).toBe(199.99);
  });

  it('omits expirationDate when the card never expires', () => {
    const result = formatPassValues({
      cardType: 'stamp_card',
      snapshot: snapshot({ expiryDate: null }),
      boundFieldKeys: [],
    });
    expect(result.expirationDate).toBeUndefined();
  });

  it('emits expirationDate whenever the snapshot carries an expiry', () => {
    const result = formatPassValues({
      cardType: 'stamp_card',
      snapshot: snapshot({ expiryDate: '2027-10-23' }),
      boundFieldKeys: [],
    });
    expect(result.expirationDate).toBe('2027-10-23 00:00');
  });

  it('writes the "∞" sentinel into the expiry header property when there is no expiry', () => {
    // 2026-10-26 (regression): the expiry property must NOT be
    // omitted. A PATCH omits = "keep the upstream value", so
    // omitting would leave a stale date on the holder's Wallet
    // forever. The `∞` sentinel is the only way to clear it.
    const result = formatPassValues({
      cardType: 'membership_card',
      snapshot: snapshot({ expiryDate: null }),
      boundFieldKeys: [],
    });
    expect(result.properties.memberExpiry).toBe('∞');
    // The PASS-level expiry stays omitted — "no pass expiry" is a
    // different concept from "no expiry in the header slot".
    expect(result.expirationDate).toBeUndefined();
  });

  it('writes the "∞" sentinel for the discount + coupon expiry slots too', () => {
    const discount = formatPassValues({
      cardType: 'discount_card',
      snapshot: snapshot({ expiryDate: null }),
      boundFieldKeys: [],
    });
    expect(discount.properties.discountExpiry).toBe('∞');
    expect(discount.expirationDate).toBeUndefined();

    const coupon = formatPassValues({
      cardType: 'coupon_card',
      snapshot: snapshot({ expiryDate: null }),
      boundFieldKeys: [],
    });
    expect(coupon.properties.couponExpiry).toBe('∞');
    expect(coupon.expirationDate).toBeUndefined();
  });

  it('still writes the formatted date (NOT the sentinel) when there IS an expiry', () => {
    const result = formatPassValues({
      cardType: 'membership_card',
      snapshot: snapshot({ expiryDate: '2027-10-23' }),
      boundFieldKeys: [],
    });
    expect(result.properties.memberExpiry).toBe('2027-10-23 00:00');
  });
});

/**
 * Discount card face fields (2026-10-27).
 *
 * The discount card's four display slots show DERIVED values that
 * carry a unit. Before this change they were never sent at all —
 * `memberLevel`, `discountTierBracket` and `pointsToNextTierDiscount`
 * were absent from `FACE_FIELD_METRIC`, and `accumulatedSpendDiscount`
 * was sent as a bare number that no unit-bearing slot could display.
 */
describe('formatPassValues — discount card face fields', () => {
  /** A resolved two-tier ladder: base tier now, premium tier at 10. */
  const TIER = {
    current: { name: '基本', thresholdSpend: 0, percent: 1 },
    next: { name: '進階', thresholdSpend: 10, percent: 5 },
    spendToNext: 10,
  };

  it('emits all four slots as display strings', () => {
    const result = formatPassValues({
      cardType: 'discount_card',
      snapshot: snapshot({ metrics: { ...emptyPassValuesMetrics(), spendAccumulated: 0 } }),
      boundFieldKeys: [
        'memberLevel',
        'discountTierBracket',
        'pointsToNextTierDiscount',
        'accumulatedSpendDiscount',
      ],
      discountTier: TIER,
      currency: 'TWD',
      language: 'zh-TW',
    });

    expect(result.properties.memberLevel).toBe('基本');
    expect(result.properties.discountTierBracket).toBe('1%');
    expect(result.properties.pointsToNextTierDiscount).toBe('10元');
    expect(result.properties.accumulatedSpendDiscount).toBe('0元');
  });

  it('places the TWD unit by the template language', () => {
    const zh = formatPassValues({
      cardType: 'discount_card',
      snapshot: snapshot(),
      boundFieldKeys: ['pointsToNextTierDiscount'],
      discountTier: TIER,
      currency: 'TWD',
      language: 'zh-TW',
    });
    expect(zh.properties.pointsToNextTierDiscount).toBe('10元');

    const en = formatPassValues({
      cardType: 'discount_card',
      snapshot: snapshot(),
      boundFieldKeys: ['pointsToNextTierDiscount'],
      discountTier: TIER,
      currency: 'TWD',
      language: 'en',
    });
    expect(en.properties.pointsToNextTierDiscount).toBe('NT$ 10');
  });

  it('uses the R prefix for ZAR in both languages', () => {
    for (const language of ['zh-TW', 'en'] as const) {
      const result = formatPassValues({
        cardType: 'discount_card',
        snapshot: snapshot(),
        boundFieldKeys: ['pointsToNextTierDiscount', 'accumulatedSpendDiscount'],
        discountTier: TIER,
        currency: 'ZAR',
        language,
      });
      expect(result.properties.pointsToNextTierDiscount).toBe('R10');
      expect(result.properties.accumulatedSpendDiscount).toBe('R0');
    }
  });

  it('does NOT emit an unbound slot', () => {
    const result = formatPassValues({
      cardType: 'discount_card',
      snapshot: snapshot(),
      boundFieldKeys: ['memberLevel'],
      discountTier: TIER,
      currency: 'TWD',
      language: 'zh-TW',
    });
    expect(result.properties.memberLevel).toBe('基本');
    expect(result.properties).not.toHaveProperty('pointsToNextTierDiscount');
    expect(result.properties).not.toHaveProperty('accumulatedSpendDiscount');
  });

  it('does NOT emit any discount slot when no tier was resolved', () => {
    // A wrong number on a live Wallet card is worse than an unset
    // slot — an unresolvable tier must leave the slots empty.
    const result = formatPassValues({
      cardType: 'discount_card',
      snapshot: snapshot(),
      boundFieldKeys: [
        'memberLevel',
        'discountTierBracket',
        'pointsToNextTierDiscount',
        'accumulatedSpendDiscount',
      ],
      discountTier: null,
      currency: 'TWD',
      language: 'zh-TW',
    });
    expect(result.properties).not.toHaveProperty('memberLevel');
    expect(result.properties).not.toHaveProperty('discountTierBracket');
    expect(result.properties).not.toHaveProperty('pointsToNextTierDiscount');
    expect(result.properties).not.toHaveProperty('accumulatedSpendDiscount');
  });

  it('does NOT affect a non-discount card that binds memberLevel', () => {
    // The membership card's memberLevel slot is a different concept
    // (its tier name) and must stay untouched by the discount branch.
    const result = formatPassValues({
      cardType: 'membership_card',
      snapshot: snapshot(),
      boundFieldKeys: ['memberLevel', 'visitCount'],
      discountTier: TIER,
      currency: 'TWD',
      language: 'zh-TW',
    });
    expect(result.properties).not.toHaveProperty('memberLevel');
    expect(result.properties.visitCount).toBe(0);
  });

  it('keeps the cashback card\'s accumulatedSpendCashback a NUMBER', () => {
    // The cashback slot is unchanged by this work — it still shows a
    // bare spend number, not a unit-carrying string.
    const result = formatPassValues({
      cardType: 'cashback_card',
      snapshot: snapshot({ metrics: { ...emptyPassValuesMetrics(), spendAccumulated: 199.99 } }),
      boundFieldKeys: ['accumulatedSpendCashback'],
      discountTier: TIER,
      currency: 'TWD',
      language: 'zh-TW',
    });
    expect(result.properties.accumulatedSpendCashback).toBe(199.99);
  });

  it('uses the tier gap for pointsToNextTierDiscount, not the raw spend', () => {
    const result = formatPassValues({
      cardType: 'discount_card',
      snapshot: snapshot({ metrics: { ...emptyPassValuesMetrics(), spendAccumulated: 2 } }),
      boundFieldKeys: ['pointsToNextTierDiscount', 'accumulatedSpendDiscount'],
      discountTier: { ...TIER, spendToNext: 8 },
      currency: 'TWD',
      language: 'zh-TW',
    });
    expect(result.properties.pointsToNextTierDiscount).toBe('8元');
    expect(result.properties.accumulatedSpendDiscount).toBe('2元');
  });
});
