/**
 * POST /api/auth/register
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { registrationPayloadSchema } from '../schemas/request';
import { registerService } from '../services/registerService';
import { ValidationError } from '@/shared/lib/saomeError';
import { getDb } from '@/shared/db/client';
import { refreshCookieDomain, refreshCookieSecure, refreshCookieSameSite } from '@/shared/lib/cookieDomain';

export const registerRoute = new Hono<HonoEnv>().post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = registrationPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      i18nKey: i.message,
    }));
    throw new ValidationError(issues[0]?.i18nKey ?? 'common.error.validationFailed', {
      issues,
    });
  }
  const sql = getDb(c.env.HYPERDRIVE);
  const jwtSecret = (c.env as { JWT_SECRET?: string }).JWT_SECRET ?? 'dev-insecure-secret';
  const ttlRaw = c.env.ACCESS_TOKEN_TTL;
  const ttl = ttlRaw ? Number(ttlRaw) : 900;
  const session = await registerService(sql, jwtSecret, parsed.data, ttl);

  // Browser: refresh token via Set-Cookie. JSON body also includes it for non-browser clients.
  if (session.refreshToken) {
    const origin = c.req.header('Origin');
    const domainAttr = refreshCookieDomain(origin);
    const secureAttr = refreshCookieSecure(origin);
    const sameSiteAttr = refreshCookieSameSite(origin);
    c.res.headers.append(
      'Set-Cookie',
      `saome_refresh=${session.refreshToken}; HttpOnly${secureAttr}${sameSiteAttr}; Path=/api/auth${domainAttr}; Max-Age=2592000`,
    );
  }
  return c.json({
    user: session.user,
    tenant: session.tenant,
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    refreshToken: session.refreshToken,
    pass: session.pass,
  }, 201);
});

export default registerRoute;