/**
 * login.test.ts ??vitest unit tests for loginService + loginRoute.
 *
 * @module modules/auth/tests/login
 *
 * Tests:
 *   - happy path: valid creds ??200 + AuthSessionDto + Set-Cookie
 *   - wrong password ??401 AUTH_INVALID
 *   - unknown email ??401 AUTH_INVALID
 *   - validation error (zod) ??400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

vi.mock('@/shared/db/client', () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

vi.mock('@/shared/lib/password', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('@/shared/lib/jwt', () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('../db/users', () => ({
  findUserByEmail: vi.fn(),
  insertUser: vi.fn(),
}));

vi.mock('../db/tenants', () => ({
  findTenantByOwnerId: vi.fn(),
  insertTenant: vi.fn(),
}));

vi.mock('../../pass/db/passes', () => ({
  getPassStatus: vi.fn(),
  advanceBillingCycle: vi.fn(),
}));

const FAKE_ATTEMPT_ROW = {
  id: 1,
  user_id: null,
  email_attempted: 'x@example.com',
  success: true,
  attempted_at: new Date(),
};

vi.mock('../db/loginAttempts', () => {
  const fakeAttempt = {
    id: 1,
    user_id: null as unknown as string,
    email_attempted: 'x@example.com',
    success: true,
    attempted_at: new Date(),
  };
  return {
    countRecentFailures: vi.fn().mockResolvedValue(0),
    insertLoginAttempt: vi.fn().mockResolvedValue(fakeAttempt),
  };
});

vi.mock('../middleware/rateLimit', () => ({
  rateLimitMiddleware: vi.fn().mockImplementation(async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

import { findUserByEmail } from '../db/users';
import { findTenantByOwnerId } from '../db/tenants';
import { getPassStatus } from '../../pass/db/passes';
import { verifyPassword } from '@/shared/lib/password';
import { signAccessToken, signRefreshToken } from '@/shared/lib/jwt';
import { insertLoginAttempt } from '../db/loginAttempts';
import { errorHandler } from '@/shared/middleware/errorHandler';
import { loginRoute } from '../routes/login';

const mockedFindUser = vi.mocked(findUserByEmail);
const mockedFindTenant = vi.mocked(findTenantByOwnerId);
const mockedGetPass = vi.mocked(getPassStatus);
const mockedVerify = vi.mocked(verifyPassword);
const mockedAccess = vi.mocked(signAccessToken);
const mockedRefresh = vi.mocked(signRefreshToken);
const mockedInsertAttempt = vi.mocked(insertLoginAttempt);

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorHandler);
  app.route('/api/auth/login', loginRoute);
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

const validCreds = { email: 'user' + '@example.com', password: 'Password123!' };

const fakeUser = {
  id: 'user-1',
  email: 'user' + '@example.com',
  password_hash: 'hashed',
  role: 'tenant' as const,
  is_active: true,
  created_at: new Date(),
};

const fakePassStatus = {
  plan: 'green',
  daysRemaining: 14,
  status: 'active' as const,
  endDate: new Date('2026-09-01T00:00:00.000Z'),
  phase: 'trial' as const,
  paidAt: null,
  billingCycleEnd: null,
};

const fakeTenant = {
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
  created_at: new Date(),
};

async function callLogin(app: Hono<HonoEnv>, body: unknown) {
  return app.request(
    'http://localhost/api/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    testEnv,
  );
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindUser.mockResolvedValue(fakeUser);
    mockedFindTenant.mockResolvedValue(fakeTenant);
    mockedVerify.mockResolvedValue(true);
    mockedAccess.mockResolvedValue('access');
    mockedRefresh.mockResolvedValue('refresh');
    mockedInsertAttempt.mockResolvedValue({
      id: 1,
      user_id: null,
      email_attempted: 'x@example.com',
      success: true,
      attempted_at: new Date(),
    });
    mockedGetPass.mockResolvedValue(fakePassStatus);
  });

  it('happy path returns 200 with auth session + Set-Cookie', async () => {
    const app = buildApp();
    const res = await callLogin(app, validCreds);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessToken).toBe('access');
    expect(body.refreshToken).toBe('refresh');
    expect((body.user as Record<string, unknown>).email).toBe('user' + '@example.com');
    expect(res.headers.get('Set-Cookie')).toContain('saome_refresh=refresh');
    // insertLoginAttempt IS called for audit trail (success)
    expect(mockedInsertAttempt).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ success: true }));
  });

  // Per Bug-4 fix: cookie Domain must derive from the request Origin so the
  // browser accepts it on both *.saome.org and *.workers.dev deployments.
  describe('Set-Cookie Domain derivation (Bug-4)', () => {
    it('emits no Domain attribute when Origin is workers.dev (production test)', async () => {
      const app = buildApp();
      const res = await app.request(
        'http://localhost/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://saome-frontend.pages.dev',
          },
          body: JSON.stringify(validCreds),
        },
        testEnv,
      );
      const setCookie = res.headers.get('Set-Cookie') ?? '';
      expect(setCookie).toContain('saome_refresh=refresh');
      expect(setCookie).not.toMatch(/Domain=/);
    });

    it('emits Domain=.saome.org when Origin ends with .saome.org (production)', async () => {
      const app = buildApp();
      const res = await app.request(
        'http://localhost/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://app.saome.org',
          },
          body: JSON.stringify(validCreds),
        },
        testEnv,
      );
      const setCookie = res.headers.get('Set-Cookie') ?? '';
      expect(setCookie).toContain('saome_refresh=refresh');
      expect(setCookie).toContain('Domain=.saome.org');
    });

    it('emits no Domain attribute when Origin header is missing (CLI / smoke)', async () => {
      const app = buildApp();
      const res = await callLogin(app, validCreds);
      const setCookie = res.headers.get('Set-Cookie') ?? '';
      expect(setCookie).not.toMatch(/Domain=/);
    });
  });

  // Per Bug-7 (session-loss on HTTP dev page): browsers reject `Secure` cookies
  // when the document is non-secure (HTTP). For dev origins like
  // http://localhost:5173 the backend must drop the `Secure` flag so the cookie
  // can be stored and sent on subsequent navigations. Production HTTPS origins
  // keep the `Secure` flag.
  //
  // Bug-7 follow-up: `SameSite=Lax` cookies are NOT attached to cross-site
  // POST subrequests, which causes `refresh()` from a different-site frontend
  // to silently miss the cookie. We must emit `SameSite=None` for HTTPS
  // origins (which mandates `Secure`) so the cookie survives cross-site
  // navigations between the frontend and backend.
  describe('Set-Cookie Secure + SameSite flags (Bug-7)', () => {
    it('HTTPS origin: emits Secure + SameSite=None', async () => {
      const app = buildApp();
      const res = await app.request(
        'http://localhost/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://app.saome.org',
          },
          body: JSON.stringify(validCreds),
        },
        testEnv,
      );
      const setCookie = res.headers.get('Set-Cookie') ?? '';
      expect(setCookie).toContain('saome_refresh=refresh');
      expect(setCookie).toMatch(/;\s*Secure\b/);
      expect(setCookie).toMatch(/SameSite=None/);
      expect(setCookie).not.toMatch(/SameSite=Lax/);
    });

    it('HTTP origin: drops Secure, keeps SameSite=Lax', async () => {
      const app = buildApp();
      const res = await app.request(
        'http://localhost/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://localhost:5173',
          },
          body: JSON.stringify(validCreds),
        },
        testEnv,
      );
      const setCookie = res.headers.get('Set-Cookie') ?? '';
      expect(setCookie).toContain('saome_refresh=refresh');
      expect(setCookie).not.toMatch(/;\s*Secure\b/);
      expect(setCookie).toMatch(/SameSite=Lax/);
      expect(setCookie).not.toMatch(/SameSite=None/);
    });

    it('Missing Origin: defaults to Secure + SameSite=None (production)', async () => {
      const app = buildApp();
      const res = await callLogin(app, validCreds);
      const setCookie = res.headers.get('Set-Cookie') ?? '';
      expect(setCookie).toContain('saome_refresh=refresh');
      expect(setCookie).toMatch(/;\s*Secure\b/);
      expect(setCookie).toMatch(/SameSite=None/);
    });
  });

  it('wrong password returns 401 UNAUTHORIZED', async () => {
    mockedVerify.mockResolvedValue(false);
    const app = buildApp();
    const res = await callLogin(app, validCreds);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(getErrorCode(body)).toBe('UNAUTHORIZED');
    // failed attempt should be recorded
    expect(mockedInsertAttempt).toHaveBeenCalled();
  });

  it('unknown email returns 401 UNAUTHORIZED (does not leak existence)', async () => {
    mockedFindUser.mockResolvedValue(null);
    const app = buildApp();
    const res = await callLogin(app, validCreds);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(getErrorCode(body)).toBe('UNAUTHORIZED');
    // failed attempt should still be recorded
    expect(mockedInsertAttempt).toHaveBeenCalled();
  });

  it('inactive user returns 403 FORBIDDEN', async () => {
    mockedFindUser.mockResolvedValue({ ...fakeUser, is_active: false });
    const app = buildApp();
    const res = await callLogin(app, validCreds);
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(getErrorCode(body)).toBe('FORBIDDEN');
  });

  it('invalid payload (zod) returns 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const res = await callLogin(app, { email: 'not-email', password: '' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(getErrorCode(body)).toBe('VALIDATION_ERROR');
  });
});
