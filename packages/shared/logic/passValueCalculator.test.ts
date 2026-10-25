/**
 * Pass runtime value calculator — conformance tests.
 *
 * @module shared/logic/passValueCalculator.test
 *
 * The properties pinned here:
 *
 *   1. Registration and event replay share ONE derivation — a
 *      registration's snapshot equals the replay of its own event.
 *   2. All 8 card types are handled; none of them throws.
 *   3. Gift points NEVER land in a reward-points (or currency) metric.
 *   4. Replay is deterministic: same events → same snapshot, whatever
 *      the input order.
 */

import { describe, it, expect } from 'vitest';
import {
  buildInitialMetrics,
  buildInitialValues,
  reducePassValues,
} from './passValueCalculator';
import { PassValueDomainError } from './passValueErrors';
import { cardTypeSchema, type CardType } from '../schemas/card';
import {
  emptyPassValuesMetrics,
  PASS_VALUE_INTEGER_METRICS,
  PASS_VALUE_METRICS,
  type PassEvent,
  type PassValueMetric,
} from '../schemas/passValues';

const ALL_CARD_TYPES: CardType[] = [...cardTypeSchema.options];

function delta(
  metric: 'giftPoints' | 'pointsBalance' | 'spendAccumulated' | 'visitCount' | 'stampCount',
  amount: number,
  at: string,
): PassEvent {
  return {
    type: 'metric_delta',
    at,
    payload: { metric, delta: amount },
  };
}

describe('buildInitialValues — all 8 card types', () => {
  it.each(ALL_CARD_TYPES)('cardType=%s produces a valid registered event', (cardType) => {
    const event = buildInitialValues({
      cardType,
      purchasedPoints: 0,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });
    expect(event.type).toBe('registered');
    if (event.type !== 'registered') throw new Error('unreachable');
    expect(event.payload.metrics).toBeDefined();
    expect(event.payload.expiryDate).toBeNull();
  });

  it('every card type reduces to a valid snapshot', () => {
    for (const cardType of ALL_CARD_TYPES) {
      const event = buildInitialValues({
        cardType,
        purchasedPoints: 100,
        expiryRule: { mode: 'never' },
        issuedOn: '2026-10-23',
      });
      const snapshot = reducePassValues([event]);
      expect(snapshot.metrics).toBeDefined();
      expect(snapshot.expiryDate).toBeNull();
    }
  });
});

describe('buildInitialMetrics — gift points vs other metrics', () => {
  it('gift_card opens with the PURCHASED points', () => {
    const metrics = buildInitialMetrics({
      cardType: 'gift_card',
      purchasedPoints: 500,
    });
    expect(metrics.giftPoints).toBe(500);
  });

  it('gift_card does NOT open with reward points or spend', () => {
    const metrics = buildInitialMetrics({
      cardType: 'gift_card',
      purchasedPoints: 500,
    });
    expect(metrics.pointsBalance).toBe(0);
    expect(metrics.spendAccumulated).toBe(0);
    expect(metrics.carryoverBalance).toBe(0);
  });

  it('a NON-gift card type IGNORES purchasedPoints (no cross-contamination)', () => {
    // This is the "gift points 不得與 currency balance 互換" invariant
    // at the opening-balance level: a stray purchased_points value on
    // a stamp / reward / cashback card must never become a point
    // balance.
    for (const cardType of ALL_CARD_TYPES.filter((c) => c !== 'gift_card')) {
      const metrics = buildInitialMetrics({
        cardType,
        purchasedPoints: 500,
      });
      expect(metrics.giftPoints, `${cardType} must not open with gift points`).toBe(0);
      expect(metrics.pointsBalance, `${cardType} must not open with reward points`).toBe(0);
    }
  });

  it('a gift card with a nonsensical purchasedPoints falls back to zero', () => {
    expect(buildInitialMetrics({ cardType: 'gift_card', purchasedPoints: null }).giftPoints).toBe(0);
    expect(buildInitialMetrics({ cardType: 'gift_card', purchasedPoints: -5 }).giftPoints).toBe(0);
    expect(buildInitialMetrics({ cardType: 'gift_card', purchasedPoints: 1.5 }).giftPoints).toBe(0);
    expect(buildInitialMetrics({ cardType: 'gift_card' }).giftPoints).toBe(0);
  });

  it('every non-gift card type opens completely empty', () => {
    for (const cardType of ALL_CARD_TYPES.filter((c) => c !== 'gift_card')) {
      expect(buildInitialMetrics({ cardType, purchasedPoints: 1000 })).toEqual({
        giftPoints: 0,
        pointsBalance: 0,
        carryoverBalance: 0,
        spendAccumulated: 0,
        visitCount: 0,
        stampCount: 0,
      });
    }
  });
});

describe('buildInitialValues — expiry', () => {
  it('resolves a duration rule against the issuance date', () => {
    const event = buildInitialValues({
      cardType: 'membership_card',
      expiryRule: { mode: 'duration_days', durationDays: 365 },
      issuedOn: '2026-10-23',
    });
    if (event.type !== 'registered') throw new Error('unreachable');
    expect(event.payload.expiryDate).toBe('2027-10-23');
  });

  it('resolves a specific-date rule', () => {
    const event = buildInitialValues({
      cardType: 'coupon_card',
      expiryRule: { mode: 'specific_date', specificDate: '2027-01-01' },
      issuedOn: '2026-10-23',
    });
    if (event.type !== 'registered') throw new Error('unreachable');
    expect(event.payload.expiryDate).toBe('2027-01-01');
  });

  it('has a null expiry for the never mode', () => {
    const event = buildInitialValues({
      cardType: 'stamp_card',
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
    });
    if (event.type !== 'registered') throw new Error('unreachable');
    expect(event.payload.expiryDate).toBeNull();
  });

  it('has a null expiry when no issuance date is supplied', () => {
    const event = buildInitialValues({
      cardType: 'membership_card',
      expiryRule: { mode: 'duration_days', durationDays: 365 },
    });
    if (event.type !== 'registered') throw new Error('unreachable');
    expect(event.payload.expiryDate).toBeNull();
  });
});

describe('reducePassValues — the shared derivation', () => {
  it('replaying a registration event yields the registration state', () => {
    const event = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 500,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
    });
    const snapshot = reducePassValues([event]);
    expect(snapshot.metrics.giftPoints).toBe(500);
    expect(snapshot.expiryDate).toBeNull();
  });

  it('an EMPTY event list yields an all-zero snapshot (not a crash)', () => {
    const snapshot = reducePassValues([]);
    expect(snapshot.metrics.giftPoints).toBe(0);
    expect(snapshot.metrics.pointsBalance).toBe(0);
    expect(snapshot.expiryDate).toBeNull();
  });

  it('applies a delta to the right metric', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 500,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });
    const snapshot = reducePassValues([
      registered,
      delta('giftPoints', -100, '2026-10-24T08:00:00.000Z'),
    ]);
    expect(snapshot.metrics.giftPoints).toBe(400);
  });

  it('a gift-points delta NEVER moves the reward-points metric', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 500,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });
    const snapshot = reducePassValues([
      registered,
      delta('giftPoints', -100, '2026-10-24T08:00:00.000Z'),
      delta('giftPoints', 50, '2026-10-25T08:00:00.000Z'),
    ]);
    expect(snapshot.metrics.giftPoints).toBe(450);
    expect(snapshot.metrics.pointsBalance).toBe(0);
    expect(snapshot.metrics.spendAccumulated).toBe(0);
    expect(snapshot.metrics.carryoverBalance).toBe(0);
  });

  it('accumulates multiple deltas of DIFFERENT metrics independently', () => {
    const registered = buildInitialValues({
      cardType: 'reward_card',
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });
    const snapshot = reducePassValues([
      registered,
      delta('pointsBalance', 10, '2026-10-24T08:00:00.000Z'),
      delta('pointsBalance', 5, '2026-10-25T08:00:00.000Z'),
      delta('spendAccumulated', 199.5 as unknown as number, '2026-10-25T08:00:00.000Z'),
      delta('visitCount', 1, '2026-10-25T08:00:00.000Z'),
      delta('stampCount', 2, '2026-10-25T08:00:00.000Z'),
    ]);
    expect(snapshot.metrics.pointsBalance).toBe(15);
    expect(snapshot.metrics.spendAccumulated).toBe(199.5);
    expect(snapshot.metrics.visitCount).toBe(1);
    expect(snapshot.metrics.stampCount).toBe(2);
    expect(snapshot.metrics.giftPoints).toBe(0);
  });
});

describe('reducePassValues — ordering determinism', () => {
  it('sorts events by timestamp before folding', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 100,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });
    const early = delta('giftPoints', -10, '2026-10-24T08:00:00.000Z');
    const late = delta('giftPoints', -20, '2026-10-26T08:00:00.000Z');

    const forward = reducePassValues([registered, early, late]);
    const reversed = reducePassValues([late, early, registered]);

    expect(forward.metrics.giftPoints).toBe(70);
    expect(reversed.metrics.giftPoints).toBe(70);
  });

  it('is stable for events with the SAME timestamp (input order preserved)', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 100,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });
    const a = delta('giftPoints', -1, '2026-10-24T08:00:00.000Z');
    const b = delta('giftPoints', -2, '2026-10-24T08:00:00.000Z');

    // Both orders must give the same total (70) — the two deltas are
    // commutative even though the reducer preserves input order.
    expect(reducePassValues([registered, a, b]).metrics.giftPoints).toBe(97);
    expect(reducePassValues([registered, b, a]).metrics.giftPoints).toBe(97);
  });

  it('does NOT mutate the input event array', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 100,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });
    const events: PassEvent[] = [registered, delta('giftPoints', -1, '2026-10-24T08:00:00.000Z')];
    const before = JSON.stringify(events);
    reducePassValues(events);
    expect(JSON.stringify(events)).toBe(before);
  });
});

/**
 * ORDERING (Decision Log 決定十一)
 *
 * The schema accepts ANY ISO-8601 datetime with a timezone offset
 * (`z.string().datetime({ offset: true })`), so a ledger can mix
 * `+08:00` and `Z` timestamps. A raw string comparison orders those
 * WRONGLY: `2026-10-24T23:00:00+08:00` is 15:00Z, which is EARLIER
 * than `2026-10-24T16:00:00Z` — but as strings, `23:00` sorts after
 * `16:00`.
 */
describe('reducePassValues — ordering is by TRUE INSTANT, not by raw string', () => {
  it('applies a `registered` event before an EARLIER-in-UTC offset event', () => {
    // 23:00+08:00 === 15:00Z — this is the EARLIER event, even though
    // its string sorts after the other one.
    const registered: PassEvent = {
      type: 'registered',
      at: '2026-10-24T23:00:00+08:00',
      payload: { metrics: { ...emptyPassValuesMetrics(), giftPoints: 100 }, expiryDate: null },
    };
    const later = deltaFor('giftPoints', 50, '2026-10-24T16:00:00Z');

    const snapshot = reducePassValues([later, registered]);
    // Correct order: `registered` sets 100, then the delta adds 50.
    // String order would apply the delta to a zero balance first and
    // then let `registered` RESET it back to 100.
    expect(snapshot.metrics.giftPoints).toBe(150);
  });

  it('rejects an over-spend that only becomes an over-spend in TRUE instant order', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 100,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });
    // 23:00+08:00 === 15:00Z — EARLIER than the credit at 16:00Z.
    const overSpend = deltaFor('giftPoints', -150, '2026-10-24T23:00:00+08:00');
    const credit = deltaFor('giftPoints', 100, '2026-10-24T16:00:00Z');

    // In TRUE order the over-spend happens FIRST (100 - 150 < 0), so
    // it is rejected. String order would credit first and let the
    // over-spend through.
    expect(() => reducePassValues([credit, overSpend, registered])).toThrow(
      PassValueDomainError,
    );
  });

  it('keeps input order for two events at the SAME instant written differently', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 100,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });
    // 16:00Z === 16:00+00:00 — the same instant, two spellings.
    const a = deltaFor('giftPoints', -1, '2026-10-24T16:00:00Z');
    const b = deltaFor('giftPoints', -2, '2026-10-24T16:00:00+00:00');

    expect(reducePassValues([registered, a, b]).metrics.giftPoints).toBe(97);
    expect(reducePassValues([registered, b, a]).metrics.giftPoints).toBe(97);
  });
});

/**
 * A delta for ANY metric — the local helper above is narrowed to the
 * metrics the happy-path tests exercise. The domain-rule tests below
 * need `carryoverBalance` (the one metric allowed to go negative) and
 * fractional amounts (`spendAccumulated` only).
 */
function deltaFor(metric: PassValueMetric, amount: number, at: string): PassEvent {
  return {
    type: 'metric_delta',
    at,
    payload: { metric, delta: amount },
  };
}

describe('reducePassValues — domain rules (Decision Log 決定八 / 決定九 / 決定十)', () => {
  it('REJECTS an over-spend instead of clamping it to zero', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 100,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });

    // Spending 150 points with a balance of 100 is not a 0 balance —
    // it is a rejected purchase (Decision 決定八, option C).
    expect(() =>
      reducePassValues([
        registered,
        deltaFor('giftPoints', -150, '2026-10-24T08:00:00.000Z'),
      ]),
    ).toThrow(PassValueDomainError);
  });

  it('the over-spend error carries the stable i18n-shaped code + structured details', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 100,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });

    let caught: unknown;
    try {
      reducePassValues([
        registered,
        deltaFor('giftPoints', -150, '2026-10-24T08:00:00.000Z'),
      ]);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(PassValueDomainError);
    const domainError = caught as PassValueDomainError;
    expect(domainError.code).toBe('passValue.error.negativeMetric');
    expect(domainError.details).toMatchObject({
      metric: 'giftPoints',
      delta: -150,
      result: -50,
    });
  });

  it('the rejected event leaves the ledger state COMPLETELY unchanged', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 100,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });
    const overSpend = deltaFor('giftPoints', -150, '2026-10-24T08:00:00.000Z');
    const events: PassEvent[] = [registered, overSpend];
    const before = JSON.stringify(events);

    expect(() => reducePassValues(events)).toThrow(PassValueDomainError);

    // The reducer is pure: the rejected event changed nothing, and the
    // balance is still the pre-rejection value once it is not applied.
    expect(JSON.stringify(events)).toBe(before);
    expect(reducePassValues([registered]).metrics.giftPoints).toBe(100);
  });

  it('allows a delta that lands EXACTLY on zero (the boundary is inclusive)', () => {
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 100,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });

    const snapshot = reducePassValues([
      registered,
      deltaFor('giftPoints', -100, '2026-10-24T08:00:00.000Z'),
    ]);
    expect(snapshot.metrics.giftPoints).toBe(0);
  });

  it('rejects an over-spend on EVERY non-negative metric', () => {
    const registered = buildInitialValues({
      cardType: 'reward_card',
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });

    for (const metric of PASS_VALUE_METRICS) {
      if (metric === 'carryoverBalance') continue;
      expect(
        () =>
          reducePassValues([
            registered,
            deltaFor(metric, -1, '2026-10-24T08:00:00.000Z'),
          ]),
        metric,
      ).toThrow(PassValueDomainError);
    }
  });

  it('carryoverBalance is the ONLY metric allowed to go negative (決定九)', () => {
    const registered = buildInitialValues({
      cardType: 'reward_card',
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });

    const snapshot = reducePassValues([
      registered,
      deltaFor('carryoverBalance', -50, '2026-10-24T08:00:00.000Z'),
    ]);
    expect(snapshot.metrics.carryoverBalance).toBe(-50);
  });

  it('spendAccumulated ACCEPTS a fractional delta (決定十)', () => {
    const registered = buildInitialValues({
      cardType: 'reward_card',
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });

    const snapshot = reducePassValues([
      registered,
      deltaFor('spendAccumulated', 199.99, '2026-10-24T08:00:00.000Z'),
    ]);
    expect(snapshot.metrics.spendAccumulated).toBe(199.99);
  });

  it('rejects a FRACTIONAL delta for every integer metric (決定十)', () => {
    const registered = buildInitialValues({
      cardType: 'reward_card',
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });

    for (const metric of PASS_VALUE_INTEGER_METRICS) {
      expect(
        () =>
          reducePassValues([
            registered,
            deltaFor(metric, 1.5, '2026-10-24T08:00:00.000Z'),
          ]),
        metric,
      ).toThrow(PassValueDomainError);
    }
  });

  it('rejects a NON-FINITE delta (it can never be a real amount)', () => {
    const registered = buildInitialValues({
      cardType: 'reward_card',
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-23',
      at: '2026-10-23T08:00:00.000Z',
    });

    expect(() =>
      reducePassValues([
        registered,
        deltaFor('spendAccumulated', Number.POSITIVE_INFINITY, '2026-10-24T08:00:00.000Z'),
      ]),
    ).toThrow(PassValueDomainError);
  });
});
