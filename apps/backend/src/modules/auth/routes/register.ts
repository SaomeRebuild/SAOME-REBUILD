/**
 * POST /api/auth/register
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { registrationPayloadSchema } from '../schemas/request';
import { registerService } from '../services/registerService';
import { ValidationError } from '@/shared/lib/saomeError';
import { getDb } from '@/shared/db/client';

export const registerRoute = new Hono<HonoEnv>().post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = registrationPayloadSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('common.error.validationFailed', {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  const sql = getDb(c.env.HYPERDRIVE);
  const jwtSecret = (c.env as { JWT_SECRET?: string }).JWT_SECRET ?? 'dev-insecure-secret';
  const ttlRaw = c.env.ACCESS_TOKEN_TTL;
  const ttl = ttlRaw ? Number(ttlRaw) : 900;
  const session = await registerService(sql, jwtSecret, parsed.data, ttl);

  // Browser: refresh token via Set-Cookie. JSON body also includes it for non-browser clients.
  if (session.refreshToken) {
    c.res.headers.append(
      'Set-Cookie',
      `saome_refresh=${session.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Domain=.saome.org; Max-Age=2592000`,
    );
  }
  return c.json({
    user: session.user,
    tenant: session.tenant,
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    refreshToken: session.refreshToken,
  }, 201);
});

export default registerRoute;