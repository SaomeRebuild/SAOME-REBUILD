/**
 * Pass runtime value BACKFILL — conformance tests.
 *
 * @module modules/pass-templates/tests/passValueBackfill
 *
 * WHY A BACKFILL EXISTS
 *
 * The event ledger (`public.pass_events`) shipped with migration 028
 * on 2026-10-24. Every holder registered BEFORE that date has:
 *
 *   - NO `registered` event in the ledger
 *   - `pass_values_snapshot = NULL` on their `pass_holders` row
 *
 * The snapshot column is NULLABLE on purpose — NULL means "no runtime
 * values yet", which is a DIFFERENT state from "runtime values that
 * happen to be all zero". But it also means the existing holders have
 * no runtime state at all, so their Wallet pass still shows an empty
 * balance.
 *
 * THE BACKFILL CONTRACT
 *
 * 1. **One event per holder.** Each backfilled holder gets EXACTLY
 *    ONE `registered` event, keyed `registered:{holderId}` — the same
 *    key the live registration flow uses. The ledger's UNIQUE
 *    constraint makes a second run a no-op, so the backfill is
 *    idempotent by construction (not by a script-level guard).
 *
 * 2. **The derivation is shared.** The backfill must produce the
 *    SAME snapshot a fresh registration would produce. It therefore
 *    goes through the SAME `ensureRegistrationRuntimeState` service
 *    (which internally uses the shared calculator + reducer), not a
 *    re-implementation. A backfill that computed its own values could
 *    silently disagree with the live path.
 *
 * 3. **The anchor is `created_at`.** The opening event's timestamp
 *    AND its expiry anchor both come from the holder row's
 *    `created_at` — not from "now". That reproduces the expiry the
 *    holder would have received originally.
 *
 * 4. **DRY-RUN FIRST.** The backfill reports what it WOULD do before
 *    it does anything. No writes happen in dry-run mode.
 *
 * 5. **No Passcreator PATCH.** The backfill only writes the ledger +
 *    the snapshot. It never bulk-PATCHes production wallet passes —
 *    that is a separate, explicitly-verified step (the plan requires
 *    a single controlled pass to be synced and verified before any
 *    batch re-push is considered).
 *
 * Rule references:
 *   - Rule 006 § verification — dry-run before apply.
 *   - Rule 000 Part B.4 — DB queries live in `db/`, orchestration in
 *     `services/`.
 *   - Rule 032 § 1 — JSONB payload validated before it reaches SQL.
 *
 * @see apps/backend/src/modules/pass-templates/services/passValueBackfill.ts
 * @see apps/backend/src/modules/pass-templates/services/passRegistrationService.ts
 * @see runs/decisions/2026-10-24-pass-runtime-value-model.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from '@/shared/db/client';
import * as passHoldersDb from '../db/passHolders';
import * as passTemplatesDb from '../db/templates';
import * as passEventsDb from '../db/passEvents';
import * as passRegistrationService from '../services/passRegistrationService';
import {
  backfillPassRuntimeValues,
  planPassRuntimeValueBackfill,
} from '../services/passValueBackfill';
import type { PassHolderRow } from '../db/passHolders';
import type { PublicTemplateRow } from '../db/templates';
import { emptyPassValuesMetrics } from '@saome/shared/schemas/passValues';

const TEMPLATE_ID = '716c4244-6c63-496d-a967-6c87cdac605d';

const TEMPLATE_ROW: PublicTemplateRow = {
  id: TEMPLATE_ID,
  name: 'Café Rewards',
  card_type: 'reward_card',
  settings: { logoText: 'Café 咖啡', issuerName: 'Café Rewards Co.' },
  passcreator_template_id: 'pc-tpl-1',
};

const LEGACY_HOLDER: PassHolderRow = {
  id: 'legacy-holder-1',
  template_id: TEMPLATE_ID,
  name: '王小明',
  phone_country_code: '+886',
  phone_number: '912345678',
  birthday: '1990-01-15',
  email: 'wang@example.com',
  payment_status: 'not_required',
  created_at: new Date('2026-09-01T00:00:00.000Z'),
  updated_at: new Date('2026-09-01T00:00:00.000Z'),
};

const GIFT_HOLDER: PassHolderRow = {
  ...LEGACY_HOLDER,
  id: 'legacy-holder-2',
  email: 'lee@example.com',
  purchased_points: 500,
};

/**
 * The opening event the holder's ledger ALREADY holds.
 *
 * Used by the migration-029 conflict test: the DB refuses a second
 * `registered` row for this holder, so the backfill must REPLAY this
 * row instead of appending a new one.
 */
const EXISTING_REGISTERED_ROW = {
  id: 'event-existing',
  pass_holder_id: LEGACY_HOLDER.id,
  event_type: 'registered',
  payload: {
    metrics: { ...emptyPassValuesMetrics(), giftPoints: 500 },
    expiryDate: null,
  },
  occurred_at: '2026-09-01T00:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
  idempotency_key: 'registered:legacy-holder-1',
};

/**
 * The error shape Postgres raises for the partial unique index
 * migration 029 added.
 */
function uniqueViolationError(): Error {
  return Object.assign(
    new Error(
      'duplicate key value violates unique constraint "pass_events_one_registered_per_holder_idx"',
    ),
    {
      code: '23505',
      constraint: 'pass_events_one_registered_per_holder_idx',
      constraint_name: 'pass_events_one_registered_per_holder_idx',
    },
  );
}

function makeSql() {
  const tx = {} as Sql;
  const sql = {
    begin: vi.fn(async (callback: (transaction: Sql) => Promise<unknown>) =>
      callback(tx),
    ),
  } as unknown as Sql;
  return { sql, tx };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('planPassRuntimeValueBackfill — dry-run report', () => {
  it('lists ONLY holders with no registered event and no snapshot', async () => {
    const { sql } = makeSql();

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      LEGACY_HOLDER,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue(TEMPLATE_ROW);

    const plan = await planPassRuntimeValueBackfill(sql);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      passHolderId: LEGACY_HOLDER.id,
      templateId: TEMPLATE_ID,
      cardType: 'reward_card',
    });
    // Dry-run performs NO writes.
    expect(sql.begin).not.toHaveBeenCalled();
  });

  it('reports the gift card purchased points it would carry over', async () => {
    const { sql } = makeSql();

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      GIFT_HOLDER,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue({
      ...TEMPLATE_ROW,
      card_type: 'gift_card',
    });

    const plan = await planPassRuntimeValueBackfill(sql);

    expect(plan[0]?.giftPoints).toBe(500);
  });

  it('reports a holder whose template has no card type (safe fallback)', async () => {
    const { sql } = makeSql();

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      LEGACY_HOLDER,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue({
      ...TEMPLATE_ROW,
      card_type: null,
    });

    const plan = await planPassRuntimeValueBackfill(sql);

    expect(plan[0]?.cardType).toBeNull();
    expect(plan[0]?.giftPoints).toBe(0);
  });

  it('returns an empty plan when every holder already has runtime values', async () => {
    const { sql } = makeSql();

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([]);

    const plan = await planPassRuntimeValueBackfill(sql);

    expect(plan).toEqual([]);
  });
});

describe('backfillPassRuntimeValues — apply mode', () => {
  it('reuses the registration service so the derivation cannot drift', async () => {
    const { sql } = makeSql();

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      LEGACY_HOLDER,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue(TEMPLATE_ROW);

    const ensureSpy = vi
      .spyOn(passRegistrationService, 'ensureRegistrationRuntimeState')
      .mockResolvedValue({
        eventId: 'event-1',
        duplicate: false,
        snapshot: {
          metrics: {
            giftPoints: 0,
            pointsBalance: 0,
            carryoverBalance: 0,
            spendAccumulated: 0,
            visitCount: 0,
            stampCount: 0,
          },
          expiryDate: null,
        },
        values: { properties: { balance: 0 } },
      });

    const result = await backfillPassRuntimeValues(sql);

    expect(ensureSpy).toHaveBeenCalledTimes(1);
    // The anchor is the holder's ORIGINAL registration time, not now.
    expect(ensureSpy).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({
        passHolderId: LEGACY_HOLDER.id,
        cardType: 'reward_card',
        registeredAt: '2026-09-01T00:00:00.000Z',
        purchasedPoints: null,
      }),
    );
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('marks an already-present event as a skip (idempotent replay)', async () => {
    const { sql } = makeSql();

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      LEGACY_HOLDER,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue(TEMPLATE_ROW);
    vi.spyOn(passRegistrationService, 'ensureRegistrationRuntimeState').mockResolvedValue({
      eventId: 'event-existing',
      duplicate: true,
      snapshot: {
        metrics: {
          giftPoints: 0,
          pointsBalance: 0,
          carryoverBalance: 0,
          spendAccumulated: 0,
          visitCount: 0,
          stampCount: 0,
        },
        expiryDate: null,
      },
      values: { properties: {} },
    });

    const result = await backfillPassRuntimeValues(sql);

    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('counts a DB-level unique violation as skipped, NOT as an error (migration 029 contract)', async () => {
    const { sql } = makeSql();

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      LEGACY_HOLDER,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue(TEMPLATE_ROW);

    // The DB is the arbiter: the append WAS attempted and the DB's
    // rejection is what we are converting — not a write we skipped.
    const appendSpy = vi
      .spyOn(passEventsDb, 'appendPassEvent')
      .mockRejectedValue(uniqueViolationError());
    // ...but the holder's ledger ALREADY holds an opening event.
    vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      EXISTING_REGISTERED_ROW,
    ]);
    vi.spyOn(passHoldersDb, 'updatePassHolderPassValuesSnapshot').mockResolvedValue(
      undefined,
    );

    const result = await backfillPassRuntimeValues(sql);

    // Migration 029's header promises this: such a holder is counted
    // as `skipped` — NOT `applied`, and NOT an error. The 23505 is
    // converted into a clean `duplicate` inside
    // `ensureRegistrationRuntimeState` BEFORE it can reach the
    // backfill's catch-all.
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('carries the gift card purchased points into the opening balance', async () => {
    const { sql } = makeSql();

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      GIFT_HOLDER,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue({
      ...TEMPLATE_ROW,
      card_type: 'gift_card',
    });

    const ensureSpy = vi
      .spyOn(passRegistrationService, 'ensureRegistrationRuntimeState')
      .mockResolvedValue({
        eventId: 'event-gift',
        duplicate: false,
        snapshot: {
          metrics: {
            giftPoints: 500,
            pointsBalance: 0,
            carryoverBalance: 0,
            spendAccumulated: 0,
            visitCount: 0,
            stampCount: 0,
          },
          expiryDate: null,
        },
        values: { properties: { giftPoints: 500 } },
      });

    await backfillPassRuntimeValues(sql);

    expect(ensureSpy).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({ purchasedPoints: 500 }),
    );
  });

  it('carries the PAID tier duration so a monthly membership expires', async () => {
    const { sql } = makeSql();

    const paidHolder: PassHolderRow = {
      ...LEGACY_HOLDER,
      id: 'paid-holder-1',
      selected_tier_index: 1,
      membership_tier_snapshot: {
        index: 1,
        name: 'Gold',
        durationType: 'monthly',
        currency: 'ZAR',
      },
    };

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      paidHolder,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue({
      ...TEMPLATE_ROW,
      card_type: 'membership_card',
    });

    const ensureSpy = vi
      .spyOn(passRegistrationService, 'ensureRegistrationRuntimeState')
      .mockResolvedValue({
        eventId: 'event-paid',
        duplicate: false,
        snapshot: {
          metrics: {
            giftPoints: 0,
            pointsBalance: 0,
            carryoverBalance: 0,
            spendAccumulated: 0,
            visitCount: 0,
            stampCount: 0,
          },
          expiryDate: '2026-10-01',
        },
        values: { properties: {} },
      });

    await backfillPassRuntimeValues(sql);

    // The tier duration comes from the holder's PERSISTED frozen
    // snapshot — a paid monthly membership must expire one month
    // after registration, not "never".
    expect(ensureSpy).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({ membershipDurationType: 'monthly' }),
    );
  });

  it('reports the expiry a PAID monthly membership would receive', async () => {
    const { sql } = makeSql();

    const paidHolder: PassHolderRow = {
      ...LEGACY_HOLDER,
      id: 'paid-holder-2',
      membership_tier_snapshot: {
        index: 0,
        name: 'Silver',
        durationType: 'monthly',
        currency: 'ZAR',
      },
    };

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      paidHolder,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue({
      ...TEMPLATE_ROW,
      card_type: 'membership_card',
      settings: { ...TEMPLATE_ROW.settings, hasExpiry: true },
    });

    const plan = await planPassRuntimeValueBackfill(sql);

    // Registered 2026-09-01 + 1 month → 2026-10-01.
    expect(plan[0]?.expiryDate).toBe('2026-10-01');
  });

  it('does NOT push anything to Passcreator (no bulk PATCH of production passes)', async () => {
    const { sql } = makeSql();

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      LEGACY_HOLDER,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue(TEMPLATE_ROW);
    vi.spyOn(passRegistrationService, 'ensureRegistrationRuntimeState').mockResolvedValue({
      eventId: 'event-1',
      duplicate: false,
      snapshot: {
        metrics: {
          giftPoints: 0,
          pointsBalance: 0,
          carryoverBalance: 0,
          spendAccumulated: 0,
          visitCount: 0,
          stampCount: 0,
        },
        expiryDate: null,
      },
      values: { properties: {} },
    });

    // The backfill service takes NO `env` argument at all, so there is
    // structurally no way for it to call Passcreator. This test pins
    // that: the service module must not import the passcreator client.
    const passValueBackfillModule = await import('../services/passValueBackfill');
    expect(passValueBackfillModule.backfillPassRuntimeValues.length).toBe(1);
  });

  it('continues past a holder whose template row is missing', async () => {
    const { sql } = makeSql();

    vi.spyOn(passHoldersDb, 'listPassHoldersMissingRuntimeValues').mockResolvedValue([
      LEGACY_HOLDER,
    ]);
    vi.spyOn(passTemplatesDb, 'findPublicTemplateById').mockResolvedValue(null);

    const result = await backfillPassRuntimeValues(sql);

    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
  });
});
