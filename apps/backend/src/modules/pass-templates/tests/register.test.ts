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

import { describe, it, expect, vi } from 'vitest';
import {
  passHolderRegisterPayloadSchema,
} from '../schemas/request';
import { registerService } from '../services/registerService';
import * as templatesDb from '../db/templates';
import * as passHoldersDb from '../db/passHolders';
import type { PublicTemplateRow } from '../db/templates';
import type { PassHolderRow } from '../db/passHolders';

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