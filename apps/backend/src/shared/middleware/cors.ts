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
 */

import type { Context, MiddlewareHandler } from 'hono';
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
    c.res.headers.set('Access-Control-Allow-Expose-Headers', 'X-Request-Id');
    c.res.headers.set('Access-Control-Max-Age', '86400');
  }
  // Preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: c.res.headers,
    });
  }
  await next();
};

export function applyCorsHeaders(c: Context<HonoEnv>, response: Response): Response {
  const origin = c.req.header('Origin');
  const allowed = resolveAllowedOrigin(origin, c.env);
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', allowed);
    response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return response;
}