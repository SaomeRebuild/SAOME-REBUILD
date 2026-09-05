/**
 * Tests for the corsMiddleware behavior (vs. the helpers in cors.ts).
 *
 * The middleware's previous shape was:
 *   - Set Access-Control-Allow-* headers on c.res.headers **first**
 *   - Then await next()
 *
 * This works for normal Hono response handling, but if the route handler
 * returns a fresh `new Response(...)` instead of mutating c.res, the headers
 * set before await next() are dropped. The new shape is:
 *   - Resolve the allowed origin upfront
 *   - For OPTIONS preflight: emit a fresh 204 with headers and return early
 *   - For all other methods: await next(), THEN set the headers on c.res
 *     (which is the final Response object by then)
 *
 * Critical invariant: the 5xx / 4xx response from any route MUST still carry
 * Access-Control-Allow-* headers, otherwise the browser silently drops the
 * body and we get Bug-4d-like "I see OPTIONS 204 but POST never happens".
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { corsMiddleware } from './cors';
import type { HonoEnv } from '@/shared/types/bindings';

const testEnv: HonoEnv['Bindings'] = {
  HYPERDRIVE: {} as unknown as HonoEnv['Bindings']['HYPERDRIVE'],
  ALLOWED_ORIGINS: 'https://app.saome.org',
  ALLOWED_ORIGIN_PATTERNS: '*.saome.org',
  JWT_SECRET: 'test',
} as unknown as HonoEnv['Bindings'];

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.use('*', corsMiddleware);
  // Helper route: returns a fresh Response (the failure mode for the old
  // wrap-before-next shape).
  app.get('/fresh-response', () => new Response('ok', { status: 200 }));
  app.get('/server-error', () => new Response('boom', { status: 500 }));
  app.post('/echo', async (c) => c.json({ ok: true }));
  return app;
}

async function call(
  app: Hono<HonoEnv>,
  path: string,
  method: string = 'GET',
  origin?: string,
) {
  const headers: Record<string, string> = {};
  if (origin) headers['Origin'] = origin;
  return app.request(`http://test.local${path}`, { method, headers }, testEnv);
}

describe('corsMiddleware — response wrap', () => {
  it('GET with allowed origin returns CORS headers', async () => {
    const app = buildApp();
    const res = await call(app, '/fresh-response', 'GET', 'https://app.saome.org');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.saome.org');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Vary')).toBe('Origin');
  });

  it('GET with NEW Response (the failure mode for old shape) still carries CORS headers', async () => {
    // /fresh-response returns `new Response('ok', { status: 200 })` — the
    // exact pattern that breaks the "set headers before await next()" shape.
    const app = buildApp();
    const res = await call(app, '/fresh-response', 'GET', 'https://app.saome.org');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.saome.org');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('GET 500 error response still carries CORS headers (bug-4d regression)', async () => {
    // Bug-4d was that error responses lost CORS headers, causing browser
    // to silently drop the response. This test pins the fix.
    const app = buildApp();
    const res = await call(app, '/server-error', 'GET', 'https://app.saome.org');
    expect(res.status).toBe(500);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.saome.org');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('OPTIONS preflight returns 204 with CORS headers', async () => {
    const app = buildApp();
    const res = await call(app, '/echo', 'OPTIONS', 'https://app.saome.org');
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.saome.org');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('OPTIONS preflight from disallowed origin returns 204 with no CORS headers (browser will reject)', async () => {
    // Out of scope for B2: per the user's request we don't add explicit 403
    // for disallowed-origin OPTIONS preflight. The current behavior (204 with
    // no Access-Control-Allow-Origin) is sufficient — browsers treat it as
    // a CORS rejection.
    const app = buildApp();
    const res = await call(app, '/echo', 'OPTIONS', 'https://evil.example.com');
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('GET with disallowed origin returns response without CORS headers (browser will drop)', async () => {
    const app = buildApp();
    const res = await call(app, '/fresh-response', 'GET', 'https://evil.example.com');
    expect(res.status).toBe(200);
    // No Access-Control-Allow-Origin → browser rejects the response
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('POST with allowed origin carries CORS headers', async () => {
    const app = buildApp();
    const res = await call(app, '/echo', 'POST', 'https://app.saome.org');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.saome.org');
  });

  it('subdomain via ALLOWED_ORIGIN_PATTERNS works', async () => {
    const app = buildApp();
    const res = await call(
      app,
      '/fresh-response',
      'GET',
      'https://staging.app.saome.org',
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://staging.app.saome.org',
    );
  });
});
