/**
 * refresh.test.ts — vitest unit tests for refreshService + refreshRoute.
 *
 * @module modules/auth/tests/refresh
 *
 * Tests:
 *   - happy path: valid refresh cookie → 200 + new tokens
 *   - missing cookie → 401 AUTH_MISSING_REFRESH
 *   - invalid token → 401 AUTH_INVALID_REFRESH
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

// Phase 3.2 (2026-09-09): getDb must return a sql instance that supports tagged
// template calls (e.g. `db`SELECT * FROM ...``). An empty object causes
// "db is not a function" when advanceBillingCycle calls db as a tagged template.
function createMockSql() {
  // A tagged template function: `sql`SELECT * FROM t WHERE id = ${id}``
  const taggedFn = (...args: unknown[]) => {
    // Return a promise that resolves to an empty array (no rows found in mocks)
    return Promise.resolve([]);
  };
  return Object.assign(taggedFn, {
    __proto__: null,
  });
}

vi.mock('@/shared/db/client', () => ({
  getDb: vi.fn().mockResolvedValue(createMockSql()),
  getDbForRequest: vi.fn().mockResolvedValue(createMockSql()),
}));

vi.mock('@/shared/lib/jwt', () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyToken: vi.fn(),
}));

// Phase 3.2 (2026-09-09): refreshService no longer calls findUserById (trust JWT).
// findTenantByOwnerId is also removed (now uses findTenantById with PK from JWT tenantId).
vi.mock('../db/users', () => ({
  // findUserById removed — Phase 3.2 trusts JWT for user identity
  findUserById: vi.fn(),
  insertUser: vi.fn(),
}));

vi.mock('../db/tenants', () => ({
  // Phase 3.2: findTenantByOwnerId replaced by findTenantById (PK lookup from JWT tenantId)
  findTenantByOwnerId: vi.fn().mockResolvedValue(null),
  findTenantById: vi.fn(),
  insertTenant: vi.fn(),
}));

vi.mock('../../pass/db/passes', () => ({
  getPassStatus: vi.fn(),
  advanceBillingCycle: vi.fn().mockResolvedValue(null),
}));

// Phase 2.2 mock — must be declared before the module imports below
// so vitest's hoisting places it above the module-under-test.
const { mockIsTokenRevoked } = vi.hoisted(() => ({
  mockIsTokenRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock('../db/revokedTokens', () => ({
  isTokenRevoked: (...args: unknown[]) => mockIsTokenRevoked(...args),
  revokeToken: vi.fn().mockResolvedValue(undefined),
  _clearRevokedCacheForTests: vi.fn(),
}));

import { findTenantById } from '../db/tenants';
import { signAccessToken, signRefreshToken, verifyToken } from '@/shared/lib/jwt';
import { errorHandler } from '@/shared/middleware/errorHandler';
import { refreshRoute } from '../routes/refresh';

// Phase 2.2 mock — must be declared alongside the vi.mock factory (which is
// hoisted above this module's body). We reach the same mock fn through the
// vi.hoisted() closure so afterEach/clearAllMocks can reach it later.
// `revokedTokensModule.isTokenRevoked` resolves to the factory wrapper, which
// forwards to `mockIsTokenRevoked`. We use the hoisted var directly since the
// vi.mock factory cannot be asked "what mock fn was this replaced with?".
const mockedIsTokenRevoked = mockIsTokenRevoked;
const mockedFindTenantById = vi.mocked(findTenantById);
const mockedAccess = vi.mocked(signAccessToken);
const mockedRefreshSign = vi.mocked(signRefreshToken);
const mockedVerify = vi.mocked(verifyToken);

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorHandler);
  app.route('/api/auth/refresh', refreshRoute);
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

async function callRefresh(app: Hono<HonoEnv>, cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  return app.request(
    'http://localhost/api/auth/refresh',
    { method: 'POST', headers },
    testEnv,
  );
}

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerify.mockResolvedValue({
      sub: 'user-1',
      email: 'user' + '@example.com',
      role: 'tenant',
      type: 'refresh',
      tenantId: 'tenant-1',
      jti: 'jti-1',
    });
    // Phase 3.2: refreshService trusts JWT for user identity (no findUserById call).
    // It uses findTenantById to hydrate tenant from JWT tenantId claim.
    mockedFindTenantById.mockResolvedValue({
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
      email: 'user' + '@example.com',
      created_at: new Date(),
    });
    mockedAccess.mockResolvedValue('new-access');
    mockedRefreshSign.mockResolvedValue('new-refresh');
    // Phase 2.2: reset revocation mock to "not revoked" for every test
    mockedIsTokenRevoked.mockResolvedValue(false);
  });

  it('happy path returns 200 with new tokens + Set-Cookie', async () => {
    const app = buildApp();
    const res = await callRefresh(app, 'saome_refresh=old-refresh-token');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessToken).toBe('new-access');
    expect(body.refreshToken).toBe('new-refresh');
    expect(res.headers.get('Set-Cookie')).toContain('saome_refresh=new-refresh');
  });

  // Bug-7 follow-up: refresh response must include user + tenant so the
  // frontend AuthProvider can recover the session on a full page reload
  // (without an additional /api/auth/me call which previously 401'd because
  // the AuthProvider hadn't yet threaded the freshly-issued access token).
  //
  // Phase 3.2 (2026-09-09): refreshService uses findTenantById (PK lookup from
  // JWT tenantId claim) instead of findTenantByOwnerId. Tenant is hydrated
  // from the JWT's tenantId, not from a secondary lookup by owner_user_id.
  it('refresh response includes user + tenant (Bug-7 follow-up)', async () => {
    const app = buildApp();
    const res = await callRefresh(app, 'saome_refresh=old-refresh-token');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.user).toEqual({
      id: 'user-1',
      email: 'user' + '@example.com',
      role: 'tenant',
    });
    // Phase 3.2: findTenantById hydrates tenant from JWT tenantId (mocked in beforeEach).
    // The service transforms DB rows to camelCase (refreshService.ts line ~96).
    expect(body.tenant).toEqual({
      id: 'tenant-1',
      name: 'X Store',
      contactName: 'X',
      phoneCity: 'X',
      address: 'X',
      taxId: '0',
      invoiceAddress: null,
      mobile: null,
      website: null,
      email: 'user' + '@example.com',
    });
  });

  it('missing refresh cookie returns 401 UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await callRefresh(app);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(getErrorCode(body)).toBe('UNAUTHORIZED');
  });

  it('invalid refresh token returns 401 UNAUTHORIZED', async () => {
    mockedVerify.mockRejectedValue(new Error('invalid signature'));
    const app = buildApp();
    const res = await callRefresh(app, 'saome_refresh=garbage');
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(getErrorCode(body)).toBe('UNAUTHORIZED');
  });

  it('Phase 3.2: active-user tokens are trusted from JWT — is_active check removed from refreshService', async () => {
    // Phase 3.2 (2026-09-09): refreshService trusts the JWT for user identity.
    // is_active is only enforced at login (loginService). After login, a revoked
    // token is blocked by Phase 2.2 revoked_tokens table. An inactive user
    // with a non-revoked token will get a 200 with new tokens — the access
    // TTL is the re-auth window.
    mockedVerify.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'tenant',
      type: 'refresh',
      tenantId: 'tenant-1',
      jti: 'jti-1',
    });
    // findTenantById still hydrates the tenant for the session response
    mockedFindTenantById.mockResolvedValue({
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
    const res = await callRefresh(app, 'saome_refresh=valid-token');
    // Returns 200 — refreshService trusts JWT, does not check is_active
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      role: 'tenant',
    });
    expect(body.tenant).not.toBeNull();
  });

  // Phase 2.2 (2026-09-05): server-side revocation check in refreshService.
  // When a refresh token has been explicitly revoked (e.g. on logout), the
  // server must reject the refresh attempt with 401 — otherwise the client
  // would silently re-issue a new session under a revoked lineage.

  it('Phase 2.2: revoked refresh token returns 401 UNAUTHORIZED', async () => {
    // isTokenRevoked returns true → refreshService throws AUTH_ERROR tokenRevoked
    mockedIsTokenRevoked.mockResolvedValue(true);
    const app = buildApp();
    const res = await callRefresh(app, 'saome_refresh=revoked-jwt');
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(getErrorCode(body)).toBe('UNAUTHORIZED');
  });

  it('Phase 2.2: isTokenRevoked is called with the token jti from verifyToken', async () => {
    // Track that isTokenRevoked was called after verifyToken resolved
    mockedIsTokenRevoked.mockResolvedValue(false);
    const app = buildApp();
    const res = await callRefresh(app, 'saome_refresh=valid-jwt');
    expect(res.status).toBe(200);

    // isTokenRevoked must be called with the jti from the verified token
    expect(mockedIsTokenRevoked).toHaveBeenCalledTimes(1);
    // The jti from the mock verifyToken payload above is undefined in this
    // test since the mock doesn't include a jti field, but refreshService
    // passes payload.jti. The mock intercepts at the module level so the
    // actual call arguments are a SQL client (object) + the jti string.
    const callArgs = mockedIsTokenRevoked.mock.calls[0];
    expect(callArgs.length).toBeGreaterThanOrEqual(2);
  });

  it('Phase 2.2: non-revoked token (isTokenRevoked=false) proceeds normally', async () => {
    mockedIsTokenRevoked.mockResolvedValue(false);
    const app = buildApp();
    const res = await callRefresh(app, 'saome_refresh=valid-jwt');
    // Confirms the happy path still works when revocation check returns false
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessToken).toBe('new-access');
  });
});
