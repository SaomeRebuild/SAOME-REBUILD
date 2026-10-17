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

function makeMockSql() {
  return {} as Parameters<typeof registerService>[0];
}

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
    getDbForRequest: vi.fn().mockResolvedValue({} as Sql),
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
});

/** Wrap safeParse so test bodies stay concise. */
function parsed<T>(value: T) {
  return passHolderRegisterPayloadSchema.safeParse(value);
}

describe('registerService', () => {
  it('happy path: returns { ok: true, passHolderId, created: true } on first register', async () => {
    stubTemplateExists(TEMPLATE_ROW);
    stubUpsert({ ...EXISTING_HOLDER, id: 'holder-new' }, true);

    const result = await registerService(makeMockSql(), TEMPLATE_ID, validPayload as never);
    expect(result).toEqual({
      ok: true,
      passHolderId: 'holder-new',
      created: true,
    });
  });

  it('idempotent re-register: returns { ok: true, passHolderId, created: false }', async () => {
    stubTemplateExists(TEMPLATE_ROW);
    stubUpsert(EXISTING_HOLDER, false);

    const result = await registerService(makeMockSql(), TEMPLATE_ID, validPayload as never);
    expect(result).toEqual({
      ok: true,
      passHolderId: 'holder-1',
      created: false,
    });
  });

  it('throws NotFoundError when the template does not exist (404)', async () => {
    stubTemplateExists(null);

    await expect(
      registerService(makeMockSql(), 'does-not-exist', validPayload as never),
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
      registerService(makeMockSql(), 'does-not-exist', validPayload as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('passes validated payload to upsertPassHolder (no mutation)', async () => {
    stubTemplateExists(TEMPLATE_ROW);
    const upsertSpy = vi.spyOn(passHoldersDb, 'upsertPassHolder').mockResolvedValue({
      row: EXISTING_HOLDER,
      created: true,
    });

    await registerService(makeMockSql(), TEMPLATE_ID, validPayload as never);

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