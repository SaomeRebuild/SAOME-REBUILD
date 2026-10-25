/**
 * Pass runtime value — event + snapshot Zod contracts.
 *
 * @module shared/schemas/passValues
 * @description The wire contract for the Pass runtime value model.
 *
 * WHAT THIS IS
 *
 * A Pass (wallet card) shows the holder a *current* value: how many
 * points they have, when their membership expires, how much they've
 * spent. SAOME stores that as an append-only event ledger
 * (`public.pass_events`) and derives a snapshot from it
 * (`pass_holders.pass_values_snapshot`).
 *
 * This module defines the two shapes:
 *   - `passEventSchema` — one immutable fact ("3 points were spent")
 *   - `passValuesSnapshotSchema` — the derived current state
 *
 * WHY A SEPARATE METRIC PER SEMANTIC (not one `balance` field)
 *
 * A tempting shortcut is a single `balance: number` on the snapshot.
 * It is wrong, because SAOME's balance-ish fields mean different
 * things:
 *
 *   - `giftPoints`   — gift card: prepaid POINTS. Spending them at the
 *                      counter reduces a points balance.
 *   - `pointsBalance`— reward card: POINTS earned per visit / per spend.
 *   - `spendAccumulated` — cashback / discount: cumulative SPEND amount
 *                      (the quantity a tier threshold is compared against).
 *   - `carryoverBalance` — reserved for the `N − M` carryover rule.
 *
 * A gift card's `giftPoints` and a reward card's `pointsBalance` are
 * both "points", but they live in different products and are not
 * interchangeable — a gift card's points are prepaid (and thus a
 * liability); a reward card's points are earned. Merging them into one
 * field would make it possible to render a prepaid gift-card balance
 * into a reward-card slot and vice versa. The separate fields make that
 * class of bug a type error rather than a production incident.
 *
 * Rule references:
 *   - Rule 023 § Shared Package 邊界 — contracts live in `packages/shared/`.
 *   - Rule 019 § 4.1 — this is Layer 1 of the four-layer sync; the
 *     backend row interface + service types mirror it.
 *   - Rule 032 § 1 — the backend validates JSONB in the application
 *     layer (via these schemas) before it reaches SQL.
 *   - Rule 024 § Mobile Future-Proof — pure data, no platform API.
 *
 * @see packages/shared/logic/passValueCalculator.ts — the reducer
 * @see packages/shared/logic/passFieldFormatter.ts — snapshot → Passcreator payload
 * @see runs/decisions/2026-10-24-pass-runtime-value-model.md
 */

import { z } from 'zod';

/**
 * The canonical runtime metrics.
 *
 * Each entry is a SEPARATE semantic quantity. See the module docblock
 * for why they are not merged into one `balance` field.
 */
export const PASS_VALUE_METRICS = [
  /** Gift card: prepaid points balance. */
  'giftPoints',
  /** Reward card: points earned balance. */
  'pointsBalance',
  /**
   * Reserved for the `N − M` carryover rule (points granted minus
   * points used within a period). Its exact semantics are decided in
   * the Scanner-phase plan — the field exists so the state shape does
   * not have to change when that lands.
   */
  'carryoverBalance',
  /** Cashback / discount: cumulative spend amount. */
  'spendAccumulated',
  /** Visit counter (stamp / multipass cards). */
  'visitCount',
  /** Stamp counter (stamp / multipass cards). */
  'stampCount',
] as const;

export const passValueMetricSchema = z.enum(PASS_VALUE_METRICS);
export type PassValueMetric = z.infer<typeof passValueMetricSchema>;

/**
 * The metrics whose value MUST be a whole number.
 *
 * Point / visit / stamp counts are counts — a fractional one is a
 * bug, not a rounding opportunity. `spendAccumulated` is the single
 * exception: it accumulates currency amounts, and 199.99 is a
 * perfectly ordinary value.
 *
 * The set is a *per-metric* rule, not a blanket one. Two metrics in
 * the same snapshot can have different integrality requirements,
 * which is why this cannot be expressed as a single `.int()` on the
 * whole metric object.
 */
export const PASS_VALUE_INTEGER_METRICS = [
  'giftPoints',
  'pointsBalance',
  'carryoverBalance',
  'visitCount',
  'stampCount',
] as const;

/**
 * The metrics whose value MUST NOT go below zero.
 *
 * Every accumulator grows upward. The single exception is
 * `carryoverBalance`, which is a signed `N − M` difference — a
 * negative intermediate value is representable by design.
 */
export const PASS_VALUE_NON_NEGATIVE_METRICS = [
  'giftPoints',
  'pointsBalance',
  'spendAccumulated',
  'visitCount',
  'stampCount',
] as const;

/**
 * True when the metric's value must be a whole number.
 *
 * @see PASS_VALUE_INTEGER_METRICS
 */
export function isIntegerPassValueMetric(metric: PassValueMetric): boolean {
  return (PASS_VALUE_INTEGER_METRICS as readonly PassValueMetric[]).includes(
    metric,
  );
}

/**
 * True when the metric's value must not go below zero.
 *
 * @see PASS_VALUE_NON_NEGATIVE_METRICS
 */
export function isNonNegativePassValueMetric(
  metric: PassValueMetric,
): boolean {
  return (
    PASS_VALUE_NON_NEGATIVE_METRICS as readonly PassValueMetric[]
  ).includes(metric);
}

/**
 * The value schema for ONE metric.
 *
 * Built from the two rule sets above so the schema and the exported
 * sets can never drift apart — the integrality and sign rules live
 * in exactly one place.
 */
function passMetricValueSchema(metric: PassValueMetric) {
  let schema = z.number();
  if (isIntegerPassValueMetric(metric)) schema = schema.int();
  if (isNonNegativePassValueMetric(metric)) schema = schema.nonnegative();
  return schema;
}

/**
 * An ISO `YYYY-MM-DD` calendar date.
 *
 * Not a timestamp: the expiry is a business date that must not shift
 * with the server's timezone. A full ISO timestamp (`...T00:00:00Z`)
 * is REJECTED — a DATE column that silently loses its day is worse
 * than a loud parse failure.
 */
export const passExpiryDateSchema = z.string().date();

/**
 * An ISO timestamp WITH a timezone.
 *
 * A date-only value (`2026-10-24`) is rejected: the ledger folds
 * events in `at` order, and a date-only value would silently mis-order
 * same-day events. A timestamp without a timezone is rejected too —
 * its absolute instant depends on the reader's locale.
 */
export const passEventTimestampSchema = z.string().datetime({ offset: true });

/**
 * The metric set of a snapshot.
 *
 * `carryoverBalance` is intentionally allowed to be signed — it is a
 * difference (`N − M`), so a negative intermediate value is
 * representable. Every other metric is a non-negative accumulator.
 */
export const passValuesMetricsSchema = z.object({
  giftPoints: passMetricValueSchema('giftPoints'),
  pointsBalance: passMetricValueSchema('pointsBalance'),
  carryoverBalance: passMetricValueSchema('carryoverBalance'),
  spendAccumulated: passMetricValueSchema('spendAccumulated'),
  visitCount: passMetricValueSchema('visitCount'),
  stampCount: passMetricValueSchema('stampCount'),
});
export type PassValuesMetrics = z.infer<typeof passValuesMetricsSchema>;

/**
 * The derived current state of a holder's Pass runtime values.
 *
 * `expiryDate` is an ISO `YYYY-MM-DD` date (or `null` for a card that
 * never expires). It is a DATE, not a timestamp — the Wallet renders
 * it as a calendar date, and the expiry is a business date that must
 * not shift with the server's timezone.
 */
export const passValuesSnapshotSchema = z.object({
  metrics: passValuesMetricsSchema,
  expiryDate: passExpiryDateSchema.nullable(),
});
export type PassValuesSnapshot = z.infer<typeof passValuesSnapshotSchema>;

/**
 * The `registered` event — the opening fact of every holder's ledger.
 *
 * Carries the metrics the holder starts with (e.g. a gift card starts
 * with the purchased points) and the card's expiry date.
 */
export const passRegisteredEventSchema = z.object({
  type: z.literal('registered'),
  /** ISO timestamp of the fact. */
  at: passEventTimestampSchema,
  payload: z.object({
    metrics: passValuesMetricsSchema,
    expiryDate: passExpiryDateSchema.nullable(),
  }),
});
export type PassRegisteredEvent = z.infer<typeof passRegisteredEventSchema>;

/**
 * The `metric_delta` event — a numeric increment / decrement of ONE
 * metric.
 *
 * This is deliberately generic (metric name + delta) rather than a
 * family of near-identical `points_delta` / `spend_delta` events: the
 * reducer is the same either way, and the Scanner phase — which owns
 * the same-day / replay / refund semantics — can add richer event
 * variants later without changing the reducer's shape.
 *
 * The event carries NO de-duplication semantics. Whether two identical
 * deltas should collapse (same-day duplicate scan, request replay) is
 * decided by the Scanner contract, not here.
 */
export const passMetricDeltaEventSchema = z.object({
  type: z.literal('metric_delta'),
  /** ISO timestamp of the fact. */
  at: passEventTimestampSchema,
  payload: z
    .object({
      metric: passValueMetricSchema,
      /** Signed change. May be negative (a redemption / a refund). */
      delta: z.number(),
    })
    .superRefine((payload, ctx) => {
      if (
        isIntegerPassValueMetric(payload.metric) &&
        !Number.isInteger(payload.delta)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['delta'],
          message: 'delta must be an integer for this metric',
        });
      }
    }),
});
export type PassMetricDeltaEvent = z.infer<typeof passMetricDeltaEventSchema>;

/**
 * The full event union.
 *
 * `registered` + `metric_delta` are the two events this round
 * implements. The Scanner-phase plan adds further variants (visit,
 * stamp, coupon redemption, refund) — they will be added HERE, as
 * additional discriminated-union members, and the reducer will learn
 * to fold them.
 */
export const passEventSchema = z.discriminatedUnion('type', [
  passRegisteredEventSchema,
  passMetricDeltaEventSchema,
]);
export type PassEvent = z.infer<typeof passEventSchema>;

/**
 * The event type union — handy for switch statements and for building
 * the DB CHECK constraint in migration 028.
 */
export const PASS_EVENT_TYPES = ['registered', 'metric_delta'] as const;
export type PassEventType = (typeof PASS_EVENT_TYPES)[number];

/**
 * Build the all-zero metric set.
 *
 * A fresh holder starts with every metric at zero — except the gift
 * card, whose opening balance comes from the purchase.
 */
export function emptyPassValuesMetrics(): PassValuesMetrics {
  return {
    giftPoints: 0,
    pointsBalance: 0,
    carryoverBalance: 0,
    spendAccumulated: 0,
    visitCount: 0,
    stampCount: 0,
  };
}
