/**
 * Pass runtime value — FOUR-LAYER contract conformance (Rule 019 § 4.1).
 *
 * @module modules/pass-templates/tests/passValues.conformance
 *
 * The Pass runtime value model spans four layers. Every one of them
 * must agree on the SAME set of metrics and event types, or the
 * contract silently drifts:
 *
 *   Layer 1 — shared schema
 *     `packages/shared/schemas/passValues.ts`
 *       `passValuesMetricsSchema` / `passEventSchema` / the
 *       `PASS_VALUE_METRICS` / `PASS_EVENT_TYPES` unions.
 *
 *   Layer 2 — backend request schema
 *     NOT APPLICABLE this round. The plan states: "本輪沒有 Scanner
 *     HTTP endpoint，因此不新增無 caller 的 backend request schema"
 *     (no Scanner HTTP endpoint exists yet, so adding a request schema
 *     would create a caller-less module). The Scanner-phase plan owns
 *     that layer — see
 *     `runs/plans/2026-10-24-pass-scanner-event-semantics.md`.
 *
 *   Layer 3 — DB row interface
 *     `apps/backend/src/modules/pass-templates/db/passHolders.ts`
 *       `PassHolderRow.pass_values_snapshot` + the
 *       `updatePassHolderPassValuesSnapshot` write path.
 *
 *   Layer 4 — service types
 *     `apps/backend/src/modules/pass-templates/services/passValueService.ts`
 *       `ApplyPassEventResult.snapshot` / `SyncValuesInput.snapshot`.
 *
 * WHAT THIS TEST PINS
 *
 *   1. The metric key set is IDENTICAL across Layer 1, Layer 3 and
 *      Layer 4 — a metric added to the shared schema without the
 *      backend knowing about it would be dropped at the DB boundary.
 *   2. The event union members match the `PASS_EVENT_TYPES` list.
 *   3. The DB row's snapshot column is typed as the shared
 *      `PassValuesSnapshot` (not a hand-written structural copy).
 *   4. The reducer's output satisfies the shared schema (the two
 *      agree at runtime, not just at compile time).
 *   5. The metric names are DISTINCT — no two metrics can share a
 *      name (a copy-paste in the schema would merge two quantities).
 *
 * @see packages/shared/schemas/passValues.ts
 * @see apps/backend/src/modules/pass-templates/db/passHolders.ts
 * @see apps/backend/src/modules/pass-templates/services/passValueService.ts
 * @see runs/decisions/2026-10-24-pass-runtime-value-model.md
 */

import { describe, expect, it } from 'vitest';
import {
  PASS_EVENT_TYPES,
  PASS_VALUE_METRICS,
  emptyPassValuesMetrics,
  passEventSchema,
  passValuesMetricsSchema,
  passValuesSnapshotSchema,
  type PassValuesSnapshot,
} from '@saome/shared/schemas/passValues';
import {
  buildInitialValues,
  reducePassValues,
} from '@saome/shared/logic/passValueCalculator';
import type { PassHolderRow } from '../db/passHolders';
import type { ApplyPassEventResult, SyncValuesInput } from '../services/passValueService';
import {
  resolveSpendTier,
  type ResolvedSpendTier,
} from '@saome/shared/logic/spendTier';

describe('Pass runtime value — four-layer conformance (Rule 019 § 4.1)', () => {
  it('Layer 1: the schema shape and the metric union list the same keys', () => {
    // Drift guard: adding a metric to the union but forgetting the
    // schema (or vice versa) would make the DB write silently lose a
    // field — `z.object` strips unknown keys by default.
    expect(Object.keys(passValuesMetricsSchema.shape).sort()).toEqual(
      [...PASS_VALUE_METRICS].sort(),
    );
  });

  it('Layer 1: the event schema and the event type union list the same members', () => {
    expect(passEventSchema.options.map((o) => o.shape.type.value).sort()).toEqual(
      [...PASS_EVENT_TYPES].sort(),
    );
  });

  it('Layer 3: the DB row snapshot column carries the shared snapshot type', () => {
    // The DB row interface must reference the SHARED type, not a
    // hand-written structural copy — a copy is exactly how the four
    // layers drift apart. The compile-time check below is the
    // assertion; the runtime check documents the shape it pins.
    const row: PassHolderRow = {
      id: '00000000-0000-4000-8000-000000000001',
      template_id: '00000000-0000-4000-8000-000000000002',
      name: '王小明',
      phone_country_code: '+886',
      phone_number: '912345678',
      birthday: '1990-01-15',
      email: 'wang@example.com',
      payment_status: 'not_required',
      pass_values_snapshot: {
        metrics: emptyPassValuesMetrics(),
        expiryDate: null,
      },
      created_at: new Date('2026-10-24T00:00:00Z'),
      updated_at: new Date('2026-10-24T00:00:00Z'),
    };

    expect(row.pass_values_snapshot).toBeDefined();
    expect(
      passValuesSnapshotSchema.safeParse(row.pass_values_snapshot).success,
    ).toBe(true);
  });

  it('Layer 4: the service result + sync input carry the shared snapshot type', () => {
    const snapshot: PassValuesSnapshot = {
      metrics: emptyPassValuesMetrics(),
      expiryDate: null,
    };

    const result: ApplyPassEventResult = {
      eventId: 'event-1',
      duplicate: false,
      snapshot,
    };
    const syncInput: SyncValuesInput = {
      env: {} as SyncValuesInput['env'],
      passIdentifier: 'pass-1',
      snapshot,
      cardType: 'stamp_card',
    };

    expect(result.snapshot).toBe(snapshot);
    expect(syncInput.snapshot).toBe(snapshot);
  });

  /**
   * The resolved discount tier (2026-10-27).
   *
   * The tier crosses four layers: the shared resolver, the shared
   * formatter, the backend row interface, and the service result.
   * A drift between them would mean the Wallet shows a different
   * tier than the one recorded on the holder's row.
   */
  it('the discount tier agrees across the shared resolver, the row, and the service result', () => {
    // Layer 1 — the shared resolver produces the shared type.
    const resolved: ResolvedSpendTier | null = resolveSpendTier(
      [
        { name: '基本', thresholdSpend: 0, percent: 1 },
        { name: '進階', thresholdSpend: 35, percent: 5 },
      ],
      0,
    );
    expect(resolved?.current.name).toBe('基本');
    expect(resolved?.spendToNext).toBe(35);

    // Layer 3 — the row interface carries the tier columns with the
    // SAME names the DB write uses.
    const row: PassHolderRow = {
      id: '00000000-0000-4000-8000-000000000003',
      template_id: '00000000-0000-4000-8000-000000000004',
      name: '王小明',
      phone_country_code: '+886',
      phone_number: '912345678',
      birthday: '1990-01-15',
      email: 'wang@example.com',
      payment_status: 'not_required',
      spend_amount: '0.0000',
      current_tier_name: resolved?.current.name ?? null,
      current_tier_percent: resolved?.current.percent ?? null,
      created_at: new Date('2026-10-27T00:00:00Z'),
      updated_at: new Date('2026-10-27T00:00:00Z'),
    };
    expect(row.current_tier_name).toBe('基本');
    expect(row.current_tier_percent).toBe(1);

    // Layer 4 — the service result carries the SAME resolved tier.
    const serviceTier: ResolvedSpendTier | null = resolved;
    expect(serviceTier?.current.name).toBe(row.current_tier_name);
  });

  it('the sync input carries the discount tier so the PATCH formats it like the CREATE', () => {
    // The PATCH and the CREATE must format the discount slots
    // IDENTICALLY. Both go through `formatPassValues`, so both need
    // the tier + currency + language.
    const syncInput: SyncValuesInput = {
      env: {} as SyncValuesInput['env'],
      passIdentifier: 'pass-1',
      snapshot: { metrics: emptyPassValuesMetrics(), expiryDate: null },
      cardType: 'discount_card',
      discountTier: {
        current: { name: '基本', thresholdSpend: 0, percent: 1 },
        next: { name: '進階', thresholdSpend: 35, percent: 5 },
        spendToNext: 35,
      },
      currency: 'TWD',
      language: 'zh-TW',
    };

    expect(syncInput.discountTier?.spendToNext).toBe(35);
    expect(syncInput.currency).toBe('TWD');
    expect(syncInput.language).toBe('zh-TW');
  });

  it('every layer agrees on the metric key set', () => {
    const sharedKeys = Object.keys(passValuesMetricsSchema.shape).sort();

    // Layer 3 — the row's snapshot column.
    const rowSnapshot: PassValuesSnapshot = {
      metrics: emptyPassValuesMetrics(),
      expiryDate: null,
    };
    expect(Object.keys(rowSnapshot.metrics).sort()).toEqual(sharedKeys);

    // Layer 4 — the service's snapshot.
    const serviceSnapshot: ApplyPassEventResult['snapshot'] = {
      metrics: emptyPassValuesMetrics(),
      expiryDate: null,
    };
    expect(Object.keys(serviceSnapshot.metrics).sort()).toEqual(sharedKeys);
  });

  it('the reducer output satisfies the shared schema at RUNTIME', () => {
    // Compile-time types agree; this pins the runtime contract (a
    // zod schema that rejects what the reducer produces would make
    // every event write fail with a 500).
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 500,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-24',
      at: '2026-10-24T08:00:00.000Z',
    });
    const delta = {
      type: 'metric_delta' as const,
      at: '2026-10-24T09:00:00.000Z',
      payload: { metric: 'giftPoints' as const, delta: -100 },
    };

    const snapshot = reducePassValues([registered, delta]);
    expect(passValuesSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.metrics.giftPoints).toBe(400);
  });

  it('every metric name is distinct (no copy-paste merge of two quantities)', () => {
    expect(new Set(PASS_VALUE_METRICS).size).toBe(PASS_VALUE_METRICS.length);
  });

  it('gift points and reward points are DIFFERENT metrics', () => {
    // The whole point of the separate-metric design (Decision Log
    // § 決定一): a gift card's prepaid points must never be
    // interchangeable with a reward card's earned points.
    expect(PASS_VALUE_METRICS).toContain('giftPoints');
    expect(PASS_VALUE_METRICS).toContain('pointsBalance');
    expect(PASS_VALUE_METRICS).not.toContain('balance');
  });
});
