/**
 * POST /api/auth/login
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { loginCredentialsSchema } from '../schemas/request';
import { loginService } from '../services/loginService';
import { ValidationError } from '@/shared/lib/saomeError';
import { getDb } from '@/shared/db/client';
import { refreshCookieDomain, refreshCookieSecure, refreshCookieSameSite } from '@/shared/lib/cookieDomain';

export const loginRoute = new Hono<HonoEnv>()
  .post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = loginCredentialsSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('common.error.validationFailed', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const sql = getDb(c.env.HYPERDRIVE);
    const jwtSecret = (c.env as { JWT_SECRET?: string }).JWT_SECRET ?? 'dev-insecure-secret';
    const ttlRaw = c.env.ACCESS_TOKEN_TTL;
    const ttl = ttlRaw ? Number(ttlRaw) : 900;
    const session = await loginService(sql, jwtSecret, parsed.data, ttl);

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
    });
  });

export default loginRoute;