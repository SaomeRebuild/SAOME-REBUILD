/**
 * register.test.ts — vitest unit tests for registerService + registerRoute.
 *
 * @module modules/auth/tests/register
 *
 * Tests:
 *   - happy path: valid payload -> 201 + AuthSessionDto
 *   - duplicate email -> 409 CONFLICT
 *   - duplicate tax_id (non-"0") -> 409 CONFLICT
 *   - invalid email (zod) -> 400 VALIDATION_ERROR
 *   - password mismatch -> 400 VALIDATION_ERROR
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

// Mock DB layer
vi.mock('@/shared/db/client', () => ({
  getDb: vi.fn().mockResolvedValue({
    begin: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({})),
  }),
}));

vi.mock('@/shared/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password-mock'),
  verifyPassword: vi.fn(),
}));

vi.mock('@/shared/lib/jwt', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyToken: vi.fn(),
}));

vi.mock('../db/users', () => ({
  findUserByEmail: vi.fn(),
  insertUser: vi.fn(),
}));

vi.mock('../db/tenants', () => ({
  findTenantByTaxId: vi.fn(),
  insertTenant: vi.fn(),
}));

vi.mock('@/modules/pass/db/passes', () => ({
  insertPass: vi.fn(),
  getPassStatus: vi.fn(),
}));

import { findUserByEmail, insertUser } from '../db/users';
import { findTenantByTaxId, insertTenant } from '../db/tenants';
import { insertPass, getPassStatus } from '@/modules/pass/db/passes';
import { hashPassword } from '@/shared/lib/password';
import { signAccessToken, signRefreshToken } from '@/shared/lib/jwt';
import { errorHandler } from '@/shared/middleware/errorHandler';
import { registerRoute } from '../routes/register';

const mockedFindUserByEmail = vi.mocked(findUserByEmail);
const mockedInsertUser = vi.mocked(insertUser);
const mockedFindTenantByTaxId = vi.mocked(findTenantByTaxId);
const mockedInsertTenant = vi.mocked(insertTenant);
const mockedInsertPass = vi.mocked(insertPass);
const mockedGetPassStatus = vi.mocked(getPassStatus);
const mockedHash = vi.mocked(hashPassword);
const mockedSignAccess = vi.mocked(signAccessToken);
const mockedSignRefresh = vi.mocked(signRefreshToken);

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorHandler);
  app.route('/api/auth/register', registerRoute);
  return app;
}

const testEnv: HonoEnv['Bindings'] = {
  HYPERDRIVE: { connectionString: 'postgres://test:test@localhost/test' } as unknown as HonoEnv['Bindings']['HYPERDRIVE'],
  ALLOWED_ORIGINS: 'http://localhost:5173',
  JWT_SECRET: 'test-secret',
};

function getErrorCode(body: Record<string, unknown>): string | undefined {
  const err = body.error as Record<string, unknown> | undefined;
  return err?.code as string | undefined;
}

const validPayload = {
  contactName: 'Test Contact',
  phoneCity: '02-12345678',
  address: 'Taipei City, Zhongzheng District, Sec 1, Chongqing S Rd, No 122',
  taxId: '12345678',
  name: 'Test Store',
  invoiceAddress: 'Taipei City, Zhongzheng District, Sec 1, Chongqing S Rd, No 122',
  // Backend stub uses strict E.164 (rule 019 — last line of defense).
  // Frontend normalizePhoneToE164 converts Taiwan bare 09xxxxxxxx → +8869xxxxxxxx
  // before submit, so the payload reaching the backend is always strict E.164.
  mobile: '+886912345678',
  website: 'https://example.com',
  email: 'user@example.com',
  password: 'Password123!',
  plan: 'green' as const,
};

async function callRegister(app: Hono<HonoEnv>, body: unknown) {
  return app.request(
    'http://localhost/api/auth/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    testEnv,
  );
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindUserByEmail.mockResolvedValue(null);
    mockedFindTenantByTaxId.mockResolvedValue(null);
    mockedInsertUser.mockResolvedValue({ id: 'user-1', email: 'user' + '@example.com', password_hash: 'h', role: 'tenant', is_active: true, created_at: new Date() });
    mockedInsertTenant.mockResolvedValue({
      id: 'tenant-1',
      owner_user_id: 'user-1',
      contact_name: validPayload.contactName,
      phone_city: validPayload.phoneCity,
      address: validPayload.address,
      tax_id: validPayload.taxId,
      name: validPayload.name,
      invoice_address: validPayload.invoiceAddress,
      mobile: validPayload.mobile,
      website: validPayload.website,
      email: validPayload.email,
    });
    mockedHash.mockResolvedValue('hashed');
    mockedSignAccess.mockResolvedValue('access');
    mockedSignRefresh.mockResolvedValue('refresh');
    mockedInsertPass.mockResolvedValue({
      id: 'pass-1',
      tenant_id: 'tenant-1',
      plan: 'green',
      trial_days: 14,
      start_date: new Date(),
      end_date: new Date('2026-09-01T00:00:00.000Z'),
      status: 'active',
      created_at: new Date(),
      paid_at: null,
      billing_cycle_end: null,
    });
    mockedGetPassStatus.mockResolvedValue({
      plan: 'green',
      daysRemaining: 14,
      status: 'active',
      endDate: new Date('2026-09-01T00:00:00.000Z'),
      phase: 'trial',
      paidAt: null,
      billingCycleEnd: null,
    });
  });

  it('happy path: valid payload returns 201 with auth session', async () => {
    const app = buildApp();
    const res = await callRegister(app, validPayload);
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessToken).toBe('access');
    expect(body.refreshToken).toBe('refresh');
    expect((body.user as Record<string, unknown>).email).toBe('user' + '@example.com');
    expect((body.tenant as Record<string, unknown>).name).toBe('Test Store');
    // Set-Cookie should be set
    expect(res.headers.get('Set-Cookie')).toContain('saome_refresh=refresh');
  });

  it('duplicate email returns 409 CONFLICT', async () => {
    mockedFindUserByEmail.mockResolvedValue({ id: 'existing-user', email: 'user' + '@example.com', password_hash: 'h', role: 'tenant', is_active: true, created_at: new Date() });
    const app = buildApp();
    const res = await callRegister(app, validPayload);
    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(getErrorCode(body)).toBe('CONFLICT');
    expect(((body.error as Record<string, unknown>)?.i18nKey as string) ?? '').toContain('email');
  });

  it('duplicate tax_id (non-"0") returns 409 CONFLICT', async () => {
    mockedFindTenantByTaxId.mockResolvedValue({
      id: 'existing-tenant',
      owner_user_id: 'other',
      contact_name: 'X',
      phone_city: 'X',
      address: 'X',
      tax_id: '12345678',
      name: 'X',
      invoice_address: null,
      mobile: null,
      website: null,
      email: 'x',
    });
    const app = buildApp();
    const res = await callRegister(app, validPayload);
    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(getErrorCode(body)).toBe('CONFLICT');
    expect(((body.error as Record<string, unknown>)?.i18nKey as string) ?? '').toContain('tax');
  });

  it('invalid email (zod) returns 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const bad = { ...validPayload, email: 'not-an-email' };
    const res = await callRegister(app, bad);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(getErrorCode(body)).toBe('VALIDATION_ERROR');
  });

  it('password too short returns 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const bad = { ...validPayload, password: 'short' };
    const res = await callRegister(app, bad);
    expect(res.status).toBe(400);
  });
});