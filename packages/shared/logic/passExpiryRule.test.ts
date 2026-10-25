/**
 * Template → expiry rule resolution — conformance tests.
 *
 * @module shared/logic/passExpiry.rule
 *
 * The backend needs ONE mapping from "a template's settings" to "an
 * expiry rule". Doing that mapping in the backend would duplicate the
 * card-type knowledge that already lives here (Rule 023 — business
 * logic belongs in `packages/shared/`).
 *
 * The mapping is deliberately forgiving: a broken template must not
 * break a holder's registration, so an unusable setting degrades to
 * "never expires" rather than throwing.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveExpiryDate,
  resolveExpiryRuleForCardType,
} from './passExpiry';

const ISSUED_ON = '2026-10-23';

/**
 * Resolve a rule AND the date it produces.
 *
 * The rule shape and the resolved date are two different layers: a
 * rule can be `duration_days` with an invalid day count, and
 * `resolveExpiryDate` is the layer that collapses that to "no
 * expiry". The registration flow only cares about the DATE, so the
 * defensive assertions below go through the full resolution.
 */
function resolveDate(
  cardType: string | null | undefined,
  settings: Parameters<typeof resolveExpiryRuleForCardType>[1],
): string | null {
  return resolveExpiryDate(
    resolveExpiryRuleForCardType(cardType, settings),
    ISSUED_ON,
  );
}

describe('resolveExpiryRuleForCardType — membership', () => {
  it('uses the free-membership custom-day rule', () => {
    const rule = resolveExpiryRuleForCardType('membership_card', {
      hasExpiry: true,
      membershipExpiryMode: 'custom_days',
      membershipCustomExpiryDays: 365,
    });
    expect(rule).toEqual({ mode: 'duration_days', durationDays: 365 });
  });

  it('uses the free-membership specific-date rule', () => {
    const rule = resolveExpiryRuleForCardType('membership_card', {
      hasExpiry: true,
      membershipExpiryMode: 'specific_date',
      membershipSpecificExpiryDate: '2027-01-01',
    });
    expect(rule).toEqual({ mode: 'specific_date', specificDate: '2027-01-01' });
  });

  it('never expires when the membership has no expiry', () => {
    expect(
      resolveExpiryRuleForCardType('membership_card', { hasExpiry: false }),
    ).toEqual({ mode: 'never' });
    expect(
      resolveExpiryRuleForCardType('membership_card', {
        hasExpiry: true,
        membershipExpiryMode: null,
      }),
    ).toEqual({ mode: 'never' });
  });
});

describe('resolveExpiryRuleForCardType — coupon', () => {
  it('prefers the duration over the specific date', () => {
    expect(
      resolveExpiryRuleForCardType('coupon_card', {
        passValidDays: 7,
        expiryDate: '2026-12-31',
      }),
    ).toEqual({ mode: 'duration_days', durationDays: 7 });
  });

  it('falls back to the specific date', () => {
    expect(
      resolveExpiryRuleForCardType('coupon_card', {
        passValidDays: null,
        expiryDate: '2026-12-31',
      }),
    ).toEqual({ mode: 'specific_date', specificDate: '2026-12-31' });
  });
});

describe('resolveExpiryRuleForCardType — discount', () => {
  it('prefers the custom day count', () => {
    expect(
      resolveExpiryRuleForCardType('discount_card', {
        discountCustomExpiryDays: 30,
        discountSpecificExpiryDate: '2026-12-31',
      }),
    ).toEqual({ mode: 'duration_days', durationDays: 30 });
  });

  it('falls back to the specific date', () => {
    expect(
      resolveExpiryRuleForCardType('discount_card', {
        discountCustomExpiryDays: null,
        discountSpecificExpiryDate: '2026-12-31',
      }),
    ).toEqual({ mode: 'specific_date', specificDate: '2026-12-31' });
  });
});

describe('resolveExpiryRuleForCardType — other card types', () => {
  it('never expires for stamp / reward / cashback / multipass / gift', () => {
    for (const cardType of [
      'stamp_card',
      'reward_card',
      'cashback_card',
      'multipass',
      'gift_card',
    ] as const) {
      expect(
        resolveExpiryRuleForCardType(cardType, {
          passValidDays: 30,
          expiryDate: '2026-12-31',
          discountCustomExpiryDays: 30,
        }),
        cardType,
      ).toEqual({ mode: 'never' });
    }
  });

  it('never expires for an unknown / missing card type', () => {
    expect(resolveExpiryRuleForCardType(null, { passValidDays: 30 })).toEqual({
      mode: 'never',
    });
    expect(resolveExpiryRuleForCardType('not_a_card_type', {})).toEqual({
      mode: 'never',
    });
  });
});

describe('resolveExpiryRuleForCardType — defensive behaviour', () => {
  it('never expires when the settings are missing entirely', () => {
    expect(resolveExpiryRuleForCardType('coupon_card', undefined)).toEqual({
      mode: 'never',
    });
    expect(resolveExpiryRuleForCardType('coupon_card', null)).toEqual({
      mode: 'never',
    });
  });

  it('never expires when the stored date is malformed', () => {
    expect(
      resolveExpiryRuleForCardType('coupon_card', { expiryDate: 'not-a-date' }),
    ).toEqual({ mode: 'never' });
  });

  it('never expires when the day count is invalid', () => {
    expect(resolveDate('coupon_card', { passValidDays: 0 })).toBeNull();
    expect(
      resolveDate('discount_card', { discountCustomExpiryDays: -5 }),
    ).toBeNull();
    expect(
      resolveDate('membership_card', {
        hasExpiry: true,
        membershipExpiryMode: 'custom_days',
        membershipCustomExpiryDays: 0,
      }),
    ).toBeNull();
  });

  it('resolves a valid day count into the expected calendar date', () => {
    expect(resolveDate('coupon_card', { passValidDays: 7 })).toBe('2026-10-30');
    expect(
      resolveDate('membership_card', {
        hasExpiry: true,
        membershipExpiryMode: 'custom_days',
        membershipCustomExpiryDays: 365,
      }),
    ).toBe('2027-10-23');
  });
});
