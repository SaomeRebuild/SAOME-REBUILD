/**
 * Registration → runtime value wiring — conformance tests.
 *
 * @module modules/pass-templates/tests/register.runtimeValues
 *
 * The registration flow is where a holder's runtime value state is
 * born. These tests pin the contract:
 *
 *   1. A NEW holder gets exactly ONE `registered` event + snapshot,
 *      derived from the shared calculator.
 *   2. An idempotent re-register does NOT append a second event.
 *   3. The FIRST Passcreator issuance carries the initial values, so
 *      the Wallet never shows an empty balance / zero points.
 *   4. The gift card's purchased points are the opening balance; the
 *      purchase amount is NOT recomputed from the template.
 *   5. A Passcreator failure does NOT roll back the ledger — the
 *      event + snapshot stay durable and the holder can retry.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from '@/shared/db/client';
import * as templatesDb from '../db/templates';
import * as passHoldersDb from '../db/passHolders';
import * as passEventsDb from '../db/passEvents';
import * as passcreator from '@/shared/lib/passcreator';
import { registerService } from '../services/registerService';
import { ensureRegistrationRuntimeState } from '../services/passRegistrationService';
import type { PublicTemplateRow } from '../db/templates';
import type { PassHolderRow } from '../db/passHolders';
import { emptyPassValuesMetrics } from '@saome/shared/schemas/passValues';

const TEMPLATE_ID = '716c4244-6c63-496d-a967-6c87cdac605d';

const TEMPLATE_ROW: PublicTemplateRow = {
  id: TEMPLATE_ID,
  name: 'Café Rewards',
  card_type: 'reward_card',
  settings: { logoText: 'Café 咖啡', issuerName: 'Café Rewards Co.' },
  passcreator_template_id: 'pc-tpl-1',
};

const GIFT_TEMPLATE_ROW: PublicTemplateRow = {
  id: TEMPLATE_ID,
  name: 'Gift Card Studio',
  card_type: 'gift_card',
  settings: {
    logoText: 'Gift',
    issuerName: 'Gift Card Studio',
    giftCardAmount: 100,
    giftCardPoints: 10,
    giftCardCheckoutMinPoints: 100,
    giftCardCheckoutMaxPoints: 10_000,
    giftCardCheckoutMinAmount: 100,
    giftCardCheckoutMaxAmount: 10_000,
  },
  // The DB layer projects the six `giftCard*` settings into this
  // object (see `GIFT_CARD_CONFIG_SQL_FRAGMENT` in db/templates.ts).
  // The fixture mirrors what `findPublicTemplateById` actually
  // returns — without it the service sees an unconfigured gift card.
  gift_card_config: {
    giftCardAmount: 100,
    giftCardPoints: 10,
    giftCardCheckoutMinPoints: 100,
    giftCardCheckoutMaxPoints: 10_000,
    giftCardCheckoutMinAmount: 100,
    giftCardCheckoutMaxAmount: 10_000,
  },
  currency: 'TWD',
  passcreator_template_id: 'pc-tpl-gift',
};

const HOLDER: PassHolderRow = {
  id: 'holder-new',
  template_id: TEMPLATE_ID,
  name: '王小明',
  phone_country_code: '+886',
  phone_number: '912345678',
  birthday: '1990-01-15',
  email: 'wang@example.com',
  payment_status: 'not_required',
  created_at: new Date('2026-10-24T08:00:00.000Z'),
  updated_at: new Date('2026-10-24T08:00:00.000Z'),
};

const validPayload = {
  name: '王小明',
  phoneCountryCode: '+886' as const,
  phoneNumber: '912345678',
  birthday: '1990-01-15',
  email: 'wang@example.com',
};

const giftPayload = {
  ...validPayload,
  purchasedPoints: 500,
  paymentProvider: 'ecpay' as const,
  paymentStatus: 'completed' as const,
};

const MOCK_ENV = {
  PASSCREATOR_API_URL: 'https://app.passcreator.com',
  PASSCREATOR_API_KEY: 'test-key',
  PASSCREATOR_PASS_TYPE_ID: 'pass.saome.org.passcreator',
} as const;

function makeMockSql() {
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

describe('ensureRegistrationRuntimeState — DB-level one-registered-per-holder invariant', () => {
  /**
   * Migration 029 added the partial unique index
   * `pass_events_one_registered_per_holder_idx`, so a SECOND
   * `registered` row for the same holder is rejected by Postgres with
   * SQLSTATE 23505 (unique_violation) — even when the idempotency key
   * differs.
   *
   * The application layer must treat that rejection as an IDEMPOTENT
   * REPLAY, not as a server error:
   *   - the holder's existing opening event stays the opening fact,
   *   - the snapshot is derived from the ledger that already exists,
   *   - `duplicate` is true,
   *   - and the caller gets a normal result instead of a raw 500.
   */
  const EXISTING_REGISTERED_ROW = {
    id: 'event-existing',
    pass_holder_id: HOLDER.id,
    event_type: 'registered',
    payload: {
      metrics: { ...emptyPassValuesMetrics(), giftPoints: 500 },
      expiryDate: null,
    },
    occurred_at: '2026-10-24T08:00:00.000Z',
    created_at: '2026-10-24T08:00:00.000Z',
    idempotency_key: 'registered:holder-new',
  };

  /** The error shape Postgres raises for the partial unique index. */
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

  it('treats the DB-level rejection as an idempotent replay (NOT a 500)', async () => {
    vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(
      TEMPLATE_ROW,
    );
    vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({
      row: HOLDER,
      created: true,
    });
    // The DB refuses the second `registered` row.
    const appendSpy = vi
      .spyOn(passEventsDb, 'appendPassEvent')
      .mockRejectedValue(uniqueViolationError());
    // The holder's ledger ALREADY holds an opening event.
    vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      EXISTING_REGISTERED_ROW,
    ]);
    const snapshotSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderPassValuesSnapshot')
      .mockResolvedValue(undefined);
    vi.spyOn(passHoldersDb, 'updatePassHolderIssuance').mockResolvedValue(HOLDER);
    vi.spyOn(passcreator, 'issuePass').mockResolvedValue({
      identifier: 'pass-1',
      downloadPage: 'https://app.passcreator.com/p/1',
      iPhoneUri: 'https://app.passcreator.com/1.pkpass',
      androidUri: 'https://passwallet.page.link/?link=1',
      barcodeValue: null,
    });

    const { sql } = makeMockSql();
    const outcome = await ensureRegistrationRuntimeState(sql, {
      passHolderId: HOLDER.id,
      cardType: TEMPLATE_ROW.card_type,
      settings: TEMPLATE_ROW.settings,
      registeredAt: '2026-10-24T08:00:00.000Z',
    });

    // Clean idempotent outcome — no throw, and the caller is told the
    // opening event already existed.
    expect(outcome.duplicate).toBe(true);
    expect(outcome.eventId).toBe(EXISTING_REGISTERED_ROW.id);
    // The snapshot comes from the EXISTING ledger — the holder keeps
    // the 500 points their opening event recorded. A rejected insert
    // must NOT reset the holder's state to a freshly computed one.
    expect(outcome.snapshot.metrics.giftPoints).toBe(500);
    expect(snapshotSpy).toHaveBeenCalledWith(
      expect.anything(),
      HOLDER.id,
      expect.objectContaining({ metrics: expect.objectContaining({ giftPoints: 500 }) }),
    );
    // The append WAS attempted (the DB is the arbiter) — it is the
    // rejection that is handled, not a skipped write.
    expect(appendSpy).toHaveBeenCalledTimes(1);
  });

  it('re-raises any other failure untouched', async () => {
    vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(
      TEMPLATE_ROW,
    );
    vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({
      row: HOLDER,
      created: true,
    });
    vi.spyOn(passEventsDb, 'appendPassEvent').mockRejectedValue(
      new Error('connection terminated unexpectedly'),
    );

    const { sql } = makeMockSql();
    await expect(
      ensureRegistrationRuntimeState(sql, {
        passHolderId: HOLDER.id,
        cardType: TEMPLATE_ROW.card_type,
        settings: TEMPLATE_ROW.settings,
        registeredAt: '2026-10-24T08:00:00.000Z',
      }),
    ).rejects.toThrow('connection terminated unexpectedly');
  });
});

describe('registerService — runtime value initialization', () => {
  it('creates ONE registered event + snapshot for a new holder', async () => {
    vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(
      TEMPLATE_ROW,
    );
    vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({
      row: HOLDER,
      created: true,
    });
    const appendSpy = vi
      .spyOn(passEventsDb, 'appendPassEvent')
      .mockResolvedValue({
        row: {
          id: 'event-1',
          pass_holder_id: HOLDER.id,
          event_type: 'registered',
          payload: {
            metrics: emptyPassValuesMetrics(),
            expiryDate: null,
          },
          occurred_at: '2026-10-24T08:00:00.000Z',
          created_at: '2026-10-24T08:00:00.000Z',
          idempotency_key: 'registered:holder-new',
        },
        inserted: true,
      });
    vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      {
        id: 'event-1',
        pass_holder_id: HOLDER.id,
        event_type: 'registered',
        payload: {
          metrics: emptyPassValuesMetrics(),
          expiryDate: null,
        },
        occurred_at: '2026-10-24T08:00:00.000Z',
        created_at: '2026-10-24T08:00:00.000Z',
        idempotency_key: 'registered:holder-new',
      },
    ]);
    const snapshotSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderPassValuesSnapshot')
      .mockResolvedValue(undefined);
    vi.spyOn(passHoldersDb, 'updatePassHolderIssuance').mockResolvedValue(HOLDER);
    vi.spyOn(passcreator, 'issuePass').mockResolvedValue({
      identifier: 'pass-1',
      downloadPage: 'https://app.passcreator.com/p/1',
      iPhoneUri: 'https://app.passcreator.com/1.pkpass',
      androidUri: 'https://passwallet.page.link/?link=1',
      barcodeValue: null,
    });

    const { sql } = makeMockSql();
    await registerService(sql, MOCK_ENV as never, TEMPLATE_ID, validPayload as never);

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith(
      expect.anything(),
      HOLDER.id,
      expect.objectContaining({ type: 'registered' }),
      'registered:holder-new',
    );
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
    expect(snapshotSpy).toHaveBeenCalledWith(
      expect.anything(),
      HOLDER.id,
      expect.objectContaining({ metrics: emptyPassValuesMetrics() }),
    );
  });

  it('does NOT append a second event on an idempotent re-register', async () => {
    vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(
      TEMPLATE_ROW,
    );
    vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({
      row: { ...HOLDER, pass_identifier: 'already-issued' },
      created: false,
    });
    const appendSpy = vi
      .spyOn(passEventsDb, 'appendPassEvent')
      .mockResolvedValue({
        row: {
          id: 'event-existing',
          pass_holder_id: HOLDER.id,
          event_type: 'registered',
          payload: {
            metrics: emptyPassValuesMetrics(),
            expiryDate: null,
          },
          occurred_at: '2026-10-24T08:00:00.000Z',
          created_at: '2026-10-24T08:00:00.000Z',
          idempotency_key: 'registered:holder-new',
        },
        inserted: false,
      });
    vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      {
        id: 'event-existing',
        pass_holder_id: HOLDER.id,
        event_type: 'registered',
        payload: {
          metrics: emptyPassValuesMetrics(),
          expiryDate: null,
        },
        occurred_at: '2026-10-24T08:00:00.000Z',
        created_at: '2026-10-24T08:00:00.000Z',
        idempotency_key: 'registered:holder-new',
      },
    ]);
    vi.spyOn(
      passHoldersDb,
      'updatePassHolderPassValuesSnapshot',
    ).mockResolvedValue(undefined);
    vi.spyOn(passHoldersDb, 'updatePassHolderIssuance').mockResolvedValue(HOLDER);
    const issueSpy = vi.spyOn(passcreator, 'issuePass');

    const { sql } = makeMockSql();
    await registerService(sql, MOCK_ENV as never, TEMPLATE_ID, validPayload as never);

    // The event append is idempotent: the DB conflict path returns the
    // existing row and does NOT create a second ledger entry.
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('sends the initial values with the FIRST issuance', async () => {
    vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(
      TEMPLATE_ROW,
    );
    vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({
      row: HOLDER,
      created: true,
    });
    const snapshot = {
      metrics: { ...emptyPassValuesMetrics(), pointsBalance: 0 },
      expiryDate: null,
    };
    vi.spyOn(passEventsDb, 'appendPassEvent').mockResolvedValue({
      row: {
        id: 'event-1',
        pass_holder_id: HOLDER.id,
        event_type: 'registered',
        payload: snapshot,
        occurred_at: '2026-10-24T08:00:00.000Z',
        created_at: '2026-10-24T08:00:00.000Z',
        idempotency_key: 'registered:holder-new',
      },
      inserted: true,
    });
    vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      {
        id: 'event-1',
        pass_holder_id: HOLDER.id,
        event_type: 'registered',
        payload: snapshot,
        occurred_at: '2026-10-24T08:00:00.000Z',
        created_at: '2026-10-24T08:00:00.000Z',
        idempotency_key: 'registered:holder-new',
      },
    ]);
    vi.spyOn(
      passHoldersDb,
      'updatePassHolderPassValuesSnapshot',
    ).mockResolvedValue(undefined);
    vi.spyOn(passHoldersDb, 'updatePassHolderIssuance').mockResolvedValue(HOLDER);
    const issueSpy = vi.spyOn(passcreator, 'issuePass').mockResolvedValue({
      identifier: 'pass-1',
      downloadPage: 'https://app.passcreator.com/p/1',
      iPhoneUri: 'https://app.passcreator.com/1.pkpass',
      androidUri: 'https://passwallet.page.link/?link=1',
      barcodeValue: null,
    });

    const { sql } = makeMockSql();
    await registerService(sql, MOCK_ENV as never, TEMPLATE_ID, validPayload as never);

    expect(issueSpy).toHaveBeenCalledTimes(1);
    // The 4th argument carries the SAME formatter output shape the
    // PATCH client consumes — one wire contract for create + update.
    expect(issueSpy).toHaveBeenCalledWith(
      MOCK_ENV,
      'pc-tpl-1',
      expect.objectContaining({ name: validPayload.name }),
      expect.objectContaining({
        properties: expect.objectContaining({ balance: 0 }),
      }),
    );
  });

  it('uses the gift card purchased points as the opening balance', async () => {
    vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(
      GIFT_TEMPLATE_ROW,
    );
    vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({
      row: { ...HOLDER, purchased_points: 500 },
      created: true,
    });
    const snapshot = {
      metrics: { ...emptyPassValuesMetrics(), giftPoints: 500 },
      expiryDate: null,
    };
    vi.spyOn(passEventsDb, 'appendPassEvent').mockResolvedValue({
      row: {
        id: 'event-gift',
        pass_holder_id: HOLDER.id,
        event_type: 'registered',
        payload: snapshot,
        occurred_at: '2026-10-24T08:00:00.000Z',
        created_at: '2026-10-24T08:00:00.000Z',
        idempotency_key: 'registered:holder-new',
      },
      inserted: true,
    });
    vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      {
        id: 'event-gift',
        pass_holder_id: HOLDER.id,
        event_type: 'registered',
        payload: snapshot,
        occurred_at: '2026-10-24T08:00:00.000Z',
        created_at: '2026-10-24T08:00:00.000Z',
        idempotency_key: 'registered:holder-new',
      },
    ]);
    const snapshotSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderPassValuesSnapshot')
      .mockResolvedValue(undefined);
    vi.spyOn(passHoldersDb, 'updatePassHolderIssuance').mockResolvedValue(HOLDER);
    const issueSpy = vi.spyOn(passcreator, 'issuePass').mockResolvedValue({
      identifier: 'pass-gift',
      downloadPage: 'https://app.passcreator.com/p/gift',
      iPhoneUri: 'https://app.passcreator.com/gift.pkpass',
      androidUri: 'https://passwallet.page.link/?link=gift',
      barcodeValue: null,
    });

    const { sql } = makeMockSql();
    await registerService(sql, MOCK_ENV as never, TEMPLATE_ID, giftPayload as never);

    expect(snapshotSpy).toHaveBeenCalledWith(
      expect.anything(),
      HOLDER.id,
      expect.objectContaining({
        metrics: expect.objectContaining({ giftPoints: 500 }),
      }),
    );
    expect(issueSpy).toHaveBeenCalledWith(
      MOCK_ENV,
      'pc-tpl-gift',
      expect.anything(),
      expect.objectContaining({
        properties: expect.objectContaining({ giftPoints: 500 }),
      }),
    );
    // A gift card's points are NOT a currency balance — the payload
    // must not carry `balance` or `storedValue`.
    const call = issueSpy.mock.calls[0];
    const values = call?.[3] as { properties: Record<string, unknown> };
    expect(values.properties).not.toHaveProperty('balance');
  });

  it('keeps the ledger + snapshot when the FIRST issuance fails', async () => {
    vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(
      TEMPLATE_ROW,
    );
    vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({
      row: HOLDER,
      created: true,
    });
    const snapshot = {
      metrics: emptyPassValuesMetrics(),
      expiryDate: null,
    };
    vi.spyOn(passEventsDb, 'appendPassEvent').mockResolvedValue({
      row: {
        id: 'event-1',
        pass_holder_id: HOLDER.id,
        event_type: 'registered',
        payload: snapshot,
        occurred_at: '2026-10-24T08:00:00.000Z',
        created_at: '2026-10-24T08:00:00.000Z',
        idempotency_key: 'registered:holder-new',
      },
      inserted: true,
    });
    vi.spyOn(passEventsDb, 'listPassEvents').mockResolvedValue([
      {
        id: 'event-1',
        pass_holder_id: HOLDER.id,
        event_type: 'registered',
        payload: snapshot,
        occurred_at: '2026-10-24T08:00:00.000Z',
        created_at: '2026-10-24T08:00:00.000Z',
        idempotency_key: 'registered:holder-new',
      },
    ]);
    const snapshotSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderPassValuesSnapshot')
      .mockResolvedValue(undefined);
    vi.spyOn(passHoldersDb, 'updatePassHolderIssuance').mockResolvedValue(HOLDER);
    vi.spyOn(passcreator, 'issuePass').mockRejectedValue(
      new Error('Passcreator unavailable'),
    );

    const { sql } = makeMockSql();
    const result = await registerService(
      sql,
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    // The registration still succeeds (200 + issuanceError), and the
    // durable ledger state is intact for a later retry.
    expect(result.ok).toBe(true);
    expect(result.issuance?.issuanceError).toBe('passHolder.errors.upstreamFailed');
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
  });
});
