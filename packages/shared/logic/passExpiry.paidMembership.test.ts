/**
 * Paid membership expiry — conformance tests.
 *
 * @module shared/logic/passExpiry.paidMembership.test
 *
 * WHY A SEPARATE FILE
 *
 * The paid-membership expiry rule was added AFTER the original
 * `passExpiry.test.ts` suite shipped. Its failure mode is different
 * enough (and its production impact different enough) that it earns
 * its own file with its own rationale header — the same pattern the
 * project uses for the gift-card purchase logic.
 *
 * THE PROBLEM THIS SOLVES
 *
 * A PAID membership card (`settings.isPaid === true`) expires by the
 * PER-TIER duration the holder bought:
 *
 *   - `durationType: 'monthly'` → expires 1 month after registration
 *   - `durationType: 'yearly'`  → expires 1 year after registration
 *
 * That duration lives in the HOLDER's frozen tier snapshot
 * (`pass_holders.membership_tier_snapshot`), NOT in the template
 * settings — because a template can offer both a monthly and a yearly
 * tier at the same time, and only the holder's purchase decides.
 *
 * The original `resolveExpiryRuleForCardType()` had no way to see the
 * holder's tier, so every paid membership resolved to "never expires".
 * On production that meant 5 holders who had PAID for a monthly
 * membership would have been backfilled with `expiryDate: null` — the
 * Wallet would show "∞" for a subscription that had already lapsed.
 *
 * MONTH ARITHMETIC IS NOT DAY ARITHMETIC
 *
 * A monthly subscription must expire on the same DAY-OF-MONTH it
 * started, clamped to the last day of a shorter month. Converting
 * "1 month" to "30 days" would expire a Jan-31 subscription on
 * Mar-2 (or Feb-28 in a leap year) — off by one or two days, and
 * inconsistent across months. So the module gains a real
 * `duration_months` mode with calendar-correct month arithmetic.
 *
 * @see packages/shared/logic/passExpiry.ts
 * @see runs/decisions/2026-10-24-pass-runtime-value-model.md
 */

import { describe, it, expect } from 'vitest';
import {
  addMonths,
  membershipDurationTypeFromSnapshot,
  membershipExpiryRule,
  resolveExpiryDate,
  resolveExpiryRuleForCardType,
} from './passExpiry';

describe('addMonths — calendar-correct month arithmetic', () => {
  it('adds a month across a year boundary', () => {
    expect(addMonths('2026-10-23', 1)).toBe('2026-11-23');
    expect(addMonths('2026-12-23', 1)).toBe('2027-01-23');
    expect(addMonths('2026-01-23', 12)).toBe('2027-01-23');
  });

  it('clamps to the last day of a shorter month', () => {
    // Jan 31 + 1 month → Feb 28 (2026 is not a leap year).
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    // Jan 31 + 1 month → Feb 29 (2024 IS a leap year).
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    // Mar 31 + 1 month → Apr 30.
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('adds 12 months as one year (not 12×30 days)', () => {
    // 2026-01-31 + 12 months → 2027-01-31, NOT 2027-01-11 (30-day
    // approximation) and NOT 2027-01-30 (360-day approximation).
    expect(addMonths('2026-01-31', 12)).toBe('2027-01-31');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
  });

  it('does NOT shift across a timezone boundary (UTC-anchored)', () => {
    expect(addMonths('2026-03-01', 1)).toBe('2026-04-01');
    expect(addMonths('2026-11-01', 1)).toBe('2026-12-01');
    expect(addMonths('2026-01-01', 1)).toBe('2026-02-01');
  });
});

describe('membershipExpiryRule — paid tier duration', () => {
  it('uses the monthly tier duration when the holder bought a monthly tier', () => {
    expect(
      membershipExpiryRule({
        hasExpiry: true,
        durationType: 'monthly',
      }),
    ).toEqual({ mode: 'duration_months', durationMonths: 1 });
  });

  it('uses 12 months for a yearly tier', () => {
    expect(
      membershipExpiryRule({
        hasExpiry: true,
        durationType: 'yearly',
      }),
    ).toEqual({ mode: 'duration_months', durationMonths: 12 });
  });

  it('never expires when the membership has no expiry toggle', () => {
    expect(
      membershipExpiryRule({ hasExpiry: false, durationType: 'monthly' }),
    ).toEqual({ mode: 'never' });
  });

  it('never expires when the holder has no tier (no purchase)', () => {
    expect(membershipExpiryRule({ hasExpiry: true, durationType: null })).toEqual({
      mode: 'never',
    });
  });

  it('prefers the FREE-membership mode when it is set', () => {
    // A free membership card uses `membershipExpiryMode`; a paid card
    // uses the tier duration. When both are somehow present the FREE
    // rule wins — it is the one the editor actually renders.
    expect(
      membershipExpiryRule({
        hasExpiry: true,
        expiryMode: 'custom_days',
        customExpiryDays: 30,
        durationType: 'monthly',
      }),
    ).toEqual({ mode: 'duration_days', durationDays: 30 });
  });
});

describe('resolveExpiryDate — duration_months', () => {
  it('resolves a monthly expiry against the issuance date', () => {
    expect(
      resolveExpiryDate({ mode: 'duration_months', durationMonths: 1 }, '2026-09-01'),
    ).toBe('2026-10-01');
  });

  it('resolves a yearly expiry against the issuance date', () => {
    expect(
      resolveExpiryDate({ mode: 'duration_months', durationMonths: 12 }, '2026-09-01'),
    ).toBe('2027-09-01');
  });

  it('returns null for an invalid month count (safe fallback)', () => {
    expect(resolveExpiryDate({ mode: 'duration_months', durationMonths: 0 }, '2026-09-01')).toBeNull();
    expect(
      resolveExpiryDate({ mode: 'duration_months', durationMonths: -1 }, '2026-09-01'),
    ).toBeNull();
    expect(
      resolveExpiryDate({ mode: 'duration_months' }, '2026-09-01'),
    ).toBeNull();
  });
});

describe('resolveExpiryRuleForCardType — holder tier input', () => {
  const PAID_MEMBERSHIP_SETTINGS = {
    isPaid: true,
    hasExpiry: true,
    membershipExpiryMode: null,
    membershipCustomExpiryDays: null,
    membershipSpecificExpiryDate: null,
  };

  it('uses the holder tier duration for a paid membership', () => {
    expect(
      resolveExpiryRuleForCardType('membership_card', PAID_MEMBERSHIP_SETTINGS, {
        durationType: 'monthly',
      }),
    ).toEqual({ mode: 'duration_months', durationMonths: 1 });
  });

  it('falls back to the free-membership rule when the holder has no tier', () => {
    expect(
      resolveExpiryRuleForCardType('membership_card', {
        hasExpiry: true,
        membershipExpiryMode: 'specific_date',
        membershipSpecificExpiryDate: '2027-01-01',
      }),
    ).toEqual({ mode: 'specific_date', specificDate: '2027-01-01' });
  });

  it('is unchanged for non-membership card types (the tier input is ignored)', () => {
    expect(
      resolveExpiryRuleForCardType(
        'coupon_card',
        { passValidDays: 7 },
        { durationType: 'monthly' },
      ),
    ).toEqual({ mode: 'duration_days', durationDays: 7 });
  });
});

describe('membershipDurationTypeFromSnapshot — reading the frozen tier', () => {
  it('reads the durationType from a tier snapshot', () => {
    expect(
      membershipDurationTypeFromSnapshot({
        index: 1,
        name: 'Gold',
        durationType: 'monthly',
        currency: 'ZAR',
      }),
    ).toBe('monthly');
  });

  it('returns null for a missing / malformed snapshot (safe fallback)', () => {
    expect(membershipDurationTypeFromSnapshot(null)).toBeNull();
    expect(membershipDurationTypeFromSnapshot(undefined)).toBeNull();
    expect(membershipDurationTypeFromSnapshot({})).toBeNull();
    expect(
      membershipDurationTypeFromSnapshot({ durationType: 'weekly' }),
    ).toBeNull();
    expect(
      membershipDurationTypeFromSnapshot({ durationType: 42 }),
    ).toBeNull();
    expect(membershipDurationTypeFromSnapshot('monthly')).toBeNull();
  });
});
