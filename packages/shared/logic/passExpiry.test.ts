/**
 * Pass expiry rules — conformance tests.
 *
 * @module shared/logic/passExpiry.test
 *
 * The critical property pinned here is TIMEZONE INDEPENDENCE: an
 * expiry is a business CALENDAR DATE, so "today + 30 days" must
 * produce the same answer regardless of the machine's timezone. The
 * tests below therefore use UTC-anchored dates and assert exact
 * calendar outcomes (not `Date` arithmetic).
 */

import { describe, it, expect } from 'vitest';
import {
  addDays,
  couponExpiryRule,
  discountExpiryRule,
  isIsoDate,
  membershipExpiryRule,
  resolveExpiryDate,
  resolveExpirySlotGuaranteesDate,
} from './passExpiry';

describe('isIsoDate', () => {
  it('accepts a real calendar date', () => {
    expect(isIsoDate('2026-10-23')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
  });

  it('rejects a malformed string', () => {
    expect(isIsoDate('2026-10')).toBe(false);
    expect(isIsoDate('2026/10/23')).toBe(false);
    expect(isIsoDate('26-10-23')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
    expect(isIsoDate(20261023)).toBe(false);
  });

  it('rejects a date that does not exist (no silent rollover)', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2025-02-29')).toBe(false);
  });
});

describe('addDays', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-10-23', 1)).toBe('2026-10-24');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap years', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
  });

  it('handles a 400-year leap year', () => {
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
  });

  it('does NOT shift across a timezone boundary (UTC-anchored arithmetic)', () => {
    // If this implementation used local-time `Date` arithmetic, a
    // machine in UTC-8 would produce '2026-10-22' for the last case.
    expect(addDays('2026-01-01', 1)).toBe('2026-01-02');
    expect(addDays('2026-03-01', 1)).toBe('2026-03-02');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('supports a negative delta (going backwards)', () => {
    expect(addDays('2026-10-23', -1)).toBe('2026-10-22');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('resolveExpiryDate — never', () => {
  it('returns null for the never mode', () => {
    expect(resolveExpiryDate({ mode: 'never' }, '2026-10-23')).toBeNull();
  });
});

describe('resolveExpiryDate — duration_days', () => {
  it('adds the day count to the issuance date', () => {
    expect(resolveExpiryDate({ mode: 'duration_days', durationDays: 30 }, '2026-10-23')).toBe('2026-11-22');
  });

  it('is timezone-independent (same calendar answer for a UTC anchor)', () => {
    // The issuance date is a CALENDAR date supplied by the caller —
    // not an instant — so the result is deterministic.
    expect(resolveExpiryDate({ mode: 'duration_days', durationDays: 365 }, '2026-01-01')).toBe('2027-01-01');
    expect(resolveExpiryDate({ mode: 'duration_days', durationDays: 365 }, '2024-01-01')).toBe('2024-12-31');
  });

  it('falls back to null (no expiry) on an invalid day count', () => {
    expect(resolveExpiryDate({ mode: 'duration_days', durationDays: null }, '2026-10-23')).toBeNull();
    expect(resolveExpiryDate({ mode: 'duration_days', durationDays: 0 }, '2026-10-23')).toBeNull();
    expect(resolveExpiryDate({ mode: 'duration_days', durationDays: -5 }, '2026-10-23')).toBeNull();
    expect(resolveExpiryDate({ mode: 'duration_days', durationDays: 1.5 }, '2026-10-23')).toBeNull();
    expect(resolveExpiryDate({ mode: 'duration_days' }, '2026-10-23')).toBeNull();
  });

  it('falls back to null on a malformed issuance date', () => {
    expect(resolveExpiryDate({ mode: 'duration_days', durationDays: 30 }, 'not-a-date')).toBeNull();
  });
});

describe('resolveExpiryDate — specific_date', () => {
  it('returns the fixed date verbatim', () => {
    expect(resolveExpiryDate({ mode: 'specific_date', specificDate: '2027-10-23' }, '2026-10-23')).toBe('2027-10-23');
  });

  it('returns the date even when it is BEFORE the issuance date (no clamping)', () => {
    // The template is the authority on its own validity window.
    expect(resolveExpiryDate({ mode: 'specific_date', specificDate: '2020-01-01' }, '2026-10-23')).toBe('2020-01-01');
  });

  it('falls back to null on a missing / malformed date', () => {
    expect(resolveExpiryDate({ mode: 'specific_date', specificDate: null }, '2026-10-23')).toBeNull();
    expect(resolveExpiryDate({ mode: 'specific_date', specificDate: 'not-a-date' }, '2026-10-23')).toBeNull();
    expect(resolveExpiryDate({ mode: 'specific_date' }, '2026-10-23')).toBeNull();
  });
});

describe('membershipExpiryRule', () => {
  it('never expires when the card-wide hasExpiry toggle is off', () => {
    expect(membershipExpiryRule({ hasExpiry: false }).mode).toBe('never');
    expect(membershipExpiryRule({ hasExpiry: null }).mode).toBe('never');
    expect(membershipExpiryRule({}).mode).toBe('never');
  });

  it('uses the custom day count when hasExpiry=true + custom_days', () => {
    const rule = membershipExpiryRule({
      hasExpiry: true,
      expiryMode: 'custom_days',
      customExpiryDays: 365,
    });
    expect(rule.mode).toBe('duration_days');
    expect(resolveExpiryDate(rule, '2026-10-23')).toBe('2027-10-23');
  });

  it('uses the specific date when hasExpiry=true + specific_date', () => {
    const rule = membershipExpiryRule({
      hasExpiry: true,
      expiryMode: 'specific_date',
      specificExpiryDate: '2027-01-01',
    });
    expect(rule.mode).toBe('specific_date');
    expect(resolveExpiryDate(rule, '2026-10-23')).toBe('2027-01-01');
  });

  it('never expires when hasExpiry=true but no mode is chosen (mid-edit template)', () => {
    expect(membershipExpiryRule({ hasExpiry: true, expiryMode: null }).mode).toBe('never');
  });
});

describe('couponExpiryRule', () => {
  it('prefers the duration when passValidDays is set', () => {
    const rule = couponExpiryRule({ passValidDays: 7, expiryDate: '2026-12-31' });
    expect(rule.mode).toBe('duration_days');
    expect(resolveExpiryDate(rule, '2026-10-23')).toBe('2026-10-30');
  });

  it('falls back to the specific date', () => {
    const rule = couponExpiryRule({ passValidDays: null, expiryDate: '2026-12-31' });
    expect(rule.mode).toBe('specific_date');
    expect(resolveExpiryDate(rule, '2026-10-23')).toBe('2026-12-31');
  });

  it('never expires when neither is set', () => {
    expect(couponExpiryRule({ passValidDays: null, expiryDate: '' }).mode).toBe('never');
    expect(couponExpiryRule({}).mode).toBe('never');
  });

  it('never expires when expiryDate is malformed', () => {
    expect(couponExpiryRule({ expiryDate: 'not-a-date' }).mode).toBe('never');
  });
});

describe('discountExpiryRule', () => {
  it('prefers the duration when discountCustomExpiryDays is set', () => {
    const rule = discountExpiryRule({
      customExpiryDays: 30,
      specificExpiryDate: '2026-12-31',
    });
    expect(rule.mode).toBe('duration_days');
    expect(resolveExpiryDate(rule, '2026-10-23')).toBe('2026-11-22');
  });

  it('falls back to the specific date', () => {
    const rule = discountExpiryRule({
      customExpiryDays: null,
      specificExpiryDate: '2026-12-31',
    });
    expect(rule.mode).toBe('specific_date');
    expect(resolveExpiryDate(rule, '2026-10-23')).toBe('2026-12-31');
  });

  it('never expires when neither is set', () => {
    expect(discountExpiryRule({ customExpiryDays: null, specificExpiryDate: null }).mode).toBe('never');
    expect(discountExpiryRule({}).mode).toBe('never');
  });
});

/**
 * `resolveExpirySlotGuaranteesDate` — "does EVERY holder of this
 * template have an expiry date?"
 *
 * The answer drives the Passcreator field type of the expiry slot:
 * `date` when guaranteed, `text` when not (so the runtime's `∞`
 * sentinel is accepted).
 */
describe('resolveExpirySlotGuaranteesDate — membership', () => {
  it('is FALSE when the card-wide hasExpiry toggle is off (lifetime member)', () => {
    expect(
      resolveExpirySlotGuaranteesDate('membership_card', { hasExpiry: false }),
    ).toBe(false);
  });

  it('is FALSE when the settings are missing entirely', () => {
    expect(resolveExpirySlotGuaranteesDate('membership_card', null)).toBe(false);
    expect(resolveExpirySlotGuaranteesDate('membership_card', undefined)).toBe(false);
  });

  it('is TRUE for a free membership with a custom day count', () => {
    expect(
      resolveExpirySlotGuaranteesDate('membership_card', {
        hasExpiry: true,
        membershipExpiryMode: 'custom_days',
        membershipCustomExpiryDays: 30,
      }),
    ).toBe(true);
  });

  it('is TRUE for a free membership with a valid specific date', () => {
    expect(
      resolveExpirySlotGuaranteesDate('membership_card', {
        hasExpiry: true,
        membershipExpiryMode: 'specific_date',
        membershipSpecificExpiryDate: '2027-10-23',
      }),
    ).toBe(true);
  });

  it('is FALSE for a free membership with a MALFORMED specific date', () => {
    expect(
      resolveExpirySlotGuaranteesDate('membership_card', {
        hasExpiry: true,
        membershipExpiryMode: 'specific_date',
        membershipSpecificExpiryDate: 'not-a-date',
      }),
    ).toBe(false);
  });

  it('is FALSE for a free membership with a non-positive custom day count', () => {
    expect(
      resolveExpirySlotGuaranteesDate('membership_card', {
        hasExpiry: true,
        membershipExpiryMode: 'custom_days',
        membershipCustomExpiryDays: 0,
      }),
    ).toBe(false);
  });

  it('is FALSE for a PAID membership with no expiry mode (the tier duration is holder-level)', () => {
    // A paid membership resolves its expiry from the HOLDER's frozen
    // tier snapshot (monthly / yearly). A free holder has no tier, so
    // the template can NOT guarantee a date for every holder.
    expect(
      resolveExpirySlotGuaranteesDate('membership_card', { hasExpiry: true }),
    ).toBe(false);
  });

  it('is TRUE for a PAID membership WITH an expiry mode (the mode wins for every holder)', () => {
    expect(
      resolveExpirySlotGuaranteesDate('membership_card', {
        hasExpiry: true,
        membershipExpiryMode: 'custom_days',
        membershipCustomExpiryDays: 365,
      }),
    ).toBe(true);
  });
});

describe('resolveExpirySlotGuaranteesDate — coupon', () => {
  it('is TRUE when passValidDays is set', () => {
    expect(
      resolveExpirySlotGuaranteesDate('coupon_card', { passValidDays: 30 }),
    ).toBe(true);
  });

  it('is TRUE when a valid fixed expiryDate is set', () => {
    expect(
      resolveExpirySlotGuaranteesDate('coupon_card', { expiryDate: '2027-10-23' }),
    ).toBe(true);
  });

  it('is FALSE when neither is set', () => {
    expect(resolveExpirySlotGuaranteesDate('coupon_card', {})).toBe(false);
    expect(
      resolveExpirySlotGuaranteesDate('coupon_card', {
        passValidDays: null,
        expiryDate: '',
      }),
    ).toBe(false);
  });

  it('is FALSE when the fixed expiryDate is malformed', () => {
    expect(
      resolveExpirySlotGuaranteesDate('coupon_card', { expiryDate: 'not-a-date' }),
    ).toBe(false);
  });

  it('is FALSE when passValidDays is not a positive integer', () => {
    expect(
      resolveExpirySlotGuaranteesDate('coupon_card', { passValidDays: 0 }),
    ).toBe(false);
  });
});

describe('resolveExpirySlotGuaranteesDate — discount', () => {
  it('is TRUE when discountCustomExpiryDays is set', () => {
    expect(
      resolveExpirySlotGuaranteesDate('discount_card', {
        discountCustomExpiryDays: 30,
      }),
    ).toBe(true);
  });

  it('is TRUE when a valid discountSpecificExpiryDate is set', () => {
    expect(
      resolveExpirySlotGuaranteesDate('discount_card', {
        discountSpecificExpiryDate: '2027-10-23',
      }),
    ).toBe(true);
  });

  it('is FALSE when neither is set', () => {
    expect(resolveExpirySlotGuaranteesDate('discount_card', {})).toBe(false);
  });

  it('is FALSE when the specific date is malformed', () => {
    expect(
      resolveExpirySlotGuaranteesDate('discount_card', {
        discountSpecificExpiryDate: 'not-a-date',
      }),
    ).toBe(false);
  });
});

describe('resolveExpirySlotGuaranteesDate — other card types', () => {
  it('is FALSE for a card type with no expiry concept (balance / points slots)', () => {
    expect(resolveExpirySlotGuaranteesDate('stamp_card', {})).toBe(false);
    expect(resolveExpirySlotGuaranteesDate('gift_card', {})).toBe(false);
    expect(resolveExpirySlotGuaranteesDate('reward_card', {})).toBe(false);
  });

  it('is FALSE for an unknown / missing card type', () => {
    expect(resolveExpirySlotGuaranteesDate(null, {})).toBe(false);
    expect(resolveExpirySlotGuaranteesDate(undefined, {})).toBe(false);
    expect(resolveExpirySlotGuaranteesDate('not_a_card_type', {})).toBe(false);
  });
});
