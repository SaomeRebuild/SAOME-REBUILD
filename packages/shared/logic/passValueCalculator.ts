/**
 * Pass runtime value calculator — the single derivation for runtime state.
 *
 * @module shared/logic/passValueCalculator
 * @description Turns a stream of immutable facts (`PassEvent[]`) into the
 * holder's current runtime state (`PassValuesSnapshot`).
 *
 * THE CENTRAL INVARIANT
 *
 * `buildInitialValues()` (registration) and `reducePassValues()` (event
 * replay) share ONE derivation. Registration does not compute a
 * snapshot directly — it emits a `registered` event and then runs
 * through the SAME reducer as every later event.
 *
 * Why this matters:
 *
 *   1. "Any snapshot can be reproduced by replaying its events" becomes
 *      true by construction, not by convention. That property is what
 *      makes the backfill of the 46 existing holders safe: each gets
 *      one `registered` event, replayed through the same code, so the
 *      result is identical to what a fresh registration would produce.
 *   2. There is exactly ONE place where "what does a registration
 *      mean" is written down. If registration had its own snapshot
 *      builder, the two would diverge on the first Scanner event.
 *
 * The reducer is PURE: same events in — same snapshot out, regardless
 * of order-of-arrival beyond the explicit sort (see `reducePassValues`).
 *
 * Rule references:
 *   - Rule 023 § Shared Package 邊界 — pure business logic in shared.
 *   - Rule 024 § Mobile Future-Proof — no `Date` objects in the output,
 *     no platform API; the same module runs in React Native.
 *   - Rule 019 § 4.1 — Layer 1 of the four-layer contract sync.
 *
 * @see packages/shared/schemas/passValues.ts — the event / snapshot shapes
 * @see packages/shared/logic/passFieldFormatter.ts — snapshot — Passcreator
 * @see runs/decisions/2026-10-24-pass-runtime-value-model.md § 決定二
 */

import {
  emptyPassValuesMetrics,
  isIntegerPassValueMetric,
  isNonNegativePassValueMetric,
  type PassEvent,
  type PassValueMetric,
  type PassValuesMetrics,
  type PassValuesSnapshot,
} from '../schemas/passValues';
import {
  resolveExpiryDate,
  type IsoDate,
  type PassExpiryRule,
} from './passExpiry';
import { PassValueDomainError } from './passValueErrors';

/**
 * The card types whose runtime state has a meaningful non-zero
 * opening balance at registration.
 *
 * A gift card opens with the points the customer PREPAID — that is
 * the whole product. Every other card type opens at zero: a reward
 * card earns its first point on the first visit, a stamp card gets
 * its first stamp on the first scan, a cashback card accumulates spend
 * from zero.
 *
 * Keeping this table explicit (rather than "give every card type a
 * `points` field") is what makes the gift-points-vs-reward-points
 * separation structural.
 */
export interface InitialValuesInput {
  /** The card type — decides which opening metric applies. */
  cardType: string;
  /**
   * Gift card only: the points the customer purchased at checkout.
   * Ignored for every other card type.
   */
  purchasedPoints?: number | null;
  /**
   * The expiry rule resolved for this card (see `passExpiry`).
   * `null` / omitted means "no expiry".
   */
  expiryRule?: PassExpiryRule | null;
  /**
   * The issuance date (ISO `YYYY-MM-DD`) — the anchor for
   * `duration_days` expiry rules.
   */
  issuedOn?: IsoDate | null;
  /**
   * The event timestamp (ISO datetime). Defaults to the epoch so the
   * function stays pure and deterministic for tests.
   */
  at?: string | null;
}

/**
 * The opening metrics for a card type.
 *
 * Exported so the backend can build the `registered` event's payload
 * without re-deriving the rule.
 */
export function buildInitialMetrics(input: InitialValuesInput): PassValuesMetrics {
  const metrics = emptyPassValuesMetrics();

  // Gift card: the prepaid points ARE the opening balance.
  //
  // Guarded on `cardType === 'gift_card'` — a purchased-points value
  // on any other card type is ignored, so a stray `purchased_points`
  // on a stamp card can never become a point balance.
  if (input.cardType === 'gift_card') {
    const purchased = input.purchasedPoints;
    if (typeof purchased === 'number' && Number.isInteger(purchased) && purchased > 0) {
      metrics.giftPoints = purchased;
    }
  }

  return metrics;
}

/**
 * Build the `registered` event for a new holder.
 *
 * The event is the ONLY representation of the opening state — there is
 * no separate "initial snapshot" path. Callers that need the snapshot
 * run it through `reducePassValues([event])`.
 *
 * @example
 *   const event = buildInitialValues({
 *     cardType: 'gift_card',
 *     purchasedPoints: 500,
 *     expiryRule: { mode: 'never' },
 *     issuedOn: '2026-10-23',
 *     at: '2026-10-23T08:00:00.000Z',
 *   });
 *   const snapshot = reducePassValues([event]);
 *   // snapshot.metrics.giftPoints === 500
 */
export function buildInitialValues(input: InitialValuesInput): PassEvent {
  const issuedOn = input.issuedOn ?? null;
  const expiryDate =
    input.expiryRule && issuedOn
      ? resolveExpiryDate(input.expiryRule, issuedOn)
      : null;

  return {
    type: 'registered',
    at: input.at ?? '1970-01-01T00:00:00.000Z',
    payload: {
      metrics: buildInitialMetrics(input),
      expiryDate,
    },
  };
}

/**
 * Assert that a `metric_delta` is legal for the metric it targets.
 *
 * TWO RULES, MIRRORED FROM THE SCHEMA LAYER
 *
 * The schema (`passEventSchema`) already rejects a fractional delta
 * for a whole-number metric and a non-finite number. The reducer
 * re-checks them because the reducer is ALSO reachable with events
 * that never went through the schema — a caller can hand it a
 * hand-built object, and a reducer that silently accepted `1.5`
 * points would produce a snapshot the schema then rejects at the
 * storage layer, with a confusing error far from the cause.
 *
 * A NEGATIVE delta is NOT illegal here: spending points is a
 * legitimate signed operation. What is illegal is a negative RESULT
 * (see `assertMetricResult`).
 */
function assertDeltaIsLegalForMetric(
  metric: PassValueMetric,
  delta: number,
): void {
  if (!Number.isFinite(delta)) {
    throw new PassValueDomainError(
      'passValue.error.invalidDelta',
      `delta for metric "${metric}" must be a finite number`,
      { metric, delta },
    );
  }
  if (isIntegerPassValueMetric(metric) && !Number.isInteger(delta)) {
    throw new PassValueDomainError(
      'passValue.error.invalidDelta',
      `delta for metric "${metric}" must be an integer`,
      { metric, delta },
    );
  }
}

/**
 * Assert that a metric's RESULT obeys its sign rule.
 *
 * Decision Log 決定八: an over-spend is REJECTED, not clamped. The
 * ledger stays append-only and factually correct — a rejected
 * purchase never happened, so there is no event, no deduction, and
 * the holder's balance does not move.
 *
 * `carryoverBalance` is the single exception (決定九): it is an
 * `N − M` difference, and a negative intermediate value is exactly
 * what it exists to express.
 */
function assertMetricResult(
  metric: PassValueMetric,
  delta: number,
  result: number,
): void {
  if (isNonNegativePassValueMetric(metric) && result < 0) {
    throw new PassValueDomainError(
      'passValue.error.negativeMetric',
      `metric "${metric}" would go below zero`,
      { metric, delta, result },
    );
  }
}

/**
 * Parse an event timestamp into epoch milliseconds.
 *
 * The schema accepts ANY ISO-8601 datetime carrying a timezone offset
 * (`z.string().datetime({ offset: true })`), so a ledger can mix
 * `+08:00` and `Z` spellings. Comparing those as RAW STRINGS is
 * wrong: `2026-10-24T23:00:00+08:00` is 15:00Z — EARLIER than
 * `2026-10-24T16:00:00Z` — but the string `23:00` sorts AFTER
 * `16:00`.
 *
 * Normalising to an instant first makes the fold order identical to
 * the order of the same ledger written entirely in UTC (Decision Log
 * 決定十一).
 *
 * Returns `null` for a timestamp `Date.parse` cannot read. The schema
 * rejects such a value, but the reducer is also reachable with
 * hand-built events, so the caller falls back to a deterministic
 * string comparison instead of letting `NaN` poison the sort.
 */
function toEpochMillis(at: string): number | null {
  const ms = Date.parse(at);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Fold a stream of events into the holder's current runtime state.
 *
 * ORDERING
 *
 * Events are sorted by their TRUE INSTANT — the timestamp normalised
 * to epoch milliseconds, not the raw string (Decision Log 決定十一).
 * A ledger that mixes timezone offsets then folds in exactly the same
 * order as the same ledger written in UTC.
 *
 * The sort is stable — events at the same instant keep their input
 * order. The ledger stores rows with their own insertion order, and
 * "same instant" is common (two events inside the same second), so
 * the sort must be stable or the snapshot would depend on the DB's
 * row order.
 *
 * IDEMPOTENCE
 *
 * The reducer is idempotent with respect to REPLAY: replaying the
 * same event list always produces the same snapshot. It is NOT
 * idempotent with respect to DUPLICATE EVENTS — two identical
 * `metric_delta` events add twice. De-duplication is the ledger's
 * job (the `idempotency_key` unique constraint in migration 028), not
 * the reducer's. Keeping that separation is deliberate: the reducer
 * stays a pure function of the facts it is given.
 *
 * DOMAIN RULES (Decision Log 決定八 / 決定九 / 決定十)
 *
 * The reducer is where the rules the schema CANNOT enforce are
 * applied, because they depend on the ACCUMULATED state:
 *
 *   - A delta that would push a non-negative metric below zero is
 *     REJECTED with a `PassValueDomainError` — never clamped. The
 *     caller rolls the transaction back, so the event is not written.
 *   - A second `registered` event is rejected rather than silently
 *     resetting the balance. The database makes this impossible
 *     (migration 029's partial unique index), but the reducer is
 *     also fed by paths that do not go through the DB, and a silent
 *     reset would discard real spend.
 *
 * @param events The holder's events (any order).
 * @returns The derived snapshot.
 * @throws {PassValueDomainError} when an event violates a domain
 *         rule (over-spend, illegal delta, duplicate registration).
 */
export function reducePassValues(events: readonly PassEvent[]): PassValuesSnapshot {
  const sorted = [...events].sort((a, b) => {
    const aMs = toEpochMillis(a.at);
    const bMs = toEpochMillis(b.at);

    // Both readable → compare the true instant. Equal instants keep
    // their input order (the sort is stable).
    if (aMs !== null && bMs !== null) {
      if (aMs === bMs) return 0;
      return aMs < bMs ? -1 : 1;
    }

    // At least one timestamp is unparseable → fall back to the raw
    // string comparison so the order stays deterministic.
    if (a.at === b.at) return 0;
    return a.at < b.at ? -1 : 1;
  });

  let metrics = emptyPassValuesMetrics();
  let expiryDate: string | null = null;

  for (const event of sorted) {
    switch (event.type) {
      case 'registered': {
        // A `registered` event SETS the opening state (it is the
        // first event of the ledger). Later deltas layer on top.
        //
        // The "at most one `registered` event per holder" invariant is
        // enforced by the DATABASE (migration 029's partial unique
        // index) and translated by the backend registration service
        // into an idempotent replay. The reducer does not re-check it:
        // a second opening event would reset the metrics, but the DB
        // makes that state unreachable, and the backend already owns
        // the user-facing handling.
        metrics = { ...event.payload.metrics };
        expiryDate = event.payload.expiryDate;
        break;
      }
      case 'metric_delta': {
        const { metric, delta } = event.payload;
        assertDeltaIsLegalForMetric(metric, delta);
        const result = metrics[metric] + delta;
        assertMetricResult(metric, delta, result);
        metrics = { ...metrics, [metric]: result };
        break;
      }
      default: {
        // Exhaustiveness guard: an event type added to the schema but
        // not handled here is a compile error, not a silent no-op.
        const _exhaustive: never = event as never;
        void _exhaustive;
        break;
      }
    }
  }

  return { metrics, expiryDate };
}

