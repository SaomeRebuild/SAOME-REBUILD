/**
 * Request ID middleware.
 *
 * @module shared/middleware/requestId
 * @description Generates (or accepts) an X-Request-Id header and stores it in
 * Hono context for logging in errorHandler.
 */

import type { MiddlewareHandler } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

export const REQUEST_ID_KEY = 'requestId';

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export const requestIdMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const incoming = c.req.header('X-Request-Id');
  const id = incoming && incoming.length <= 128 ? incoming : generateRequestId();
  c.set(REQUEST_ID_KEY as never, id as never);
  await next();
  // Set the response header (Hono allows header set after handler ran)
  c.res.headers.set('X-Request-Id', id);
};