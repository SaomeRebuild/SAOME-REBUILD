/**
 * Runtime-level CORS helper for the Worker entry boundary.
 *
 * @module shared/middleware/runtimeCors
 * @description Belt-and-suspenders CORS injection that runs OUTSIDE of the
 * Hono middleware chain. The Hono `corsMiddleware` (wrap-after-next) and
 * `errorHandler` (inline CORS injection) only run INSIDE the Hono pipeline,
 * so any Response emitted by the Worker runtime before Hono's middleware
 * starts (e.g., top-level unhandled exception, binding resolution failure,
 * CPU/memory limit exceeded) has no CORS headers at all — and the browser
 * silently drops the response.
 *
 * This module is a separate file (not part of `cors.ts`) so it can be
 * imported by `index.ts` AND tested in isolation without pulling in the
 * entire Hono app (and the cards module's transitive `@saome/shared/logic`
 * alias chain).
 *
 * The allow-list is intentionally hard-coded (not env-driven) because:
 *   - `ensureCorsOnResponse` runs at the Worker entry point, where
 *     `c.env` is NOT available (the request hasn't entered Hono yet).
 *   - Reading env would require duplicating `parseAllowedOrigins` here.
 *   - This list is intentionally narrow — only production frontend
 *     origins. Dev origins (localhost, pages.dev previews) don't go
 *     through this path because the CORS middleware handles them.
 *
 * Mirrors the dev/prod allowlist in `wrangler.jsonc::ALLOWED_ORIGINS` and
 * `ALLOWED_ORIGIN_PATTERNS`. If you add a new production origin to
 * wrangler.jsonc, also add it here.
 */

const RUNTIME_ALLOWED_HOSTS = new Set([
  'saome-frontend.josh1989213.workers.dev',
  'saome-admin.josh1989213.workers.dev',
  'saome-frontend.pages.dev',
  'saome-admin.pages.dev',
  'app.saome.org',
  'admin.saome.org',
]);

const RUNTIME_ALLOWED_HOST_PATTERNS: RegExp[] = [
  /^[a-z0-9-]+\.josh1989213\.workers\.dev$/i,
  /^[a-z0-9-]+\.saome-frontend\.pages\.dev$/i,
  /^[a-z0-9-]+\.saome-admin\.pages\.dev$/i,
  /^[a-z0-9-]+\.app\.saome\.org$/i,
  /^[a-z0-9-]+\.admin\.saome\.org$/i,
];

/**
 * Test if a hostname is on the runtime allow-list (exact match or pattern).
 */
export function isRuntimeAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (RUNTIME_ALLOWED_HOSTS.has(h)) return true;
  return RUNTIME_ALLOWED_HOST_PATTERNS.some((re) => re.test(h));
}

/**
 * Belt-and-suspenders CORS injection at the Worker runtime boundary.
 *
 * If a Response leaves the Worker without CORS headers (e.g., Cloudflare
 * runtime emitted a 503 before our Hono chain ran), this helper re-adds
 * `Access-Control-Allow-Origin` based on the request's Origin header.
 * Without this, the browser sees a 503 with no CORS headers and silently
 * drops the response (regression — 2026-09-06 production CORS drop).
 *
 * Defense-in-depth: only echoes back the origin if its host is on the
 * hard-coded allow-list. We do NOT trust arbitrary origins even if the
 * request reached this layer.
 */
export function ensureCorsOnResponse(request: Request, response: Response): Response {
  const origin = request.headers.get('Origin');
  if (!origin) return response;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return response;
  }
  if (!isRuntimeAllowedHost(host)) return response;

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}