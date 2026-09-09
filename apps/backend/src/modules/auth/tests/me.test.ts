/**
 * me.test.ts — vitest unit tests for meRoute.
 *
 * @module modules/auth/tests/me
 *
 * Tests:
 *   - authenticated user with tenant → 200 + user + tenant
 *   - authenticated user without tenant (admin) → 200 + user + tenant=null
 *   - missing token → 401
 *   - invalid token → 401
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

vi.mock('@/shared/db/client', () => ({
  getDb: vi.fn().mockResolvedValue({}),
  getDbForRequest: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/shared/lib/jwt', () => ({
  verifyToken: vi.fn(),
}));

// Phase 3.2 (2026-09-09): meRoute uses findTenantById (PK lookup from JWT tenantId)
// instead of findTenantByOwnerId (index scan by user.id).
vi.mock('../db/tenants', () => ({
  findTenantById: vi.fn(),
}));

vi.mock('../db/users', () => ({
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  insertUser: vi.fn(),
}));

import { findTenantById } from '../db/tenants';
import { verifyToken } from '@/shared/lib/jwt';
import { errorHandler } from '@/shared/middleware/errorHandler';
import { meRoute } from '../routes/me';

const mockedVerify = vi.mocked(verifyToken);
const mockedFindTenant = vi.mocked(findTenantById);

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorHandler);
  app.route('/api/auth/me', meRoute);
  return app;
}

const testEnv: HonoEnv['Bindings'] = {
  HYPERDRIVE: { connectionString: 'postgres://test:test@localhost/test' } as unknown as HonoEnv['Bindings']['HYPERDRIVE'],
  ALLOWED_ORIGINS: 'http://localhost:5173',
  JWT_SECRET: 'test-secret',
};

async function callMe(app: Hono<HonoEnv>, bearer?: string) {
  const headers: Record<string, string> = {};
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
  return app.request(
    'http://localhost/api/auth/me',
    { method: 'GET', headers },
    testEnv,
  );
}

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authenticated tenant returns 200 with user + tenant (Phase 3.2: JWT tenantId → findTenantById)', async () => {
    // Phase 3.2: requireAuth trusts JWT for user identity (no findUserById DB lookup).
    // The meRoute reads tenantId from the JWT and calls findTenantById.
    mockedVerify.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'tenant' as const,
      type: 'access' as const,
      tenantId: 'tenant-1',
      iat: 0,
      exp: 9999999999,
      jti: 'jti-1',
    });
    mockedFindTenant.mockResolvedValue({
      id: 'tenant-1',
      owner_user_id: 'user-1',
      contact_name: 'X',
      phone_city: 'X',
      address: 'X',
      tax_id: '0',
      name: 'X Store',
      invoice_address: null,
      mobile: null,
      website: null,
      email: 'user@example.com',
      created_at: new Date(),
    });
    const app = buildApp();
    const res = await callMe(app, 'valid-access');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.user as Record<string, unknown>).id).toBe('user-1');
    expect((body.tenant as Record<string, unknown>).name).toBe('X Store');
  });

  it('authenticated admin (no tenant) returns 200 with tenant=null', async () => {
    // Admin JWT has no tenantId → findTenantById is not called.
    mockedVerify.mockResolvedValue({
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'admin' as const,
      type: 'access' as const,
      tenantId: undefined,
      iat: 0,
      exp: 9999999999,
      jti: 'jti-2',
    });
    // findTenantById should not be called for admins
    const app = buildApp();
    const res = await callMe(app, 'admin-access');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.user as Record<string, unknown>).role).toBe('admin');
    expect(body.tenant).toBeNull();
    expect(mockedFindTenant).not.toHaveBeenCalled();
  });

  it('missing token returns 401', async () => {
    const app = buildApp();
    const res = await callMe(app);
    expect(res.status).toBe(401);
  });

  it('invalid token returns 401', async () => {
    mockedVerify.mockRejectedValue(new Error('bad sig'));
    const app = buildApp();
    const res = await callMe(app, 'garbage');
    expect(res.status).toBe(401);
  });
});
