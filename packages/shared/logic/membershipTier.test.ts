/**
 * Membership tier snapshot derivation — test contract.
 *
 * @module shared/logic/membershipTier.test
 *
 * The snapshot is the FROZEN record of which membership tier a holder
 * joined (and what they paid for it). It is persisted as JSONB on
 * `public.pass_holders.membership_tier_snapshot`.
 *
 * Two invariants are pinned here:
 *
 *   1. The snapshot is SERVER-derived. The tier list comes from the
 *      template's own `settings.membershipTiers[]`, never from the
 *      request body — a client must not be able to name a tier or
 *      quote a price the tenant never offered.
 *   2. A FREE membership card (one tier, no monthly/yearly cycle) is a
 *      first-class case: it still has a tier NAME, so it still gets a
 *      snapshot. `durationType` is null and `paidAmount` is null
 *      because a free card has no billing cycle and no price.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveMembershipTierSnapshot,
  membershipTierNameFromSnapshot,
} from './membershipTier';

/** A paid card: two tiers, monthly and yearly. */
const PAID_TIERS = [
  {
    name: 'Basic',
    durationType: 'monthly',
    monthlyCost: 200,
    yearlyCost: null,
  },
  {
    name: 'VIP',
    durationType: 'yearly',
    monthlyCost: null,
    yearlyCost: 2000,
  },
];

/** A free card: ONE tier, no cycle, no price. */
const FREE_TIERS = [
  {
    name: '免費會員',
    durationType: null,
    monthlyCost: null,
    yearlyCost: null,
  },
];

describe('resolveMembershipTierSnapshot', () => {
  it('paid card: resolves the tier at the given index', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: PAID_TIERS,
      index: 0,
      currency: 'TWD',
      mode: 'paid',
    });
    expect(snap).toEqual({
      index: 0,
      name: 'Basic',
      durationType: 'monthly',
      paidAmount: 200,
      currency: 'TWD',
    });
  });

  it('paid card: a different index resolves a different tier', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: PAID_TIERS,
      index: 1,
      currency: 'TWD',
      mode: 'paid',
    });
    expect(snap).toEqual({
      index: 1,
      name: 'VIP',
      durationType: 'yearly',
      paidAmount: 2000,
      currency: 'TWD',
    });
  });

  it('paid card: a yearly tier quotes the YEARLY cost (not the monthly one)', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: [
        {
          name: 'Both',
          durationType: 'yearly',
          monthlyCost: 300,
          yearlyCost: 3000,
        },
      ],
      index: 0,
      currency: 'TWD',
      mode: 'paid',
    });
    expect(snap?.paidAmount).toBe(3000);
  });

  it('free card: the single tier resolves with a NULL durationType and NULL amount', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: FREE_TIERS,
      index: 0,
      currency: 'TWD',
      mode: 'free',
    });
    expect(snap).toEqual({
      index: 0,
      name: '免費會員',
      durationType: null,
      paidAmount: null,
      currency: 'TWD',
    });
  });

  it('free card: the tier NAME survives even when there is no cycle', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: FREE_TIERS,
      index: 0,
      currency: 'TWD',
      mode: 'free',
    });
    expect(snap?.name).toBe('免費會員');
  });

  it('free card: stale PAID values on the tier are ignored (no phantom cycle / price)', () => {
    // Switching a card paid → free in the editor does not clear the
    // per-tier durationType / costs. A free holder must not inherit
    // them, or the expiry rule would read a monthly cycle the holder
    // never bought.
    const snap = resolveMembershipTierSnapshot({
      tiers: [
        {
          name: 'Was paid',
          durationType: 'monthly',
          monthlyCost: 200,
          yearlyCost: null,
        },
      ],
      index: 0,
      currency: 'TWD',
      mode: 'free',
    });
    expect(snap).toEqual({
      index: 0,
      name: 'Was paid',
      durationType: null,
      paidAmount: null,
      currency: 'TWD',
    });
  });

  it('returns null when the index is out of range', () => {
    expect(
      resolveMembershipTierSnapshot({
        tiers: PAID_TIERS,
        index: 5,
        currency: 'TWD',
        mode: 'paid',
      }),
    ).toBeNull();
  });

  it('returns null for a negative index', () => {
    expect(
      resolveMembershipTierSnapshot({
        tiers: PAID_TIERS,
        index: -1,
        currency: 'TWD',
        mode: 'paid',
      }),
    ).toBeNull();
  });

  it('returns null when the tier list is empty', () => {
    expect(
      resolveMembershipTierSnapshot({
        tiers: [],
        index: 0,
        currency: 'TWD',
        mode: 'paid',
      }),
    ).toBeNull();
  });

  it('returns null when the tier name is empty (a blank tier is not a tier)', () => {
    expect(
      resolveMembershipTierSnapshot({
        tiers: [{ name: '', durationType: 'monthly', monthlyCost: 100 }],
        index: 0,
        currency: 'TWD',
        mode: 'paid',
      }),
    ).toBeNull();
  });

  it('returns null when the tier name is only whitespace', () => {
    expect(
      resolveMembershipTierSnapshot({
        tiers: [{ name: '   ', durationType: 'monthly', monthlyCost: 100 }],
        index: 0,
        currency: 'TWD',
        mode: 'paid',
      }),
    ).toBeNull();
  });

  it('returns null when the tier list is not an array (defensive against JSONB shape)', () => {
    expect(
      resolveMembershipTierSnapshot({
        tiers: { name: 'nope' },
        index: 0,
        currency: 'TWD',
        mode: 'paid',
      }),
    ).toBeNull();
  });

  it('returns null when the tier entry is not an object', () => {
    expect(
      resolveMembershipTierSnapshot({
        tiers: ['not-an-object'],
        index: 0,
        currency: 'TWD',
        mode: 'paid',
      }),
    ).toBeNull();
  });

  it('treats an unknown durationType as null (no cycle) rather than guessing', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: [{ name: 'Weird', durationType: 'weekly', monthlyCost: 100 }],
      index: 0,
      currency: 'TWD',
      mode: 'paid',
    });
    expect(snap?.durationType).toBeNull();
    // With no cycle there is no price to quote.
    expect(snap?.paidAmount).toBeNull();
  });

  it('quotes a zero cost as 0 (a free PAID tier is not the same as no tier)', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: [{ name: 'Free VIP', durationType: 'monthly', monthlyCost: 0 }],
      index: 0,
      currency: 'TWD',
      mode: 'paid',
    });
    expect(snap?.paidAmount).toBe(0);
  });

  it('quotes null when the cost field was never filled in', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: [{ name: 'No cost', durationType: 'monthly', monthlyCost: null }],
      index: 0,
      currency: 'TWD',
      mode: 'paid',
    });
    expect(snap?.paidAmount).toBeNull();
  });

  it('ignores a non-numeric cost (defensive against JSONB shape)', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: [{ name: 'Bad cost', durationType: 'monthly', monthlyCost: '200' }],
      index: 0,
      currency: 'TWD',
      mode: 'paid',
    });
    expect(snap?.paidAmount).toBeNull();
  });

  it('preserves the ZAR currency', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: PAID_TIERS,
      index: 0,
      currency: 'ZAR',
      mode: 'paid',
    });
    expect(snap?.currency).toBe('ZAR');
  });

  it('trims the tier name', () => {
    const snap = resolveMembershipTierSnapshot({
      tiers: [{ name: '  VIP  ', durationType: 'yearly', yearlyCost: 100 }],
      index: 0,
      currency: 'TWD',
      mode: 'paid',
    });
    expect(snap?.name).toBe('VIP');
  });
});

describe('membershipTierNameFromSnapshot', () => {
  it('reads the name out of a well-formed snapshot', () => {
    expect(
      membershipTierNameFromSnapshot({
        index: 0,
        name: 'VIP',
        durationType: 'yearly',
        paidAmount: 2000,
        currency: 'TWD',
      }),
    ).toBe('VIP');
  });

  it('reads the name out of a FREE card snapshot (durationType null)', () => {
    expect(
      membershipTierNameFromSnapshot({
        index: 0,
        name: '免費會員',
        durationType: null,
        paidAmount: null,
        currency: 'TWD',
      }),
    ).toBe('免費會員');
  });

  it('returns null for a null / undefined snapshot', () => {
    expect(membershipTierNameFromSnapshot(null)).toBeNull();
    expect(membershipTierNameFromSnapshot(undefined)).toBeNull();
  });

  it('returns null when the snapshot is not an object', () => {
    expect(membershipTierNameFromSnapshot('VIP')).toBeNull();
    expect(membershipTierNameFromSnapshot(42)).toBeNull();
  });

  it('returns null when the name is missing or not a string', () => {
    expect(membershipTierNameFromSnapshot({ index: 0 })).toBeNull();
    expect(membershipTierNameFromSnapshot({ name: 123 })).toBeNull();
  });

  it('returns null for an empty / whitespace-only name', () => {
    expect(membershipTierNameFromSnapshot({ name: '' })).toBeNull();
    expect(membershipTierNameFromSnapshot({ name: '   ' })).toBeNull();
  });
});
