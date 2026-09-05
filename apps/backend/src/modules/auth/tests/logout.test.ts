/**
 * Tests for POST /api/auth/logout.
 *
 * Critical invariant under test:
 *   - Logout always returns 200, even if no cookie/Bearer token is present
 *     (logout is idempotent from the client's perspective).
 *   - When ANY refresh credential is present (cookie or Bearer), the
 *     response MUST carry `Set-Cookie: saome_refresh=; Max-Age=0; Path=/api/auth`
 *     to clear the HttpOnly refresh cookie in the browser.
 *   - The response body is `{ loggedOut: true }` regardless of input.
 *   - Logout is stateless on the server (no DB writes for the MVP path).
 *
 * Why this matters: silent-logout bug. If the server doesn't clear the
 * cookie, the next page reload or 401-retry silently re-logs the user in.
 *
 * Phase 2.2 (2026-09-05): revocation is now best-effort — DB write is
 * attempted when a refresh token is present and JWT_SECRET is configured.
 * We mock `@/shared/db/client` and `@/shared/lib/jwt` to verify the
 * revoke path is exercised without touching real Postgres.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { logoutRoute } from '../routes/logout';
import { errorHandler } from '@/shared/middleware/errorHandler';
import type { HonoEnv } from '@/shared/types/bindings';

// Phase 2.2 mocks — vi.mock is hoisted above imports, but the mocks it
// references must be created via `vi.hoisted` so they're available when
// the factory function runs (before the surrounding module-level code).
const { mockRevokeToken, mockIsTokenRevoked, mockGetDb, mockVerifyToken } = vi.hoisted(() => ({
  mockRevokeToken: vi.fn().mockResolvedValue(undefined),
  mockIsTokenRevoked: vi.fn().mockResolvedValue(false),
  mockGetDb: vi.fn(),
  mockVerifyToken: vi.fn().mockResolvedValue({
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'admin@saome.org',
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    jti: '00000000-0000-4000-8000-000000000099',
  }),
}));

vi.mock('@/shared/lib/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

vi.mock('@/modules/auth/db/revokedTokens', () => ({
  revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
  isTokenRevoked: (...args: unknown[]) => mockIsTokenRevoked(...args),
}));

vi.mock('@/shared/db/client', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorHandler);
  app.route('/api/auth/logout', logoutRoute);
  return app;
}

const testEnv: HonoEnv['Bindings'] = {
  HYPERDRIVE: {} as unknown as HonoEnv['Bindings']['HYPERDRIVE'],
  ALLOWED_ORIGINS: 'https://app.saome.org',
  JWT_SECRET: 'test',
} as unknown as HonoEnv['Bindings'];

async function call(
  app: Hono<HonoEnv>,
  headers: Record<string, string> = {},
  origin = 'https://app.saome.org',
) {
  return app.request(
    'http://localhost/api/auth/logout',
    { method: 'POST', headers: { Origin: origin, ...headers } },
    testEnv,
  );
}

// File-level beforeEach so EVERY test (including pre-Phase-2.2 tests)
// has a fresh mock call count. Inner describe-level beforeEach would
// not run for outer describe's tests.
beforeEach(() => {
  mockRevokeToken.mockClear();
  mockIsTokenRevoked.mockClear();
  mockGetDb.mockReset();
  mockVerifyToken.mockClear();
  // Default: getDb returns an empty object (the route only uses it as
  // a positional arg for revokeToken). Individual tests override as
  // needed (e.g. mockRejectedValueOnce for failure-path tests).
  mockGetDb.mockResolvedValue({} as never);
});

describe('POST /api/auth/logout', () => {
  it('returns 200 + loggedOut:true with no credentials present (idempotent)', async () => {
    const app = buildApp();
    const res = await call(app);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.loggedOut).toBe(true);
  });

  it('clears the refresh cookie when refresh cookie is present', async () => {
    const app = buildApp();
    const res = await call(app, { Cookie: 'saome_refresh=existing-token' });
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).not.toBeNull();
    expect(setCookie).toContain('saome_refresh=');
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('Path=/api/auth');
    expect(setCookie).toContain('HttpOnly');
  });

  it('clears the refresh cookie when Bearer token is present (cross-origin case)', async () => {
    const app = buildApp();
    const res = await call(app, { Authorization: 'Bearer some-refresh-token' });
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).not.toBeNull();
    expect(setCookie).toContain('Max-Age=0');
  });

  it('clears the refresh cookie when BOTH cookie and Bearer are present', async () => {
    const app = buildApp();
    const res = await call(app, {
      Cookie: 'saome_refresh=existing-token',
      Authorization: 'Bearer some-refresh-token',
    });
    expect(res.status).toBe(200);

    // Only one Set-Cookie header should be emitted (deduped)
    const allCookies = res.headers.getSetCookie?.() ?? [];
    expect(allCookies.length).toBeLessThanOrEqual(1);
    expect(allCookies[0]).toContain('Max-Age=0');
  });

  it('Set-Cookie does NOT include Secure flag for http://localhost dev origin', async () => {
    // Dev convenience: local dev frontend is HTTP; Secure cookies are
    // rejected by browsers on http:// contexts. Bug-7 fix parity.
    const app = buildApp();
    const res = await call(
      app,
      { Cookie: 'saome_refresh=existing-token' },
      'http://localhost:5173',
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('Max-Age=0');
    // Should NOT include Secure for http:// origin
    expect(setCookie).not.toMatch(/;\s*Secure/);
  });

  it('Set-Cookie includes Secure flag for HTTPS origin (production)', async () => {
    const app = buildApp();
    const res = await call(
      app,
      { Cookie: 'saome_refresh=existing-token' },
      'https://app.saome.org',
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toMatch(/;\s*Secure/);
  });

  it('handles malformed cookie gracefully (does not throw)', async () => {
    const app = buildApp();
    // Garbage cookie value — should still return 200 (stateless server)
    const res = await call(app, { Cookie: 'saome_refresh=%E0%A4%A' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.loggedOut).toBe(true);
  });

  // Phase 2.2 (2026-09-05): verify the revocation INSERT path is exercised
  // when a refresh credential is present, and skipped when missing.
  // (beforeEach is at file scope — see top of file.)

  it('Phase 2.2: revokes the refresh jti when a cookie credential is present', async () => {
    const app = buildApp();
    const res = await call(app, { Cookie: 'saome_refresh=valid-refresh-jwt' });
    expect(res.status).toBe(200);

    // getDb was called to obtain the sql client
    expect(mockGetDb).toHaveBeenCalledTimes(1);
    // revokeToken was called with (sql, jti, expiresAt, 'logout')
    expect(mockRevokeToken).toHaveBeenCalledTimes(1);
    const [sqlArg, jtiArg, expiresAtArg, reasonArg] = mockRevokeToken.mock.calls[0];
    expect(sqlArg).toBeDefined();
    expect(jtiArg).toBe('00000000-0000-4000-8000-000000000099');
    expect(expiresAtArg).toBeInstanceOf(Date);
    expect(reasonArg).toBe('logout');
  });

  it('Phase 2.2: revokes the refresh jti when a Bearer credential is present', async () => {
    const app = buildApp();
    const res = await call(app, { Authorization: 'Bearer valid-refresh-jwt' });
    expect(res.status).toBe(200);
    expect(mockRevokeToken).toHaveBeenCalledTimes(1);
  });

  it('Phase 2.2: skips DB revocation when no credential is present (no DB hit)', async () => {
    const app = buildApp();
    const res = await call(app);
    expect(res.status).toBe(200);
    // No refresh token → no DB call, no revoke.
    expect(mockGetDb).not.toHaveBeenCalled();
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  it('Phase 2.2: DB revocation failure does not break the Set-Cookie clear', async () => {
    // Make getDb throw — the route must still return 200 + clear cookie.
    mockGetDb.mockRejectedValueOnce(new Error('connection refused'));
    const app = buildApp();
    const res = await call(app, { Cookie: 'saome_refresh=valid-refresh-jwt' });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('Max-Age=0');
  });
});
