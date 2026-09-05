/**
 * CORS middleware.
 *
 * @module shared/middleware/cors
 * @description Adds CORS headers based on `env.ALLOWED_ORIGINS` (comma-separated
 *   explicit origins) **plus** a set of allowed-host glob patterns
 *   (`env.ALLOWED_ORIGIN_PATTERNS`, also comma-separated). This lets us
 *   accept Workers-preview URLs (`*.josh1989213.workers.dev`) and
 *   Cloudflare Pages previews (`*.saome-frontend.pages.dev`) without
 *   hard-coding each variant.
 *
 *   The browser CORS spec forbids `Access-Control-Allow-Origin: *` when
 *   `Access-Control-Allow-Credentials: true`, so we have to echo the
 *   exact origin back. Our `resolveAllowedOrigin` does that, supporting:
 *     - exact match in ALLOWED_ORIGINS
 *     - match via ALLOWED_ORIGIN_PATTERNS (host glob like `*.workers.dev`)
 *
 *   B2 (2026-09-05): the middleware now uses a **wrap-after-next** shape —
 *   we await `next()` first and then set CORS headers on `c.res`, which by
 *   then is the FINAL response object. This defends against the failure
 *   mode where route handlers return `new Response(...)` and drop headers
 *   that were set before `await next()`.
 */

import type { MiddlewareHandler } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

/**
 * Test if `host` matches a wildcard host pattern.
 *
 * Supports two forms:
 *   - "*.example.com"  →  matches any subdomain of example.com, including
 *                          multi-level (e.g. "a.b.example.com"), but NOT the
 *                          bare apex ("example.com")
 *   - "example.com"    →  exact match (no wildcard)
 *
 * Case-insensitive on host.
 */
export function matchHostPattern(host: string, pattern: string): boolean {
  const p = pattern.toLowerCase();
  const h = host.toLowerCase();
  if (p.startsWith('*.')) {
    const suffix = p.slice(1); // ".example.com"
    return h.endsWith(suffix) && h.length > suffix.length;
  }
  return h === p;
}

/**
 * Resolve the request origin against the configured allowlists.
 *
 * Returns the **exact** origin string to echo back in
 * `Access-Control-Allow-Origin` (so credentials are allowed), or
 * `undefined` if the origin is not allowed.
 */
export function resolveAllowedOrigin(
  origin: string | undefined,
  env: HonoEnv['Bindings'],
): string | undefined {
  if (!origin) return undefined;
  let parsedHost: string;
  try {
    parsedHost = new URL(origin).host.toLowerCase();
  } catch {
    return undefined;
  }

  const allowedOrigins = (env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowedOrigins.includes(origin)) return origin;

  const allowedPatterns = (env.ALLOWED_ORIGIN_PATTERNS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const pattern of allowedPatterns) {
    if (matchHostPattern(parsedHost, pattern)) return origin;
  }

  return undefined;
}

export const corsMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const origin = c.req.header('Origin');
  const allowed = resolveAllowedOrigin(origin, c.env);

  // Preflight short-circuit: handled before await next() because OPTIONS
  // doesn't delegate to a route handler. Build a fresh 204 with CORS
  // headers inline.
  if (c.req.method === 'OPTIONS') {
    if (!allowed) {
      // Out of scope for B2: 204 with no CORS headers is sufficient — the
      // browser treats it as a CORS rejection. We deliberately do NOT
      // upgrade this to 403 to keep the user's request scope minimal.
      return new Response(null, { status: 204 });
    }
    const headers = new Headers({
      'Access-Control-Allow-Origin': allowed,
      Vary: 'Origin',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id',
      'Access-Control-Expose-Headers': 'X-Request-Id',
      'Access-Control-Max-Age': '86400',
    });
    return new Response(null, { status: 204, headers });
  }

  // Non-OPTIONS: await the route handler FIRST, then set CORS headers on
  // `c.res` (which by now is the FINAL response object). This is the
  // defensive wrap-after-next shape that survives handlers that return
  // a fresh `new Response(...)` (where pre-await header assignments
  // could be discarded). Real Cloudflare Workers + certain Hono
  // response handlers (streaming, error.onError, etc.) DO lose headers
  // when they're set before await next(); vitest happens to not exercise
  // that path so tests pass either way, but the production-safe pattern
  // is wrap-after-next.
  await next();

  if (allowed) {
    c.res.headers.set('Access-Control-Allow-Origin', allowed);
    c.res.headers.set('Vary', 'Origin');
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    );
    c.res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-Id',
    );
    c.res.headers.set('Access-Control-Expose-Headers', 'X-Request-Id');
    c.res.headers.set('Access-Control-Max-Age', '86400');
  }
};

/**
 * CORS response-header helper — used by errorHandler.ts so onError-emitted
 * responses (which bypass corsMiddleware's wrap-after-next path) still
 * carry CORS headers.
 *
 * Why this lives in errorHandler.ts and not here:
 *   - corsMiddleware uses `wrap-after-next` (sets headers on `c.res` AFTER
 *     `await next()`) for the normal response path.
 *   - But `app.onError()` runs as a SIBLING of the middleware chain — when
 *     a route handler throws, control transfers to onError, NOT to the
 *     middleware's wrap-after-next block (the throw exits the middleware
 *     function before it can set headers on the new response).
 *   - So onError-built responses need their own CORS-header injection.
 *     This helper is the single seam for that injection.
 *
 * Phase 3.3 (2026-09-05): this helper moved from cors.ts into
 * errorHandler.ts as a private function. cors.ts no longer exports any
 * response-decoration helper — it only owns the middleware itself.
 * If a future caller needs the same logic, copy the pattern from
 * errorHandler.ts (or pull it back out into shared/middleware/ if a
 * second consumer appears).
 */
