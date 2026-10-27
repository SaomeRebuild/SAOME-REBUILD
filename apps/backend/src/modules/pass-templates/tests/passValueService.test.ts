/**
 * Backend Pass runtime value service — conformance tests.
 *
 * @module modules/pass-templates/tests/passValueService
 *
 * These tests pin the transaction boundary and the eventual-consistency
 * contract:
 *
 *   1. Event append, replay, and snapshot write happen in ONE DB
 *      transaction.
 *   2. The event payload is validated before any SQL runs.
 *   3. A duplicate idempotency key is replayed from the ledger, not
 *      applied twice.
 *   4. Passcreator PATCH runs only AFTER the DB transaction commits.
 *   5. A PATCH failure leaves the committed event + snapshot intact and
 *      can be retried from the snapshot without adding the delta again.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from '@/shared/db/client';
import * as passEventsDb from '../db/passEvents';
import * as passHoldersDb from '../db/passHolders';
import * as passcreator from '@/shared/lib/passcreator';
import {
  applyPassEvent,
  isOneRegisteredPerHolderViolation,
  ONE_REGISTERED_PER_HOLDER_CONSTRAINT,
  syncValuesToPasscreator,
} from '../services/passValueService';
import {
  buildInitialValues,
  reducePassValues,
} from '@saome/shared/logic/passValueCalculator';
import type { PassEvent } from '@saome/shared/schemas/passValues';

const HOLDER_ID = '00000000-0000-4000-8000-000000000099';
const IDENTIFIER = 'a0f629e6-6533-40cb-90b8-ef9093bfbb26';

const ENV = {
  PASSCREATOR_API_URL: 'https://app.passcreator.com',
  PASSCREATOR_API_KEY: 'test-key',
  PASSCREATOR_PASS_TYPE_ID: 'pass.saome.org.passcreator',
} as const;

function makeEventRow(event: PassEvent, id = 'event-1') {
  return {
    id,
    pass_holder_id: HOLDER_ID,
    event_type: event.type,
    payload: event.payload,
    occurred_at: event.at,
    created_at: event.at,
    idempotency_key: 'registered:holder-1',
  };
}

function makeSql() {
  const tx = {} as Sql;
  let committed = false;
  const sql = {
    begin: vi.fn(async (callback: (transaction: Sql) => Promise<unknown>) => {
      const result = await callback(tx);
      committed = true;
      return result;
    }),
  } as unknown as Sql;

  return {
    sql,
    tx,
    isCommitted: () => committed,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('applyPassEvent — DB transaction boundary', () => {
  it('validates the event before opening a transaction', async () => {
    const { sql } = makeSql();

    await expect(
      applyPassEvent({
        sql,
        passHolderId: HOLDER_ID,
        event: { type: 'unknown', at: '2026-10-24T00:00:00.000Z', payload: {} } as never,
      }),
    ).rejects.toBeDefined();

    expect(sql.begin).not.toHaveBeenCalled();
  });

  it('appends, replays, and writes the snapshot in ONE transaction', async () => {
    const { sql, tx } = makeSql();
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 500,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-24',
      at: '2026-10-24T08:00:00.000Z',
    });
    const delta: PassEvent = {
      type: 'metric_delta',
      at: '2026-10-24T09:00:00.000Z',
      payload: { metric: 'giftPoints', delta: -100 },
    };

    const appendSpy = vi.spyOn(passEventsDb, 'appendPassEvent').mockResolvedValue({
      row: makeEventRow(registered),
      inserted: true,
    });
    const listSpy = vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      makeEventRow(registered, 'event-1'),
      makeEventRow(delta, 'event-2'),
    ]);
    const snapshotSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderPassValuesSnapshot')
      .mockResolvedValue(undefined);

    const result = await applyPassEvent({
      sql,
      passHolderId: HOLDER_ID,
      event: delta,
      idempotencyKey: 'scanner:tx-1',
    });

    expect(sql.begin).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith(
      tx,
      HOLDER_ID,
      delta,
      'scanner:tx-1',
    );
    expect(listSpy).toHaveBeenCalledWith(tx, HOLDER_ID);
    expect(snapshotSpy).toHaveBeenCalledWith(tx, HOLDER_ID, {
      metrics: {
        giftPoints: 400,
        pointsBalance: 0,
        carryoverBalance: 0,
        spendAccumulated: 0,
        visitCount: 0,
        stampCount: 0,
      },
      expiryDate: null,
    });
    expect(result).toMatchObject({
      eventId: 'event-1',
      duplicate: false,
      snapshot: reducePassValues([registered, delta]),
    });
  });

  it('replays a duplicate event from the ledger without applying it twice', async () => {
    const { sql } = makeSql();
    const registered = buildInitialValues({
      cardType: 'reward_card',
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-24',
    });
    const delta: PassEvent = {
      type: 'metric_delta',
      at: '2026-10-24T09:00:00.000Z',
      payload: { metric: 'pointsBalance', delta: 10 },
    };

    vi.spyOn(passEventsDb, 'appendPassEvent').mockResolvedValue({
      row: makeEventRow(delta, 'event-existing'),
      inserted: false,
    });
    vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      makeEventRow(registered, 'event-registered'),
      makeEventRow(delta, 'event-existing'),
    ]);
    const snapshotSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderPassValuesSnapshot')
      .mockResolvedValue(undefined);

    const result = await applyPassEvent({
      sql,
      passHolderId: HOLDER_ID,
      event: delta,
      idempotencyKey: 'scanner:tx-1',
    });

    expect(result.duplicate).toBe(true);
    expect(result.snapshot.metrics.pointsBalance).toBe(10);
    expect(snapshotSpy).toHaveBeenCalledWith(
      expect.anything(),
      HOLDER_ID,
      expect.objectContaining({
        metrics: expect.objectContaining({ pointsBalance: 10 }),
      }),
    );
  });
});

describe('applyPassEvent — Passcreator runs after commit', () => {
  it('calls PATCH only after the DB transaction has committed', async () => {
    const { sql, isCommitted } = makeSql();
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 500,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-24',
    });

    vi.spyOn(passEventsDb, 'appendPassEvent').mockResolvedValue({
      row: makeEventRow(registered),
      inserted: true,
    });
    vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      makeEventRow(registered),
    ]);
    vi.spyOn(
      passHoldersDb,
      'updatePassHolderPassValuesSnapshot',
    ).mockResolvedValue(undefined);

    const patchSpy = vi
      .spyOn(passcreator, 'updatePassValues')
      .mockImplementation(async () => {
        expect(isCommitted()).toBe(true);
        return { identifier: IDENTIFIER, verified: true, mismatchedFields: [] };
      });

    const result = await applyPassEvent({
      sql,
      passHolderId: HOLDER_ID,
      event: registered,
      idempotencyKey: 'registered:holder-1',
      sync: {
        env: ENV,
        passIdentifier: IDENTIFIER,
        cardType: 'gift_card',
        boundFieldKeys: [],
      },
    });

    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy).toHaveBeenCalledWith(ENV, IDENTIFIER, {
      properties: { giftPoints: 500 },
    });
    expect(result.syncResult).toEqual({
      identifier: IDENTIFIER,
      verified: true,
      mismatchedFields: [],
    });
  });

  it('keeps the committed event + snapshot when PATCH fails', async () => {
    const { sql, isCommitted } = makeSql();
    const registered = buildInitialValues({
      cardType: 'gift_card',
      purchasedPoints: 500,
      expiryRule: { mode: 'never' },
      issuedOn: '2026-10-24',
    });

    vi.spyOn(passEventsDb, 'appendPassEvent').mockResolvedValue({
      row: makeEventRow(registered),
      inserted: true,
    });
    vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      makeEventRow(registered),
    ]);
    const snapshotSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderPassValuesSnapshot')
      .mockResolvedValue(undefined);
    vi.spyOn(passcreator, 'updatePassValues').mockImplementation(async () => {
      expect(isCommitted()).toBe(true);
      throw new Error('Passcreator unavailable');
    });

    await expect(
      applyPassEvent({
        sql,
        passHolderId: HOLDER_ID,
        event: registered,
        idempotencyKey: 'registered:holder-1',
        sync: {
          env: ENV,
          passIdentifier: IDENTIFIER,
          cardType: 'gift_card',
          boundFieldKeys: [],
        },
      }),
    ).rejects.toThrow('Passcreator unavailable');

    // The DB work is already durable; the caller can retry with the same
    // idempotency key and the snapshot will be re-pushed, not re-added.
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
  });
});

describe('syncValuesToPasscreator', () => {
  it('formats the snapshot and PATCHes only the bound keys', async () => {
    const snapshot = reducePassValues([
      buildInitialValues({
        cardType: 'stamp_card',
        expiryRule: { mode: 'never' },
        issuedOn: '2026-10-24',
      }),
    ]);
    const patchSpy = vi
      .spyOn(passcreator, 'updatePassValues')
      .mockResolvedValue({
        identifier: IDENTIFIER,
        verified: true,
        mismatchedFields: [],
      });

    const result = await syncValuesToPasscreator({
      env: ENV,
      passIdentifier: IDENTIFIER,
      snapshot,
      cardType: 'stamp_card',
      boundFieldKeys: ['visitCount', 'phone'],
    });

    // 2026-10-27: the visit counter is a "number + unit" pack, so it
    // is a STRING (`0 次`), not a bare number.
    expect(patchSpy).toHaveBeenCalledWith(ENV, IDENTIFIER, {
      storedValue: 0,
      properties: { balance: 0, visitCount: '0 次' },
    });
    expect(result.verified).toBe(true);
  });

  it('formats the visit counter in the TEMPLATE language (not the zh-TW default)', async () => {
    // 2026-10-27 regression: the event-sync path did not carry the
    // template's language, so an English card's visit counter was
    // written as `5 次` while its initial issuance said `5 times`.
    const snapshot = reducePassValues([
      buildInitialValues({
        cardType: 'stamp_card',
        expiryRule: { mode: 'never' },
        issuedOn: '2026-10-24',
      }),
    ]);
    const patchSpy = vi
      .spyOn(passcreator, 'updatePassValues')
      .mockResolvedValue({
        identifier: IDENTIFIER,
        verified: true,
        mismatchedFields: [],
      });

    await syncValuesToPasscreator({
      env: ENV,
      passIdentifier: IDENTIFIER,
      snapshot,
      cardType: 'stamp_card',
      boundFieldKeys: ['visitCount'],
      language: 'en',
    });

    expect(patchSpy).toHaveBeenCalledWith(
      ENV,
      IDENTIFIER,
      expect.objectContaining({
        properties: expect.objectContaining({ visitCount: '0 times' }),
      }),
    );
  });
});

describe('isOneRegisteredPerHolderViolation — narrowness', () => {
  it('matches the migration 029 partial unique index', () => {
    expect(
      isOneRegisteredPerHolderViolation(
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: ONE_REGISTERED_PER_HOLDER_CONSTRAINT,
          constraint_name: ONE_REGISTERED_PER_HOLDER_CONSTRAINT,
        }),
      ),
    ).toBe(true);
  });

  it('matches when only `constraint_name` is present (postgres.js field name)', () => {
    expect(
      isOneRegisteredPerHolderViolation(
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint_name: ONE_REGISTERED_PER_HOLDER_CONSTRAINT,
        }),
      ),
    ).toBe(true);
  });

  it('does NOT swallow a 23505 from a DIFFERENT constraint', () => {
    // A different unique violation is a real fault, not a replay.
    // Swallowing it would silently reset the holder's runtime state.
    expect(
      isOneRegisteredPerHolderViolation(
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'pass_events_holder_idempotency_unique',
          constraint_name: 'pass_events_holder_idempotency_unique',
        }),
      ),
    ).toBe(false);
  });

  it('does NOT swallow a non-23505 error', () => {
    expect(
      isOneRegisteredPerHolderViolation(
        Object.assign(new Error('connection terminated'), { code: '08006' }),
      ),
    ).toBe(false);
    expect(isOneRegisteredPerHolderViolation(new Error('boom'))).toBe(false);
    expect(isOneRegisteredPerHolderViolation(null)).toBe(false);
    expect(isOneRegisteredPerHolderViolation('not an object')).toBe(false);
  });
});
