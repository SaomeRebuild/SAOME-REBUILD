/**
 * Per-email login rate limit middleware.
 *
 * @module modules/auth/middleware/rateLimit
 * @description Counts failed login attempts in the last 10 minutes for the
 * email in the request body. If >= 3, respond 429.
 */

import type { MiddlewareHandler } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { countRecentFailures } from '../db/loginAttempts';
import { RateLimitError } from '@/shared/lib/saomeError';
import { getDb } from '@/shared/db/client';

export const LOCKOUT_THRESHOLD = 3;
export const LOCKOUT_WINDOW_SECONDS = 600;

export const rateLimitMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  let body: { email?: unknown };
  try {
    // Clone request so the route handler can re-read the body.
    body = (await c.req.json().catch(() => ({}))) as { email?: unknown };
  } catch {
    body = {};
  }
  const email = typeof body.email === 'string' ? body.email : '';
  if (!email) {
    // No email → let downstream zod validation handle 400
    await next();
    return;
  }
  const sql = getDb(c.env.HYPERDRIVE);
  const fails = await countRecentFailures(sql, email, LOCKOUT_WINDOW_SECONDS);
  if (fails >= LOCKOUT_THRESHOLD) {
    throw new RateLimitError(
      LOCKOUT_WINDOW_SECONDS,
      'auth.error.locked',
      { remainingFails: fails - LOCKOUT_THRESHOLD },
    );
  }
  await next();
};