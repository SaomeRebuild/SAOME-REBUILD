/**
 * Tests for `shared/middleware/runtimeCors.ts`.
 *
 * Why these tests exist:
 *   Bug — 2026-09-06 production CORS drop: a browser request to
 *   `https://saome-frontend.josh1989213.workers.dev` calling
 *   `https://saome-backend.josh1989213.workers.dev/api/auth/login`
 *   received a 503 with NO `Access-Control-Allow-Origin` header. The
 *   browser silently dropped the response — fetch rejected with
 *   TypeError — and the user saw "Network error" with no way to debug.
 *
 *   The 503 came from the Cloudflare runtime (top-level unhandled error
 *   path), bypassing Hono's middleware chain entirely. Hono's
 *   `corsMiddleware` (wrap-after-next) and `errorHandler` (inline CORS
 *   injection) only run INSIDE the Hono pipeline; responses emitted by
 *   the Worker runtime BEFORE Hono's middleware starts have no CORS
 *   headers at all.
 *
 * Fix:
 *   `index.ts` wraps the Hono app in an `ExportedHandler.fetch` function
 *   that calls `ensureCorsOnResponse(request, res)` on every response
 *   that leaves the Worker — including runtime-level 503s. This module
 *   is the implementation; these tests pin its behavior so a future
 *   regression is caught in CI.
 *
 * Test isolation:
 *   This file imports `runtimeCors.ts` directly, which has NO
 *   transitive imports of the Hono app or cards module. This means the
 *   tests run without pulling in the full app graph and don't depend on
 *   any `@saome/shared/logic/*` alias resolution working in vitest.
 */

import { describe, it, expect } from 'vitest';
import { ensureCorsOnResponse, isRuntimeAllowedHost } from './runtimeCors';

describe('isRuntimeAllowedHost', () => {
  it('accepts exact-match production origins', () => {
    expect(isRuntimeAllowedHost('saome-frontend.josh1989213.workers.dev')).toBe(true);
    expect(isRuntimeAllowedHost('saome-admin.josh1989213.workers.dev')).toBe(true);
    expect(isRuntimeAllowedHost('app.saome.org')).toBe(true);
    expect(isRuntimeAllowedHost('admin.saome.org')).toBe(true);
  });

  it('accepts production subdomain pattern matches', () => {
    expect(isRuntimeAllowedHost('preview-123.saome-frontend.pages.dev')).toBe(true);
    expect(isRuntimeAllowedHost('staging.app.saome.org')).toBe(true);
  });

  it('rejects unrelated hosts', () => {
    expect(isRuntimeAllowedHost('evil.example.com')).toBe(false);
    expect(isRuntimeAllowedHost('saome.org')).toBe(false); // apex without subdomain
    expect(isRuntimeAllowedHost('localhost')).toBe(false);
    expect(isRuntimeAllowedHost('localhost:5173')).toBe(false);
  });

  it('is case-insensitive on host', () => {
    expect(isRuntimeAllowedHost('SAOME-FRONTEND.Josh1989213.Workers.Dev')).toBe(true);
  });
});

describe('ensureCorsOnResponse', () => {
  it('attaches CORS headers when origin host is on allow-list (the production CORS drop fix)', () => {
    const req = new Request('https://saome-backend.josh1989213.workers.dev/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://saome-frontend.josh1989213.workers.dev' },
    });
    const res = new Response(null, { status: 503 });
    const out = ensureCorsOnResponse(req, res);
    expect(out.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://saome-frontend.josh1989213.workers.dev',
    );
    expect(out.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(out.headers.get('Vary')).toBe('Origin');
  });

  it('does NOT attach CORS headers when origin host is NOT on allow-list', () => {
    const req = new Request('https://saome-backend.josh1989213.workers.dev/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://evil.example.com' },
    });
    const res = new Response(null, { status: 503 });
    const out = ensureCorsOnResponse(req, res);
    expect(out.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(out.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('does NOT throw or modify headers when origin is missing (same-origin requests)', () => {
    const req = new Request('https://saome-backend.josh1989213.workers.dev/health');
    const res = new Response(null, { status: 200 });
    const out = ensureCorsOnResponse(req, res);
    expect(out.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(out.status).toBe(200);
  });

  it('does NOT throw when origin header is unparseable', () => {
    const req = new Request('https://saome-backend.josh1989213.workers.dev/health', {
      headers: { origin: 'not-a-url' },
    });
    const res = new Response(null, { status: 200 });
    const out = ensureCorsOnResponse(req, res);
    expect(out.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('preserves existing headers on the response (additive, not destructive)', () => {
    const req = new Request('https://saome-backend.josh1989213.workers.dev/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://app.saome.org' },
    });
    const res = new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'req-12345',
      },
    });
    const out = ensureCorsOnResponse(req, res);
    expect(out.headers.get('Content-Type')).toBe('application/json');
    expect(out.headers.get('X-Request-Id')).toBe('req-12345');
    expect(out.headers.get('Access-Control-Allow-Origin')).toBe('https://app.saome.org');
  });

  it('works on a 200 response (defense-in-depth; normal responses also pass through)', () => {
    const req = new Request('https://saome-backend.josh1989213.workers.dev/health', {
      headers: { origin: 'https://saome-frontend.josh1989213.workers.dev' },
    });
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const out = ensureCorsOnResponse(req, res);
    expect(out.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://saome-frontend.josh1989213.workers.dev',
    );
    // Hono's corsMiddleware should already have set these for 200; runtimeCors
    // is the second layer, so it just overwrites with the same values.
    expect(out.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });
});