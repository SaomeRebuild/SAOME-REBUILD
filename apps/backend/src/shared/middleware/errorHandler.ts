/**
 * Global error handler middleware.
 *
 * @module shared/middleware/errorHandler
 * @description Converts any thrown `SaomeError` (or unknown error) into a
 * structured JSON response. Registered as `app.onError()` in src/index.ts.
 */

import type { Context } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { SaomeError, ServerError } from '@/shared/lib/saomeError';
import { applyCorsHeaders } from './cors';
import { REQUEST_ID_KEY } from './requestId';

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
  return applyCorsHeaders(
    c,
    new Response(JSON.stringify(body), { status: saomeError.status, headers }),
  );
}

export const errorHandler = (err: Error, c: Context<HonoEnv>) => buildErrorResponse(c, err);

export { SaomeError, ServerError };