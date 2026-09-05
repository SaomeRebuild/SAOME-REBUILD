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
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { logoutRoute } from '../routes/logout';
import { errorHandler } from '@/shared/middleware/errorHandler';
import type { HonoEnv } from '@/shared/types/bindings';

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
});
