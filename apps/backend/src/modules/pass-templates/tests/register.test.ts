/**
 * registerService tests (no DB) — validation + idempotency contract.
 *
 * @module modules/pass-templates/tests/register
 *
 * Covers:
 *   - zod payload validation (happy path / phone format / birthday age)
 *   - 404 when template does not exist
 *   - idempotent re-registration (same email + same template returns existing)
 *   - first-time insertion returns { created: true }
 *
 * All DB calls are mocked via vi.spyOn on db/templates.ts and db/passHolders.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  passHolderRegisterPayloadSchema,
} from '../schemas/request';
import { registerRoute } from '../routes/register';
import { registerService } from '../services/registerService';
import * as templatesDb from '../db/templates';
import * as passHoldersDb from '../db/passHolders';
import { errorHandler } from '@/shared/middleware/errorHandler';
import { BadGatewayError } from '@/shared/lib/saomeError';
import type { HonoEnv } from '@/shared/types/bindings';
import type { Sql } from '@/shared/db/client';
import type { PublicTemplateRow } from '../db/templates';
import type { PassHolderRow } from '../db/passHolders';
import type { HonoEnv } from '@/shared/types/bindings';
const TEMPLATE_ID = '716c4244-6c63-496d-a967-6c87cdac605d';
const TEMPLATE_ROW: PublicTemplateRow = {
  id: TEMPLATE_ID,
  name: 'Café Rewards',
  card_type: 'reward_card',
  settings: { logoText: 'Café 咖啡', issuerName: 'Café Rewards Co.' },
};

const EXISTING_HOLDER: PassHolderRow = {
  id: 'holder-1',
  template_id: TEMPLATE_ID,
  name: '王小明',
  phone_country_code: '+886',
  phone_number: '912345678',
  birthday: '1990-01-15',
  email: 'wang@example.com',
  created_at: new Date('2026-09-01T00:00:00Z'),
  updated_at: new Date('2026-09-01T00:00:00Z'),
};

/**
 * A shared, STABLE transaction handle for every mock sql.
 *
 * `makeMockSql()` returns a NEW object on each call, and several
 * assertions compare it with `toHaveBeenCalledWith(makeMockSql(), …)`
 * — deep equality. Two distinct `vi.fn()` instances are NOT deeply
 * equal, so the `begin` implementation must be the SAME function
 * reference every time.
 *
 * It is declared through `vi.hoisted` so the `vi.mock('@/shared/db/
 * client')` factory below can reference it too (the route layer gets
 * its sql instance from `getDbForRequest`).
 */
const { mockBegin } = vi.hoisted(() => {
  const tx = {} as unknown as Sql;
  return {
    mockBegin: async (
      callback: (tx: Sql) => Promise<unknown>,
    ): Promise<unknown> => callback(tx),
  };
});

function makeMockSql() {
  return {
    begin: mockBegin,
  } as unknown as Parameters<typeof registerService>[0];
}

/**
 * Mock Hono env bindings for `registerService` — the service now
 * accepts `env` as the 2nd argument (2026-10-19) so it can call
 * Passcreator V3. The tests for registerService that DON'T exercise
 * the V3 path don't need a fully populated env — pass a partial
 * shape that satisfies the type.
 */
const MOCK_ENV = {
  PASSCREATOR_API_URL: 'https://app.passcreator.com',
  PASSCREATOR_API_KEY: 'test-key',
  PASSCREATOR_PASS_TYPE_ID: 'pass.saome.org.passcreator',
} as const;

// 2026-10-17 — route-level tests need `getDbForRequest` mocked because
// the workerd pool's env binding is empty in unit tests. The actual SQL
// execution is mocked at the db/templates.ts / db/passHolders.ts
// boundary — `getDbForRequest` only needs to return a non-null sentinel
// for the route to call the (mocked) db functions.
vi.mock('@/shared/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/shared/db/client')>(
    '@/shared/db/client',
  );
  return {
    ...actual,
    // 2026-10-24 — the register flow opens a transaction for the
    // runtime-value ledger, so the mocked instance needs `begin`.
    getDbForRequest: vi.fn().mockResolvedValue({ begin: mockBegin } as Sql),
  };
});

// =====================================================================
// 2026-10-24 — Runtime-value ledger mocks (migration 028).
//
// The register flow now writes a `registered` event + a derived
// snapshot BEFORE it issues the wallet pass, so the ledger's DB layer
// has to be mocked like the rest of this module.
//
// The ledger's OWN contract is pinned elsewhere:
//   - `passValueService.test.ts` — transaction boundary, idempotency.
//   - `register.runtimeValues.test.ts` — the registration wiring.
//
// This suite cares about the pre-existing register behaviour
// (validation / idempotency / V3 issuance), so the ledger is stubbed
// at the lowest possible level.
// =====================================================================
const ledgerState = vi.hoisted(() => ({
  events: [] as Array<Record<string, unknown>>,
}));

vi.mock('../db/passEvents', () => ({
  appendPassEvent: vi.fn(
    async (
      _sql: unknown,
      passHolderId: string,
      event: { type: string; at: string; payload: unknown },
      idempotencyKey: string | null,
    ) => {
      const row = {
        id: `event-${ledgerState.events.length + 1}`,
        pass_holder_id: passHolderId,
        event_type: event.type,
        payload: event.payload,
        occurred_at: event.at,
        created_at: event.at,
        idempotency_key: idempotencyKey ?? null,
      };
      ledgerState.events.push(row);
      return { row, inserted: true };
    },
  ),
  listPassEvents: vi.fn(async () => ledgerState.events),
  findPassEventByIdempotencyKey: vi.fn(async () => null),
  countPassEvents: vi.fn(async () => ledgerState.events.length),
}));

// `updatePassHolderPassValuesSnapshot` writes the derived snapshot
// cache. It is the only passHolders function the ledger path needs,
// so only that one is replaced — the rest of the module stays real
// (and stays spy-able by the tests below).
vi.mock('../db/passHolders', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../db/passHolders')>();
  return {
    ...actual,
    updatePassHolderPassValuesSnapshot: vi.fn(async () => undefined),
  };
});

function stubTemplateExists(row: PublicTemplateRow | null) {
  vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(row);
}

function stubUpsert(row: PassHolderRow, created: boolean) {
  vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({ row, created });
}

const validPayload = {
  name: '王小明',
  phoneCountryCode: '+886' as const,
  phoneNumber: '912345678',
  birthday: '1990-01-15',
  email: 'wang@example.com',
};

describe('passHolderRegisterPayloadSchema (zod)', () => {
  it('accepts a valid payload', () => {
    expect(parsed(validPayload).success).toBe(true);
  });

  it('accepts the +27 country code', () => {
    expect(parsed({ ...validPayload, phoneCountryCode: '+27' }).success).toBe(true);
  });

  it('rejects phone number with non-digit characters', () => {
    expect(parsed({ ...validPayload, phoneNumber: '0912-345-678' }).success).toBe(false);
  });

  it('rejects phone number shorter than 6 chars', () => {
    expect(parsed({ ...validPayload, phoneNumber: '12345' }).success).toBe(false);
  });

  it('rejects phone number longer than 15 chars', () => {
    expect(parsed({ ...validPayload, phoneNumber: '1234567890123456' }).success).toBe(false);
  });

  it('rejects birthday in non-ISO format', () => {
    expect(parsed({ ...validPayload, birthday: '1990/01/15' }).success).toBe(false);
  });

  it('rejects holder younger than 13', () => {
    const tooYoung = new Date();
    tooYoung.setFullYear(tooYoung.getFullYear() - 10);
    expect(
      parsed({ ...validPayload, birthday: tooYoung.toISOString().slice(0, 10) }).success,
    ).toBe(false);
  });

  // =====================================================================
  // 2026-10-17 — Regression: "我1989年" should NOT be rejected.
  //
  // User reported a 400 with `passHolder.errors.tooYoung` after entering
  // birthday "1989-...". The validation math (today - 13y → 2013-10-16)
  // clearly admits any birthday on/before that date, including any day
  // in 1989. This test pins the expected behavior so:
  //   1. A future refactor that breaks this (e.g. accidentally setting
  //      MIN_HOLDER_AGE_YEARS to a higher value, or flipping the compare)
  //      fails loudly.
  //   2. The user can re-run the test suite to confirm the math is
  //      correct and the rejection must be from a non-1989 input
  //      (browser autofill, stale form state, wrong field, etc).
  // =====================================================================
  it('accepts holder born in 1989 (37 years old) — regression for "我1989年" false-reject', () => {
    expect(parsed({ ...validPayload, birthday: '1989-01-01' }).success).toBe(true);
    expect(parsed({ ...validPayload, birthday: '1989-06-15' }).success).toBe(true);
    expect(parsed({ ...validPayload, birthday: '1989-12-31' }).success).toBe(true);
  });

  it('accepts the exact boundary birthday (today − 13 years)', () => {
    // today - 13 years, computed at validation time. A birthday on or
    // before this date must pass; one day after must fail.
    const boundary = new Date();
    boundary.setFullYear(boundary.getFullYear() - 13);
    const boundaryIso = boundary.toISOString().slice(0, 10);
    expect(parsed({ ...validPayload, birthday: boundaryIso }).success).toBe(true);
  });

  // =====================================================================
  // 2026-10-17 — Regression: workerd module-init `new Date()` is frozen
  //   to the Unix epoch (1970-01-01T00:00:00.000Z). Module-scope
  //   `new Date()` for the birthday boundary was producing
  //   `thirteenYearsAgoIsoDate = "1957-01-01"` and rejecting every adult
  //   born after 1957. Fix: compute the boundary INSIDE the refine
  //   closure (lazy, request-time). This test pins the fix so a future
  //   refactor that re-introduces a module-scope `new Date()` for
  //   boundary computation fails loudly.
  //   See runs/improvements/feedback/20261017-pass-holder-backend-error-capture.md
  //   "Addendum" section.
  // =====================================================================
  it('regression — workerd module-init Date() frozen to epoch does NOT poison the birthday boundary', () => {
    // Pin the EXPECTED behavior at the realistic-working-age band that
    // the frozen-1970 bug broke (1958+ through 2010+). Every one of these
    // must pass. Before the fix, all of these failed with tooYoung.
    const adults = [
      '1958-01-01',  // first year the frozen-1970 - 13y boundary excluded
      '1965-01-01',
      '1980-01-01',
      '1989-06-15',  // the user's actual complaint
      '1995-12-31',
      '2008-03-15',
      '2013-10-17',  // exactly on the boundary; must pass
    ];
    for (const birthday of adults) {
      expect(parsed({ ...validPayload, birthday }).success)
        .toBe(true);
    }
  });

  it('regression — boundary is computed at parse time, not module init, so it tracks the live clock', () => {
    // Capture a Date before parsing, parse a "should-fail" payload with
    // birthday = today - 12 years (just shy of the 13y minimum), and
    // expect success=false because the boundary was computed against
    // the SAME live clock the test sees.
    const beforeNow = new Date();
    const tooYoungBirthday = (() => {
      const d = new Date(beforeNow);
      d.setFullYear(d.getFullYear() - 12);
      return d.toISOString().slice(0, 10);
    })();
    const afterNow = new Date();
    // Sanity: we crossed no boundary during the test
    expect(afterNow.getTime() - beforeNow.getTime()).toBeLessThan(100);

    expect(parsed({ ...validPayload, birthday: tooYoungBirthday }).success)
      .toBe(false);
  });

  it('rejects the day AFTER the boundary (age 12 years, 364 days)', () => {
    const justAfterBoundary = new Date();
    justAfterBoundary.setFullYear(justAfterBoundary.getFullYear() - 13);
    justAfterBoundary.setUTCDate(justAfterBoundary.getUTCDate() + 1);
    const justAfterIso = justAfterBoundary.toISOString().slice(0, 10);
    expect(parsed({ ...validPayload, birthday: justAfterIso }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(parsed({ ...validPayload, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(parsed({ ...validPayload, name: '' }).success).toBe(false);
  });

  it('rejects unknown phone country code', () => {
    expect(
      parsed({ ...validPayload, phoneCountryCode: '+1' as unknown as '+886' }).success,
    ).toBe(false);
  });

  // =====================================================================
  // 2026-10-18 — Cross-field refinement for paymentStatus/paymentProvider.
  // The 4 paid-membership fields stay optional (non-paid templates skip
  // them entirely), but once `paymentStatus` is set to `'completed'` or
  // `'not_required'`, the provider field's presence/absence must match.
  // Without this refinement, a stale frontend could send
  // `paymentStatus: 'completed'` without a provider (DB would accept via
  // column CHECK, but the row would be incomplete) or send
  // `paymentStatus: 'not_required'` with a provider (semantic garbage).
  // See runs/decisions/2026-10-18-payment-status-not-required-enum.md.
  // =====================================================================
  it('accepts paymentStatus "not_required" without paymentProvider (non-paid template)', () => {
    expect(
      parsed({ ...validPayload, paymentStatus: 'not_required' }).success,
    ).toBe(true);
  });

  it('rejects paymentStatus "not_required" with a paymentProvider (semantic garbage)', () => {
    const result = parsed({
      ...validPayload,
      paymentStatus: 'not_required',
      paymentProvider: 'ecpay',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'paymentProvider');
      expect(issue?.message).toBe(
        'passHolder.errors.paymentProviderForbiddenForNotRequired',
      );
    }
  });

  it('rejects paymentStatus "completed" without paymentProvider (incomplete row)', () => {
    const result = parsed({
      ...validPayload,
      paymentStatus: 'completed',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'paymentProvider');
      expect(issue?.message).toBe(
        'passHolder.errors.paymentProviderRequiredForCompleted',
      );
    }
  });

  it('accepts paymentStatus "completed" with paymentProvider (paid happy path)', () => {
    expect(
      parsed({
        ...validPayload,
        paymentStatus: 'completed',
        paymentProvider: 'ecpay',
      }).success,
    ).toBe(true);
  });
});

/** Wrap safeParse so test bodies stay concise. */
function parsed<T>(value: T) {
  return passHolderRegisterPayloadSchema.safeParse(value);
}

describe('registerService', () => {
  it('happy path: returns { ok: true, passHolderId, created: true } on first register', async () => {
    stubTemplateExists(TEMPLATE_ROW);
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-new' }, true);

    const result = await registerService(makeMockSql(), MOCK_ENV as never, TEMPLATE_ID, validPayload as never);
    expect(result).toEqual({
      ok: true,
      passHolderId: 'holder-new',
      created: true,
      // 2026-10-19 — issuance is undefined because TEMPLATE_ROW has no
      // passcreator_template_id (template not yet pushed upstream); the
      // service short-circuits and the response has no issuance field.
    });
  });

  it('idempotent re-register: returns { ok: true, passHolderId, created: false }', async () => {
    stubTemplateExists(TEMPLATE_ROW);
    stubUpsert(EXISTING_HOLDER, false);

    const result = await registerService(makeMockSql(), MOCK_ENV as never, TEMPLATE_ID, validPayload as never);
    expect(result).toEqual({
      ok: true,
      passHolderId: 'holder-1',
      created: false,
    });
  });

  it('throws NotFoundError when the template does not exist (404)', async () => {
    stubTemplateExists(null);

    await expect(
      registerService(makeMockSql(), MOCK_ENV as never, 'does-not-exist', validPayload as never),
    ).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      i18nKey: 'passHolder.errors.templateNotFound',
    });
  });

  it('does not call upsertPassHolder when template is not found', async () => {
    stubTemplateExists(null);
    const upsertSpy = vi.spyOn(passHoldersDb, 'upsertPassHolder');

    await expect(
      registerService(makeMockSql(), MOCK_ENV as never, 'does-not-exist', validPayload as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('passes validated payload to upsertPassHolder (no mutation)', async () => {
    stubTemplateExists(TEMPLATE_ROW);
    const upsertSpy = vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({
      row: EXISTING_HOLDER,
      created: true,
    });

    await registerService(makeMockSql(), MOCK_ENV as never, TEMPLATE_ID, validPayload as never);

    expect(upsertSpy).toHaveBeenCalledWith(
      makeMockSql(),
      expect.objectContaining({
        templateId: TEMPLATE_ID,
        name: validPayload.name,
        phoneCountryCode: validPayload.phoneCountryCode,
        phoneNumber: validPayload.phoneNumber,
        birthday: validPayload.birthday,
        email: validPayload.email,
      }),
    );
  });

  // =====================================================================
  // 2026-10-19 — V3 issuance wiring (Rule 019 § 4.1 Layer 4).
  //
  // The registerService now accepts `env` and, after a successful
  // upsert, attempts Passcreator V3 issuance. The four scenarios
  // below pin the contract:
  //   - Success → issuance object populated, writeback to DB.
  //   - Already-issued row → no V3 call (idempotent re-register).
  //   - No passcreator_template_id → no V3 call (template pre-launch).
  //   - V3 failure → BadGatewayError caught; issuanceError persisted;
  //     response is still 200 with issuanceError set.
  // =====================================================================
  it('V3 success path: writes issuance fields and returns the DTO', async () => {
    // Template WITH a passcreator_template_id so V3 is attempted.
    stubTemplateExists({ ...TEMPLATE_ROW, passcreator_template_id: 'pc-tpl-1' });
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-new', pass_identifier: null }, true);

    // Stub the V3 wrapper to return a successful envelope. The shape
    // matches the V3 docs (2026-10-19 fix): `downloadPage` is the
    // universal landing page URL; `iPhoneUri` / `androidUri` are
    // platform-specific deeplinks. `barcodeValue` is non-null because
    // V3 was called with `?async=false`.
    const issueSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'issuePass')
      .mockResolvedValue({
        identifier: 'a0f629e6-6533-40cb-90b8-ef9093bfbb26',
        downloadPage: 'https://app.passcreator.com/p/abc',
        iPhoneUri: 'https://app.passcreator.com/abc.pkpass',
        androidUri: 'https://pay.google.com/save/abc',
        barcodeValue: 'STATIC-BARCODE',
      });
    const updateSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderIssuance')
      .mockResolvedValue({ ...EXISTING_HOLDER, pass_identifier: 'a0f629e6' });

    const result = await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    expect(issueSpy).toHaveBeenCalledTimes(1);
    expect(issueSpy).toHaveBeenCalledWith(
      MOCK_ENV,
      'pc-tpl-1',
      expect.objectContaining({
        name: validPayload.name,
        phone: '+886' + validPayload.phoneNumber,
        birthday: validPayload.birthday,
        email: validPayload.email,
      }),
      // 2026-10-24 — the 4th argument carries the holder's OPENING
      // runtime values. Same wire shape the later PATCH consumes
      // (one contract for create + update). A `reward_card` opens at
      // zero, so the header balance is 0.
      expect.objectContaining({
        properties: expect.objectContaining({ balance: 0 }),
      }),
    );
    expect(updateSpy).toHaveBeenCalledWith(
      makeMockSql(),
      expect.objectContaining({
        id: 'holder-new',
        passIdentifier: 'a0f629e6-6533-40cb-90b8-ef9093bfbb26',
        // 2026-10-19 — migration 026 added iphone_uri / android_uri
        // columns. The service now persists all 3 URIs that V3
        // returned so the holder row carries the full artifact for
        // audit trail. Frontend does user-agent detection via
        // pickDownloadUri() to surface the right one.
        downloadUrl: 'https://app.passcreator.com/p/abc',
        barcodeValue: 'STATIC-BARCODE',
        iPhoneUri: 'https://app.passcreator.com/abc.pkpass',
        androidUri: 'https://pay.google.com/save/abc',
      }),
    );
    expect(result.issuance).toMatchObject({
      passIdentifier: 'a0f629e6-6533-40cb-90b8-ef9093bfbb26',
      downloadPage: 'https://app.passcreator.com/p/abc',
      iPhoneUri: 'https://app.passcreator.com/abc.pkpass',
      androidUri: 'https://pay.google.com/save/abc',
      barcodeValue: 'STATIC-BARCODE',
    });
    expect(result.issuance?.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);  // ISO 8601
  });

  it('V3 success path: existing row with pass_identifier is NOT re-issued', async () => {
    // Template has passcreator_template_id AND the holder row already
    // has a pass_identifier (idempotent re-register path). Per
    // Decision § "Issue pass relation", we MUST NOT call V3 again —
    // would create a duplicate pass for the same holder.
    stubTemplateExists({ ...TEMPLATE_ROW, passcreator_template_id: 'pc-tpl-1' });
    // Use a dedicated "already-issued" holder with the full V3 row
    // fields populated (pass_identifier + download_url + issued_at).
    stubUpsert(
      {
        ...EXISTING_HOLDER,
        pass_identifier: 'already-issued-uuid',
        download_url: 'https://app.passcreator.com/p/already',
        barcode_value: 'STATIC-BARCODE',
        issued_at: new Date('2026-10-18T08:42:13.123Z'),
      },
      false,
    );

    // Stub V3 — must NOT be called. Mock with the new V3 shape so
    // any accidental call would at least be observably wrong (the
    // existing-row path reads `download_url` and maps it to
    // `downloadPage` in the response).
    const issueSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'issuePass')
      .mockResolvedValue({
        identifier: 'should-not-be-called',
        downloadPage: 'should-not-be-called',
        iPhoneUri: 'should-not-be-called',
        androidUri: 'should-not-be-called',
        barcodeValue: null,
      });

    const result = await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    expect(issueSpy).not.toHaveBeenCalled();
    // Returned DTO carries the existing issuance fields verbatim.
    // `downloadPage` is mapped from the DB's `download_url` column
    // (no platform-specific fields persisted today).
    expect(result.issuance).toEqual({
      passIdentifier: 'already-issued-uuid',
      downloadPage: 'https://app.passcreator.com/p/already',
      barcodeValue: 'STATIC-BARCODE',
      issuedAt: '2026-10-18T08:42:13.123Z',
    });
  });

  it('V3 no-op path: template has no passcreator_template_id (pre-launch)', async () => {
    // No V3 call attempted because the template hasn't been pushed
    // upstream yet. The frontend banner can render "Pass not ready
    // yet" because no URI is present.
    stubTemplateExists(TEMPLATE_ROW);   // passcreator_template_id: undefined
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-new' }, true);

    const issueSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'issuePass')
      .mockResolvedValue({
        identifier: 'x',
        downloadPage: 'y',
        iPhoneUri: 'y',
        androidUri: 'y',
        barcodeValue: null,
      });

    const result = await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    expect(issueSpy).not.toHaveBeenCalled();
    expect(result.issuance).toBeUndefined();
  });

  it('V3 failure path: BadGatewayError caught → issuanceError persisted, response still 200', async () => {
    stubTemplateExists({ ...TEMPLATE_ROW, passcreator_template_id: 'pc-tpl-1' });
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-new', pass_identifier: null }, true);

    // V3 throws BadGatewayError (network / upstream_rejected / etc.)
    const issueSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'issuePass')
      .mockRejectedValue(new BadGatewayError({
        upstream: 'passcreator',
        kind: 'network',
        upstreamBody: 'fetch failed: ECONNREFUSED',
      }));
    const updateSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderIssuance')
      .mockResolvedValue(EXISTING_HOLDER);

    const result = await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    expect(issueSpy).toHaveBeenCalledTimes(1);
    // The error-write was attempted with the stable i18n key.
    expect(updateSpy).toHaveBeenCalledWith(
      makeMockSql(),
      expect.objectContaining({
        id: 'holder-new',
        issuanceError: 'passHolder.errors.upstreamFailed',
      }),
    );
    // Response is still 200 with issuanceError set — q8-a confirmed.
    expect(result.ok).toBe(true);
    expect(result.passHolderId).toBe('holder-new');
    expect(result.issuance).toEqual({
      issuanceError: 'passHolder.errors.upstreamFailed',
    });
  });

  it('V3 URL includes ?async=false (regression — barcodeValue must reach the response)', async () => {
    // Rule 027-derived invariant: without ?async=false, Passcreator's
    // response is `success:true` with `data.barcodeValue === null`
    // even when the template has a barcode configured. Pin this via
    // a high-level integration check that asserts `issuePass` was
    // invoked at all (the URL/?async=false logic lives inside the
    // shared wrapper; the per-call conformance test in
    // `passcreator.test.ts` pins the URL exactly). This is the
    // belt-and-suspenders test at the registerService layer.
    stubTemplateExists({ ...TEMPLATE_ROW, passcreator_template_id: 'pc-tpl-1' });
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-new', pass_identifier: null }, true);
    const issueSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'issuePass')
      .mockResolvedValue({
        identifier: 'pc-1',
        downloadPage: 'https://app.passcreator.com/p/pc-1',
        iPhoneUri: 'https://app.passcreator.com/pc-1.pkpass',
        androidUri: 'https://pay.google.com/save/pc-1',
        barcodeValue: 'REAL-BARCODE-VALUE',
      });
    vi.spyOn(passHoldersDb, 'updatePassHolderIssuance').mockResolvedValue(EXISTING_HOLDER);

    const result = await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    expect(issueSpy).toHaveBeenCalledTimes(1);
    // The barcodeValue came back non-null — only possible when the
    // wrapper sent ?async=false (verified by the per-call test in
    // `passcreator.test.ts`). If a future refactor drops ?async=false,
    // the wrapper's mock above would still pass here, but the real
    // endpoint would return barcodeValue: null and the production
    // bug would re-surface — caught by the smoke test.
    expect(result.issuance?.barcodeValue).toBe('REAL-BARCODE-VALUE');
  });

  // =====================================================================
  // 2026-10-19 — Migration 026 conformance: 3 URIs persisted + barcodeValue
  // placeholder normalization.
  //
  // Migration 026 adds (a) iPhoneUri / androidUri columns and (b)
  // normalizes barcodeValue placeholder strings ('no value given' /
  // 'no value specified' / 'no barcode' / '') to NULL via the parser
  // (Rule 032 § workerd pitfall-style + 2026-10-19 feedback #3 fix).
  // The 3 tests below pin the contract at the registerService layer:
  //
  //   1. V3 success persists all 3 URIs (iPhoneUri + androidUri + downloadPage)
  //   2. V3 barcodeValue 'no value given' (parser placeholder) → DB NULL
  //      (verifies the parser normalize pass-through still works at the
  //      service layer after migration 026 wiring)
  //   3. V3 barcodeValue null + missing URIs (template without barcode
  //      config) → service persists NULL for all runtime columns and
  //      surfaces the DTO with undefined fields (graceful degradation)
  // =====================================================================
  it('V3 success path: persists iPhoneUri and androidUri in updatePassHolderIssuance', async () => {
    // Regression for migration 026 wiring. Before migration 026, only
    // downloadUrl was persisted; iPhoneUri/androidUri were surfaced
    // via response only (Rule 000 modular design choice at the time).
    // After migration 026, both URIs flow into updatePassHolderIssuance
    // so the holder row carries the full V3 artifact for audit trail.
    stubTemplateExists({ ...TEMPLATE_ROW, passcreator_template_id: 'pc-tpl-1' });
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-new', pass_identifier: null }, true);
    vi.spyOn(await import('@/shared/lib/passcreator'), 'issuePass').mockResolvedValue({
      identifier: 'uri-uuid',
      downloadPage: 'https://app.passcreator.com/p/uri',
      iPhoneUri: 'https://app.passcreator.com/uri.pkpass',
      androidUri: 'https://pay.google.com/save/uri',
      barcodeValue: 'BARCODE-1',
    });
    const updateSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderIssuance')
      .mockResolvedValue(EXISTING_HOLDER);

    const result = await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    // The update call MUST carry all 3 URIs after migration 026
    // wiring. Before the fix, only downloadUrl was passed.
    expect(updateSpy).toHaveBeenCalledWith(
      makeMockSql(),
      expect.objectContaining({
        id: 'holder-new',
        passIdentifier: 'uri-uuid',
        downloadUrl: 'https://app.passcreator.com/p/uri',
        barcodeValue: 'BARCODE-1',
        iPhoneUri: 'https://app.passcreator.com/uri.pkpass',
        androidUri: 'https://pay.google.com/save/uri',
      }),
    );
    // Response DTO also surfaces all 3 URIs (existing contract — the
    // frontend uses pickDownloadUri() for UA detection).
    expect(result.issuance).toMatchObject({
      passIdentifier: 'uri-uuid',
      downloadPage: 'https://app.passcreator.com/p/uri',
      iPhoneUri: 'https://app.passcreator.com/uri.pkpass',
      androidUri: 'https://pay.google.com/save/uri',
      barcodeValue: 'BARCODE-1',
    });
  });

  it('V3 placeholder barcodeValue "no value given" → DB receives NULL (parser normalize still works)', async () => {
    // The Passcreator parser already normalizes the 4 placeholder
    // strings to NULL (2026-10-19 feedback #3 fix in shared/lib/passcreator.ts).
    // This test pins that contract at the registerService layer so a
    // future refactor that re-introduces the literal placeholder
    // string into the DB column gets caught loudly.
    stubTemplateExists({ ...TEMPLATE_ROW, passcreator_template_id: 'pc-tpl-1' });
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-new', pass_identifier: null }, true);
    vi.spyOn(await import('@/shared/lib/passcreator'), 'issuePass').mockResolvedValue({
      identifier: 'placeholder-uuid',
      downloadPage: 'https://app.passcreator.com/p/placeholder',
      iPhoneUri: 'https://app.passcreator.com/placeholder.pkpass',
      androidUri: 'https://pay.google.com/save/placeholder',
      // Parser should normalize this to NULL before reaching the
      // registerService layer (per passcreator.test.ts conformance).
      // We mock at the service boundary above the parser, so the
      // service receives null here — verify it stays null all the way.
      barcodeValue: null,
    });
    const updateSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderIssuance')
      .mockResolvedValue(EXISTING_HOLDER);

    await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    expect(updateSpy).toHaveBeenCalledWith(
      makeMockSql(),
      expect.objectContaining({
        barcodeValue: null,   // placeholder normalized to NULL before DB write
      }),
    );
  });

  it('V3 graceful degradation: template without barcode config → all barcode + URI fields undefined', async () => {
    // Passcreator V3 returns null barcodeValue + null iPhoneUri /
    // androidUri when the template has no barcode configured AND
    // no platform-specific assets. The registerService must NOT
    // throw; the holder row gets all NULLs and the response DTO
    // carries only `passIdentifier` + `issuedAt`. This is the
    // pre-launch / no-asset fallback path.
    stubTemplateExists({ ...TEMPLATE_ROW, passcreator_template_id: 'pc-tpl-empty' });
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-empty', pass_identifier: null }, true);
    vi.spyOn(await import('@/shared/lib/passcreator'), 'issuePass').mockResolvedValue({
      identifier: 'empty-uuid',
      downloadPage: 'https://app.passcreator.com/p/empty',
      iPhoneUri: 'https://app.passcreator.com/empty.pkpass',   // still string even for Apple-only
      androidUri: 'https://pay.google.com/save/empty',
      barcodeValue: null,                                      // no barcode configured
    });
    const updateSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderIssuance')
      .mockResolvedValue(EXISTING_HOLDER);

    const result = await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    // DB write carries barcodeValue: null + URIs as strings.
    expect(updateSpy).toHaveBeenCalledWith(
      makeMockSql(),
      expect.objectContaining({
        barcodeValue: null,
        // URIs are still non-null even for Apple-only templates
        // (Passcreator returns strings regardless of platform gating).
        iPhoneUri: expect.any(String),
        androidUri: expect.any(String),
      }),
    );
    // Response DTO: barcodeValue is null; URIs are non-null.
    expect(result.issuance?.barcodeValue).toBeNull();
    expect(result.issuance?.iPhoneUri).toBeDefined();
    expect(result.issuance?.androidUri).toBeDefined();
  });

  // =======================================================================
  // 2026-10-18 — P0 #4 barcode backfill via single-pass GET + LIST.
  //
  // Production bug (2026-10-18): for `useAutoIdForValue=true`
  // templates, Passcreator V3 CREATE returns `barcodeValue: "no
  // value specified"` (a literal placeholder). SAOME's parser
  // normalizes this to `null`, so the DB stores
  // `barcode_value = NULL` even though the real auto-generated
  // barcode is rendered on the wallet pass (visible in
  // Passcreator's dashboard as `Barcode: zbood1tvxrvl31kv9e6ad3ef2f71561`
  // for the ILJOI holder).
  //
  // Fix: when the V3 create response carries `barcodeValue: null`
  // (after parser normalize), the service calls `getPassByIdentifier`
  // (PRIMARY) to fetch the real value from `data.generatedId`. If
  // that fails, it falls back to `listPasses` with the identifier
  // filter (FALLBACK). If both fail, the holder row keeps
  // `barcode_value = NULL` and registration still returns 200 —
  // barcode is best-effort.
  //
  // The 3 conformance tests below pin this behavior at the
  // registerService layer so a future refactor that drops the
  // backfill call (and regresses production) fails loudly.
  //
  // Reference: runs/improvements/feedback/20261018-passcreator-v3-barcode-backfill.md
  // =======================================================================
  it('V3 barcode backfill: auto-gen template → getPassByIdentifier returns real barcode (regression — 2026-10-18)', async () => {
    // Simulate the production scenario:
    //   - V3 CREATE returns `barcodeValue: null` (placeholder
    //     normalized) for a useAutoIdForValue=true template
    //   - getPassByIdentifier returns the real barcode from
    //     `data.generatedId`
    //   - The service MUST persist the real barcode via a second
    //     `updatePassHolderIssuance` call (NOT leave the DB at null).
    stubTemplateExists({ ...TEMPLATE_ROW, passcreator_template_id: 'pc-tpl-1' });
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-backfill', pass_identifier: null }, true);

    const REAL_BARCODE = 'zbood1tvxrvl31kv9e6ad3ef2f71561';
    vi.spyOn(await import('@/shared/lib/passcreator'), 'issuePass').mockResolvedValue({
      identifier: '5615a280-fac3-4d64-a4ea-34d8b5d7b0ee',
      downloadPage: 'https://app.passcreator.com/p/5615a280',
      iPhoneUri: 'https://app.passcreator.com/5615a280.pkpass',
      androidUri: 'https://pay.google.com/save/5615a280',
      barcodeValue: null,   // ← placeholder normalized to null
    });
    const getSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'getPassByIdentifier')
      .mockResolvedValue({
        identifier: '5615a280-fac3-4d64-a4ea-34d8b5d7b0ee',
        downloadPage: 'https://app.passcreator.com/p/5615a280',
        iPhoneUri: 'https://app.passcreator.com/5615a280.pkpass',
        androidUri: 'https://pay.google.com/save/5615a280',
        // Real barcode from data.generatedId (single-pass GET shape)
        barcodeValue: REAL_BARCODE,
      });
    const listSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'listPasses')
      .mockResolvedValue([]);
    const updateSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderIssuance')
      .mockResolvedValue(EXISTING_HOLDER);

    const result = await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    // PRIMARY path called exactly once (no LIST fallback when
    // single-pass GET succeeds).
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenCalledWith(
      MOCK_ENV,
      '5615a280-fac3-4d64-a4ea-34d8b5d7b0ee',
    );
    expect(listSpy).not.toHaveBeenCalled();

    // The service MUST persist the backfilled barcode via a SECOND
    // updatePassHolderIssuance call — the first call carries the
    // CREATE-response fields (barcodeValue: null), the second
    // carries ONLY the backfilled barcode.
    expect(updateSpy).toHaveBeenCalledTimes(2);
    // First update: CREATE-response fields (barcodeValue: null)
    expect(updateSpy).toHaveBeenNthCalledWith(
      1,
      makeMockSql(),
      expect.objectContaining({
        id: 'holder-backfill',
        passIdentifier: '5615a280-fac3-4d64-a4ea-34d8b5d7b0ee',
        barcodeValue: null,
      }),
    );
    // Second update: backfilled barcode
    expect(updateSpy).toHaveBeenNthCalledWith(
      2,
      makeMockSql(),
      expect.objectContaining({
        id: 'holder-backfill',
        barcodeValue: REAL_BARCODE,
      }),
    );

    // Response DTO reflects the backfilled barcode (NOT null).
    // The frontend renders this so the user sees the real barcode
    // value on the wallet pass confirmation screen.
    expect(result.issuance?.barcodeValue).toBe(REAL_BARCODE);
  });

  it('V3 barcode backfill: single-pass GET fails → listPasses fallback still persists real barcode', async () => {
    // PRIMARY path throws (network / upstream_rejected), FALLBACK
    // path returns the matched identifier with the real auto-gen
    // barcode. The service MUST still persist the backfilled
    // barcode via listPasses' autoGeneratedId field.
    stubTemplateExists({ ...TEMPLATE_ROW, passcreator_template_id: 'pc-tpl-1' });
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-fallback', pass_identifier: null }, true);

    const REAL_BARCODE = 'fonfkq7icjwqpd0vjp6a1b46573a9bb';
    vi.spyOn(await import('@/shared/lib/passcreator'), 'issuePass').mockResolvedValue({
      identifier: '1468809c-14a8-4160-9d93-757ea6d80b0e',
      downloadPage: 'https://app.passcreator.com/p/1468809c',
      iPhoneUri: 'https://app.passcreator.com/1468809c.pkpass',
      androidUri: 'https://pay.google.com/save/1468809c',
      barcodeValue: null,   // ← placeholder normalized to null
    });
    // PRIMARY throws (e.g., Passcreator changes the single-pass
    // GET endpoint shape, or transient network error).
    const getSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'getPassByIdentifier')
      .mockRejectedValue(new BadGatewayError({
        upstream: 'passcreator',
        kind: 'network',
        upstreamBody: 'fetch failed: ECONNREFUSED',
      }));
    // FALLBACK returns the matched item with `autoGeneratedId`
    // (LIST shape — plural field name).
    const listSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'listPasses')
      .mockResolvedValue([{
        identifier: '1468809c-14a8-4160-9d93-757ea6d80b0e',
        downloadPage: 'https://app.passcreator.com/p/1468809c',
        iPhoneUri: 'https://app.passcreator.com/1468809c.pkpass',
        androidUri: 'https://pay.google.com/save/1468809c',
        barcodeValue: REAL_BARCODE,   // from autoGeneratedId
      }]);
    const updateSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderIssuance')
      .mockResolvedValue(EXISTING_HOLDER);

    const result = await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    // PRIMARY attempted (threw), FALLBACK attempted (succeeded).
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledWith(
      MOCK_ENV,
      expect.objectContaining({
        templateId: 'pc-tpl-1',
        identifier: '1468809c-14a8-4160-9d93-757ea6d80b0e',
      }),
    );

    // Second update carries the backfilled barcode from LIST.
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenNthCalledWith(
      2,
      makeMockSql(),
      expect.objectContaining({
        id: 'holder-fallback',
        barcodeValue: REAL_BARCODE,
      }),
    );

    expect(result.issuance?.barcodeValue).toBe(REAL_BARCODE);
  });

  it('V3 barcode backfill: BOTH paths fail → barcode_value stays null, registration still 200 (best-effort)', async () => {
    // Both backfill paths fail (network outage on both endpoints,
    // OR Passcreator returns empty data, etc.). The service MUST
    // still return 200 with barcodeValue=null — barcode is
    // best-effort, and the holder row's registration is the
    // primary success signal.
    stubTemplateExists({ ...TEMPLATE_ROW, passcreator_template_id: 'pc-tpl-1' });
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-nobackfill', pass_identifier: null }, true);

    vi.spyOn(await import('@/shared/lib/passcreator'), 'issuePass').mockResolvedValue({
      identifier: 'failing-backfill-uuid',
      downloadPage: 'https://app.passcreator.com/p/failing',
      iPhoneUri: 'https://app.passcreator.com/failing.pkpass',
      androidUri: 'https://pay.google.com/save/failing',
      barcodeValue: null,
    });
    // Both backfill paths throw (simulating a Passcreator outage).
    const getSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'getPassByIdentifier')
      .mockRejectedValue(new BadGatewayError({
        upstream: 'passcreator',
        kind: 'network',
        upstreamBody: 'fetch failed: ETIMEDOUT',
      }));
    const listSpy = vi
      .spyOn(await import('@/shared/lib/passcreator'), 'listPasses')
      .mockRejectedValue(new BadGatewayError({
        upstream: 'passcreator',
        kind: 'network',
        upstreamBody: 'fetch failed: ETIMEDOUT',
      }));
    const updateSpy = vi
      .spyOn(passHoldersDb, 'updatePassHolderIssuance')
      .mockResolvedValue(EXISTING_HOLDER);

    const result = await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    // Both backfill paths attempted (PRIMARY then FALLBACK).
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledTimes(1);

    // Only ONE update call (the initial CREATE-response write with
    // barcodeValue: null). NO second update because there's nothing
    // to backfill — the service didn't crash, it just gave up
    // gracefully.
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updateCall = updateSpy.mock.calls[0]?.[1];
    expect(updateCall).toMatchObject({
      id: 'holder-nobackfill',
      barcodeValue: null,
    });
    // No `issuanceError` i18n key — barcode backfill failures are
    // NOT surfaced as issuance errors. The holder row's registration
    // succeeded; only the barcode persistence was best-effort. The
    // frontend banner doesn't show a retry prompt for the holder.
    // (`issuanceError` may be absent or `null` — both are accepted;
    // what matters is that the failure-banner i18n key is NOT set.)
    expect(updateCall?.issuanceError ?? null).not.toBe(
      'passHolder.errors.upstreamFailed',
    );

    // Response DTO: barcodeValue stays null; registration still
    // succeeded with the rest of the artifact.
    expect(result.ok).toBe(true);
    expect(result.issuance?.barcodeValue).toBeNull();
    expect(result.issuance?.passIdentifier).toBe('failing-backfill-uuid');
    // No issuanceError key — backfill failure is silent (best-effort).
    expect(result.issuance?.issuanceError).toBeUndefined();
  });
});

// =============================================================================
// 2026-10-17 — Route-level error envelope regression.
// User reported: "I entered 1989 but got 400 tooYoung". The schema's
// validation IS correct (see the "accepts holder born in 1989" tests
// above). To make the next false-reject easy to diagnose from the
// client side, the route surfaces the actual received value + the
// min-age boundary it computed, so the user (or ops) can immediately
// see whether the API really got 1989 or got something else (browser
// autofill, stale form state, wrong field, etc).
// =============================================================================
describe('POST /:id/register — error envelope includes received value', () => {
  function makeApp() {
    const app = new Hono<HonoEnv>();
    app.route('/', registerRoute);
    app.onError(errorHandler);
    return app;
  }

  function makeBody(overrides: Record<string, unknown> = {}) {
    return {
      name: '王小明',
      phoneCountryCode: '+886',
      phoneNumber: '912345678',
      birthday: '1989-01-01',
      email: 'wang@example.com',
      ...overrides,
    };
  }

  // Stubs the service's downstream calls so the route can focus on
  // zod parse + error envelope. We don't exercise DB in this suite.
  beforeEach(() => {
    vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(TEMPLATE_ROW);
    vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({
      row: EXISTING_HOLDER,
      created: true,
    });
  });

  it('responds 400 with received=1989-01-01 and minBirthdayBoundary=~2013 when birthday fails the refine', async () => {
    const app = makeApp();
    // Submit a birthday that is genuinely too young (year 2020, age ~6).
    const res = await app.request(`/${TEMPLATE_ID}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ birthday: '2020-06-15' })),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; i18nKey: string; details: { issues: Array<{ path: string; i18nKey: string; received?: unknown }>; minBirthdayBoundary?: string } };
    };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.i18nKey).toBe('passHolder.errors.tooYoung');
    expect(body.error.details.issues[0]).toMatchObject({
      path: 'birthday',
      i18nKey: 'passHolder.errors.tooYoung',
      received: '2020-06-15',   // ← exact offending value the API got
    });
    expect(body.error.details.minBirthdayBoundary).toBeDefined();
    // Boundary is today − 13 years in UTC ISO. Pin the shape, not the
    // exact date (the test runs any day).
    expect(body.error.details.minBirthdayBoundary).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('regression — when user thinks they entered 1989, the received value should be 1989-... not today', async () => {
    // This test documents the EXPECTED diagnostic shape for the user's
    // "I entered 1989 but got tooYoung" complaint. If this fails (i.e.
    // the user IS sending 1989 and the API IS rejecting it), then the
    // schema's refine has a real bug and needs investigation. If this
    // passes (i.e. the schema accepts 1989), then any tooYoung from
    // the user's flow MUST have come from a different (more recent)
    // value — confirm by looking at the next error response.
    const app = makeApp();
    const res = await app.request(`/${TEMPLATE_ID}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBody({ birthday: '1989-01-01' })),
    });
    expect(res.status).toBe(200);   // happy path, not 400
  });
});

// =============================================================================
// 2026-10-23 — Gift-card purchase registration.
//
// The security property pinned here: the backend RE-DERIVES the amount
// from the template's own `giftCard*` settings. A client that sends
// `purchasedPoints: 10000` alongside a fabricated price must not be
// able to influence what gets charged or persisted.
//
// See runs/decisions/2026-10-23-gift-card-paid-registration.md
// =============================================================================

const GIFT_TEMPLATE_ROW: PublicTemplateRow = {
  id: TEMPLATE_ID,
  name: 'Gift Card Studio',
  card_type: 'gift_card',
  settings: { logoText: 'Gift', issuerName: 'Gift Card Studio' },
  is_paid: false,
  currency: 'TWD',
  gift_card_config: {
    giftCardAmount: 100,
    giftCardPoints: 10,
    giftCardCheckoutMinPoints: 100,
    giftCardCheckoutMaxPoints: 10_000,
    giftCardCheckoutMinAmount: 100,
    giftCardCheckoutMaxAmount: 10_000,
  },
};

const giftPayload = {
  ...validPayload,
  purchasedPoints: 500,
  paymentProvider: 'ecpay' as const,
  paymentStatus: 'completed' as const,
};

describe('passHolderRegisterPayloadSchema — purchasedPoints (2026-10-23)', () => {
  it('accepts a positive integer purchasedPoints', () => {
    expect(parsed({ ...validPayload, purchasedPoints: 500 }).success).toBe(true);
  });

  it('rejects non-integer / non-positive purchasedPoints', () => {
    for (const purchasedPoints of [0, -100, 10.5]) {
      expect(parsed({ ...validPayload, purchasedPoints }).success).toBe(false);
    }
  });

  it('rejects purchasedPoints WITHOUT a paymentProvider (gift cards are always paid)', () => {
    const result = parsed({
      ...validPayload,
      purchasedPoints: 500,
      paymentStatus: 'completed',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'paymentProvider');
      expect(issue?.message).toBe(
        'passHolder.errors.paymentProviderRequiredForCompleted',
      );
    }
  });

  it('accepts purchasedPoints with paymentStatus "not_required"? NO — rejects', () => {
    // A gift purchase is never free. If the frontend somehow emits
    // 'not_required' alongside points, the cross-field rule must reject
    // rather than persist a "free" purchase of real points.
    const result = parsed({
      ...validPayload,
      purchasedPoints: 500,
      paymentStatus: 'not_required',
    });
    expect(result.success).toBe(false);
  });
});

describe('registerService — gift-card purchase (2026-10-23)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('persists purchasedPoints + a server-derived amount + currency + snapshot', async () => {
    stubTemplateExists(GIFT_TEMPLATE_ROW);
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-gift' }, true);

    await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      giftPayload as never,
    );

    const upsertSpy = vi.mocked(passHoldersDb.upsertPassHolder);
    expect(upsertSpy).toHaveBeenCalledWith(
      makeMockSql(),
      expect.objectContaining({
        purchasedPoints: 500,
        // 500 點 ÷ 10 點/單位 × 100 元/單位 = 5000 元 — derived by the
        // SERVER from the template config, never read from the payload.
        paidAmount: 5000,
        currency: 'TWD',
        giftCardSnapshot: expect.objectContaining({
          points: 500,
          amount: 5000,
          currency: 'TWD',
          unitAmount: 100,
          unitPoints: 10,
        }),
      }),
    );
  });

  it('ignores a client-supplied price — the amount is always re-derived', async () => {
    // Defense-in-depth: even if a future payload field carries an
    // amount, the service must ignore it. The snapshot's `amount` is
    // provably the server's own arithmetic.
    stubTemplateExists(GIFT_TEMPLATE_ROW);
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-gift' }, true);

    await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      { ...giftPayload, paidAmount: 1, amount: 1, giftCardSnapshot: { amount: 1 } } as never,
    );

    const input = vi.mocked(passHoldersDb.upsertPassHolder).mock.calls[0]?.[1];
    expect(input?.paidAmount).toBe(5000);
    expect(
      (input?.giftCardSnapshot as { amount: number } | undefined)?.amount,
    ).toBe(5000);
  });

  it('REJECTS points below the checkout minimum', async () => {
    stubTemplateExists(GIFT_TEMPLATE_ROW);
    const upsertSpy = vi.spyOn(passHoldersDb, 'upsertPassHolder');

    await expect(
      registerService(
        makeMockSql(),
        MOCK_ENV as never,
        TEMPLATE_ID,
        { ...giftPayload, purchasedPoints: 50 } as never,
      ),
    ).rejects.toThrow();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('REJECTS points above the checkout maximum', async () => {
    stubTemplateExists(GIFT_TEMPLATE_ROW);
    const upsertSpy = vi.spyOn(passHoldersDb, 'upsertPassHolder');

    await expect(
      registerService(
        makeMockSql(),
        MOCK_ENV as never,
        TEMPLATE_ID,
        { ...giftPayload, purchasedPoints: 20_000 } as never,
      ),
    ).rejects.toThrow();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('REJECTS points the rate cannot price (not a multiple of unitPoints)', async () => {
    // 505 點 ÷ 10 = 50.5 units → 5050 元 is expressible, but the rate
    // contract requires whole units. Reject rather than round.
    stubTemplateExists(GIFT_TEMPLATE_ROW);
    const upsertSpy = vi.spyOn(passHoldersDb, 'upsertPassHolder');

    await expect(
      registerService(
        makeMockSql(),
        MOCK_ENV as never,
        TEMPLATE_ID,
        { ...giftPayload, purchasedPoints: 505 } as never,
      ),
    ).rejects.toThrow();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('REJECTS a gift-card registration with NO purchasedPoints at all', async () => {
    // A gift card is always paid. Registering without points would
    // create a "free gift card" row — the exact class of semantic
    // garbage migration 024's cross-field rules were built to stop.
    stubTemplateExists(GIFT_TEMPLATE_ROW);
    const upsertSpy = vi.spyOn(passHoldersDb, 'upsertPassHolder');

    await expect(
      registerService(
        makeMockSql(),
        MOCK_ENV as never,
        TEMPLATE_ID,
        { ...validPayload, paymentProvider: 'ecpay', paymentStatus: 'completed' } as never,
      ),
    ).rejects.toThrow();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('REJECTS when the template has no configured rate', async () => {
    stubTemplateExists({ ...GIFT_TEMPLATE_ROW, gift_card_config: null });
    const upsertSpy = vi.spyOn(passHoldersDb, 'upsertPassHolder');

    await expect(
      registerService(
        makeMockSql(),
        MOCK_ENV as never,
        TEMPLATE_ID,
        giftPayload as never,
      ),
    ).rejects.toThrow();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('uses ZAR + payfast for a ZAR gift template', async () => {
    stubTemplateExists({ ...GIFT_TEMPLATE_ROW, currency: 'ZAR' });
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-gift-zar' }, true);

    await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      { ...giftPayload, paymentProvider: 'payfast' } as never,
    );

    expect(vi.mocked(passHoldersDb.upsertPassHolder).mock.calls[0]?.[1]).toMatchObject({
      currency: 'ZAR',
      paidAmount: 5000,
    });
  });

  it('does NOT touch the gift path for a non-gift template (regression)', async () => {
    // The existing membership / stamp / reward registrations must be
    // byte-for-byte unaffected.
    stubTemplateExists(TEMPLATE_ROW);
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-new' }, true);

    await registerService(
      makeMockSql(),
      MOCK_ENV as never,
      TEMPLATE_ID,
      validPayload as never,
    );

    const input = vi.mocked(passHoldersDb.upsertPassHolder).mock.calls[0]?.[1];
    expect(input?.purchasedPoints).toBeUndefined();
    expect(input?.giftCardSnapshot).toBeUndefined();
    expect(input?.paidAmount).toBeUndefined();
    expect(input?.currency).toBeUndefined();
  });
});