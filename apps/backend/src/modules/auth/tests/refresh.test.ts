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
  getDb: vi.fn().mockReturnValue({}),
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

import { findUserById } from '../db/users';
import { signAccessToken, signRefreshToken, verifyToken } from '@/shared/lib/jwt';
import { errorHandler } from '@/shared/middleware/errorHandler';
import { refreshRoute } from '../routes/refresh';

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
});
