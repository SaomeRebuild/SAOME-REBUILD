/**
 * Global error handler middleware.
 *
 * @module shared/middleware/errorHandler
 * @description Converts any thrown `SaomeError` (or unknown error) into a
 * structured JSON response. Registered as `app.onError()` in src/index.ts.
 *
 * Phase 3.3 (2026-09-05) refactor: this file now owns the CORS-header
 * injection for onError-emitted responses (previously delegated to
 * `applyCorsHeaders` exported from cors.ts). See the CORS header helper
 * section below for the rationale.
 */

import type { Context } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { SaomeError, ServerError } from '@/shared/lib/saomeError';
import { resolveAllowedOrigin } from './cors';
import { REQUEST_ID_KEY } from './requestId';

/**
 * CORS response-header helper, inlined into errorHandler.ts as a
 * private function (Phase 3.3, 2026-09-05).
 *
 * Why this lives here, not in cors.ts:
 *   - corsMiddleware uses `wrap-after-next` (sets headers on `c.res`
 *     AFTER `await next()`) for the normal response path.
 *   - But `app.onError()` runs as a SIBLING of the middleware chain —
 *     when a route handler throws, control transfers to onError, NOT
 *     to the middleware's wrap-after-next block (the throw exits the
 *     middleware function before it can set headers on the new
 *     response).
 *   - So onError-built responses need their own CORS-header injection.
 *     This helper is the single seam for that injection.
 *
 * If a future caller (other than errorHandler) needs the same logic,
 * promote it back to shared/middleware/ (with a unit test) rather
 * than re-importing from errorHandler.ts.
 */
function applyCorsHeadersToResponse(c: Context<HonoEnv>, response: Response): Response {
  const origin = c.req.header('Origin');
  const allowed = resolveAllowedOrigin(origin, c.env);
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', allowed);
    response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return response;
}

export function buildErrorResponse(c: Context<HonoEnv>, error: unknown): Response {
  const requestId = (c.get as (k: string) => string | undefined)(REQUEST_ID_KEY) ?? 'unknown';
  const saomeError =
    error instanceof SaomeError ? error : new ServerError(error);
  const body = {
    error: {
      code: saomeError.code,
      i18nKey: saomeError.i18nKey,
      message: saomeError.message,
      ...(saomeError.details ? { details: saomeError.details } : {}),
    },
    requestId,
  };
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
  };
  return applyCorsHeadersToResponse(
    c,
    new Response(JSON.stringify(body), { status: saomeError.status, headers }),
  );
}

export const errorHandler = (err: Error, c: Context<HonoEnv>) => {
  // Log for observability — console goes to wrangler stdout → backend.log
  const requestId = (c.get as (k: string) => string | undefined)(REQUEST_ID_KEY) ?? 'unknown';
  console.error(`[errorHandler] requestId=${requestId} error=${err?.constructor?.name} message=${err?.message ?? String(err)}`);
  if (err?.stack) {
    console.error(`[errorHandler] stack:\n${err.stack.split('\n').slice(0, 5).join('\n')}`);
  }
  return buildErrorResponse(c, err);
};

export { SaomeError, ServerError };