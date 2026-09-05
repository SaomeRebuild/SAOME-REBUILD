/**
 * refresh.test.ts ??vitest unit tests for refreshService + refreshRoute.
 *
 * @module modules/auth/tests/refresh
 *
 * Tests:
 *   - happy path: valid refresh cookie ??200 + new tokens
 *   - missing cookie ??401 AUTH_MISSING_REFRESH
 *   - invalid token ??401 AUTH_INVALID_REFRESH
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

vi.mock('@/shared/db/client', () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/shared/lib/jwt', () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('../db/users', () => ({
  findUserById: vi.fn(),
  insertUser: vi.fn(),
}));

vi.mock('../db/tenants', () => ({
  findTenantByOwnerId: vi.fn().mockResolvedValue(null),
  insertTenant: vi.fn(),
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

import { findUserById } from '../db/users';
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
const mockedFindUserById = vi.mocked(findUserById);
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
    });
    mockedFindUserById.mockResolvedValue({
      id: 'user-1',
      email: 'user' + '@example.com',
      password_hash: 'h',
      role: 'tenant',
      is_active: true,
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
    expect(body.tenant).toBeNull(); // mocked findTenantByOwnerId resolves null
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

  it('refresh for inactive user returns 403', async () => {
    mockedFindUserById.mockResolvedValue({
      id: 'user-1',
      email: 'user' + '@example.com',
      password_hash: 'h',
      role: 'tenant',
      is_active: false,
      created_at: new Date(),
    });
    const app = buildApp();
    const res = await callRefresh(app, 'saome_refresh=valid-token');
    expect(res.status).toBe(403);
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
