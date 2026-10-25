/**
 * Pass runtime value — schema conformance tests.
 *
 * @module shared/schemas/passValues.test
 *
 * These tests pin the CONTRACT that the backend row interface, the
 * service types, and the DB CHECK constraint all mirror. If a metric
 * is renamed or its sign rule changes, this file fails first — before
 * the drift reaches production data.
 */

import { describe, it, expect } from 'vitest';
import {
  PASS_EVENT_TYPES,
  PASS_VALUE_INTEGER_METRICS,
  PASS_VALUE_METRICS,
  PASS_VALUE_NON_NEGATIVE_METRICS,
  emptyPassValuesMetrics,
  isIntegerPassValueMetric,
  isNonNegativePassValueMetric,
  passEventSchema,
  passValueMetricSchema,
  passValuesMetricsSchema,
  passValuesSnapshotSchema,
} from './passValues';

describe('passValueMetricSchema', () => {
  it('accepts every declared metric', () => {
    for (const metric of PASS_VALUE_METRICS) {
      expect(passValueMetricSchema.parse(metric)).toBe(metric);
    }
  });

  it('rejects an unknown metric (a typo must not silently become a metric)', () => {
    expect(passValueMetricSchema.safeParse('balance').success).toBe(false);
    expect(passValueMetricSchema.safeParse('giftPoint').success).toBe(false);
  });

  it('exposes a SEPARATE metric per semantic (no generic `balance`)', () => {
    // The whole point of the metric split: gift points and reward
    // points are NOT the same field. If someone collapses them into a
    // single `balance`, this fails.
    expect(PASS_VALUE_METRICS).toContain('giftPoints');
    expect(PASS_VALUE_METRICS).toContain('pointsBalance');
    expect(PASS_VALUE_METRICS).toContain('spendAccumulated');
    expect(PASS_VALUE_METRICS).toContain('carryoverBalance');
    expect(PASS_VALUE_METRICS).not.toContain('balance');
  });

  it('metric names are unique', () => {
    expect(new Set(PASS_VALUE_METRICS).size).toBe(PASS_VALUE_METRICS.length);
  });
});

describe('passValuesMetricsSchema', () => {
  it('emptyPassValuesMetrics() parses', () => {
    expect(passValuesMetricsSchema.parse(emptyPassValuesMetrics())).toEqual({
      giftPoints: 0,
      pointsBalance: 0,
      carryoverBalance: 0,
      spendAccumulated: 0,
      visitCount: 0,
      stampCount: 0,
    });
  });

  it('rejects a missing metric (a partial snapshot is a bug, not a default)', () => {
    const partial = { ...emptyPassValuesMetrics() } as Record<string, unknown>;
    delete partial.giftPoints;
    expect(passValuesMetricsSchema.safeParse(partial).success).toBe(false);
  });

  it('rejects negative balances for the accumulators', () => {
    expect(
      passValuesMetricsSchema.safeParse({
        ...emptyPassValuesMetrics(),
        giftPoints: -1,
      }).success,
    ).toBe(false);
    expect(
      passValuesMetricsSchema.safeParse({
        ...emptyPassValuesMetrics(),
        pointsBalance: -1,
      }).success,
    ).toBe(false);
    expect(
      passValuesMetricsSchema.safeParse({
        ...emptyPassValuesMetrics(),
        spendAccumulated: -0.01,
      }).success,
    ).toBe(false);
    expect(
      passValuesMetricsSchema.safeParse({
        ...emptyPassValuesMetrics(),
        visitCount: -1,
      }).success,
    ).toBe(false);
    expect(
      passValuesMetricsSchema.safeParse({
        ...emptyPassValuesMetrics(),
        stampCount: -1,
      }).success,
    ).toBe(false);
  });

  it('ALLOWS a signed carryoverBalance (it is an N − M difference)', () => {
    expect(
      passValuesMetricsSchema.safeParse({
        ...emptyPassValuesMetrics(),
        carryoverBalance: -5,
      }).success,
    ).toBe(true);
  });

  it('rejects non-integer point counts', () => {
    expect(
      passValuesMetricsSchema.safeParse({
        ...emptyPassValuesMetrics(),
        giftPoints: 1.5,
      }).success,
    ).toBe(false);
  });

  it('allows a fractional spendAccumulated (currency amounts are not always whole)', () => {
    expect(
      passValuesMetricsSchema.safeParse({
        ...emptyPassValuesMetrics(),
        spendAccumulated: 199.99,
      }).success,
    ).toBe(true);
  });
});

describe('passValuesSnapshotSchema', () => {
  it('accepts a snapshot with metrics + a null expiry', () => {
    const parsed = passValuesSnapshotSchema.parse({
      metrics: emptyPassValuesMetrics(),
      expiryDate: null,
    });
    expect(parsed.expiryDate).toBeNull();
  });

  it('accepts an ISO YYYY-MM-DD expiry date', () => {
    const parsed = passValuesSnapshotSchema.parse({
      metrics: emptyPassValuesMetrics(),
      expiryDate: '2027-10-23',
    });
    expect(parsed.expiryDate).toBe('2027-10-23');
  });

  it('rejects a snapshot with a non-object metrics field', () => {
    expect(
      passValuesSnapshotSchema.safeParse({
        metrics: 42,
        expiryDate: null,
      }).success,
    ).toBe(false);
  });
});

describe('passEventSchema', () => {
  it('accepts a `registered` event', () => {
    const parsed = passEventSchema.parse({
      type: 'registered',
      at: '2026-10-24T08:00:00.000Z',
      payload: {
        metrics: { ...emptyPassValuesMetrics(), giftPoints: 500 },
        expiryDate: null,
      },
    });
    expect(parsed.type).toBe('registered');
  });

  it('accepts a `metric_delta` event with a negative delta', () => {
    const delta = passEventSchema.parse({
      type: 'metric_delta',
      at: '2026-10-24T09:00:00.000Z',
      payload: { metric: 'giftPoints', delta: -100 },
    });
    expect(delta.type).toBe('metric_delta');
  });

  it('rejects an unknown event type (a typo must not be silently ignored)', () => {
    expect(
      passEventSchema.safeParse({
        type: 'scanned',
        at: '2026-10-24T08:00:00.000Z',
        payload: {},
      }).success,
    ).toBe(false);
  });

  it('rejects a delta event with an unknown metric', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: '2026-10-24T08:00:00.000Z',
        payload: { metric: 'balance', delta: 1 },
      }).success,
    ).toBe(false);
  });

  it('rejects a delta event with a fractional delta (point counts are integers)', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: '2026-10-24T08:00:00.000Z',
        payload: { metric: 'giftPoints', delta: 1.5 },
      }).success,
    ).toBe(false);
  });

  it('exposes exactly the 2 event types this round implements', () => {
    expect(PASS_EVENT_TYPES).toEqual(['registered', 'metric_delta']);
  });
});

describe('passEventSchema — `at` must be a real datetime', () => {
  it('accepts a UTC timestamp with milliseconds', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: '2026-10-24T08:00:00.000Z',
        payload: { metric: 'giftPoints', delta: 1 },
      }).success,
    ).toBe(true);
  });

  it('accepts a timestamp with a non-UTC offset', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: '2026-10-24T08:00:00+08:00',
        payload: { metric: 'giftPoints', delta: 1 },
      }).success,
    ).toBe(true);
  });

  it('rejects a DATE-ONLY value (it would silently mis-order the fold)', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: '2026-10-24',
        payload: { metric: 'giftPoints', delta: 1 },
      }).success,
    ).toBe(false);
  });

  it('rejects a timestamp without any timezone', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: '2026-10-24T08:00:00',
        payload: { metric: 'giftPoints', delta: 1 },
      }).success,
    ).toBe(false);
  });

  it('rejects a non-datetime string', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: 'yesterday',
        payload: { metric: 'giftPoints', delta: 1 },
      }).success,
    ).toBe(false);
  });

  it('applies the same rule to a `registered` event', () => {
    expect(
      passEventSchema.safeParse({
        type: 'registered',
        at: '2026-10-24',
        payload: { metrics: emptyPassValuesMetrics(), expiryDate: null },
      }).success,
    ).toBe(false);
  });
});

describe('passEventSchema — delta integrality is PER METRIC', () => {
  it('accepts a fractional spendAccumulated delta (a currency amount)', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: '2026-10-24T08:00:00.000Z',
        payload: { metric: 'spendAccumulated', delta: 199.99 },
      }).success,
    ).toBe(true);
  });

  it('rejects a fractional giftPoints delta', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: '2026-10-24T08:00:00.000Z',
        payload: { metric: 'giftPoints', delta: 1.5 },
      }).success,
    ).toBe(false);
  });

  it('rejects a fractional visitCount delta', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: '2026-10-24T08:00:00.000Z',
        payload: { metric: 'visitCount', delta: 0.5 },
      }).success,
    ).toBe(false);
  });

  it('accepts a negative delta for every metric (a redemption is signed)', () => {
    expect(
      passEventSchema.safeParse({
        type: 'metric_delta',
        at: '2026-10-24T08:00:00.000Z',
        payload: { metric: 'giftPoints', delta: -100 },
      }).success,
    ).toBe(true);
  });
});

describe('PASS_VALUE_INTEGER_METRICS — the per-metric integrality rule', () => {
  it('covers every metric except spendAccumulated', () => {
    expect([...PASS_VALUE_INTEGER_METRICS].sort()).toEqual(
      [...PASS_VALUE_METRICS].filter((m) => m !== 'spendAccumulated').sort(),
    );
  });

  it('agrees with the metric schema (a fractional value is rejected for exactly these metrics)', () => {
    for (const metric of PASS_VALUE_METRICS) {
      const fractional = passValuesMetricsSchema.safeParse({
        ...emptyPassValuesMetrics(),
        [metric]: 1.5,
      }).success;
      expect(fractional, metric).toBe(!isIntegerPassValueMetric(metric));
    }
  });
});

describe('PASS_VALUE_NON_NEGATIVE_METRICS — the per-metric sign rule', () => {
  it('covers every metric except carryoverBalance (a signed N − M difference)', () => {
    expect([...PASS_VALUE_NON_NEGATIVE_METRICS].sort()).toEqual(
      [...PASS_VALUE_METRICS].filter((m) => m !== 'carryoverBalance').sort(),
    );
  });

  it('agrees with the metric schema (a negative value is rejected for exactly these metrics)', () => {
    for (const metric of PASS_VALUE_METRICS) {
      const negative = passValuesMetricsSchema.safeParse({
        ...emptyPassValuesMetrics(),
        [metric]: -1,
      }).success;
      expect(negative, metric).toBe(!isNonNegativePassValueMetric(metric));
    }
  });
});

describe('expiryDate must be an ISO YYYY-MM-DD date', () => {
  it('accepts null', () => {
    expect(
      passValuesSnapshotSchema.safeParse({
        metrics: emptyPassValuesMetrics(),
        expiryDate: null,
      }).success,
    ).toBe(true);
  });

  it('accepts a real calendar date', () => {
    expect(
      passValuesSnapshotSchema.safeParse({
        metrics: emptyPassValuesMetrics(),
        expiryDate: '2027-10-23',
      }).success,
    ).toBe(true);
  });

  it('rejects a malformed date (it would be silently dropped downstream)', () => {
    expect(
      passValuesSnapshotSchema.safeParse({
        metrics: emptyPassValuesMetrics(),
        expiryDate: '2027/10/23',
      }).success,
    ).toBe(false);
  });

  it('rejects a calendar date that does not exist', () => {
    expect(
      passValuesSnapshotSchema.safeParse({
        metrics: emptyPassValuesMetrics(),
        expiryDate: '2026-02-30',
      }).success,
    ).toBe(false);
  });

  it('rejects a full timestamp (the expiry is a DATE, not a timestamp)', () => {
    expect(
      passValuesSnapshotSchema.safeParse({
        metrics: emptyPassValuesMetrics(),
        expiryDate: '2027-10-23T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('rejects a malformed expiryDate on a `registered` event too', () => {
    expect(
      passEventSchema.safeParse({
        type: 'registered',
        at: '2026-10-24T08:00:00.000Z',
        payload: { metrics: emptyPassValuesMetrics(), expiryDate: 'not-a-date' },
      }).success,
    ).toBe(false);
  });
});
