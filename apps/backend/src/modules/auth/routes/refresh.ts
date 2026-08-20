/**
 * POST /api/auth/refresh
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { refreshService } from '../services/refreshService';
import { AuthError } from '@/shared/lib/saomeError';
import { getDb } from '@/shared/db/client';
import { refreshCookieDomain, refreshCookieSecure, refreshCookieSameSite } from '@/shared/lib/cookieDomain';

function getRefreshCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';').map((s) => s.trim());
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const name = part.slice(0, eqIdx);
    if (name === 'saome_refresh') {
      return decodeURIComponent(part.slice(eqIdx + 1));
    }
  }
  return undefined;
}

export const refreshRoute = new Hono<HonoEnv>().post('/', async (c) => {
  const cookieHeader = c.req.header('Cookie');
  const token = getRefreshCookie(cookieHeader);
  if (!token) {
    throw new AuthError('auth.error.missingRefreshToken', 'Missing refresh cookie');
  }
  const sql = getDb(c.env.HYPERDRIVE);
  const jwtSecret = (c.env as { JWT_SECRET?: string }).JWT_SECRET ?? 'dev-insecure-secret';
  const ttlRaw = c.env.ACCESS_TOKEN_TTL;
  const ttl = ttlRaw ? Number(ttlRaw) : 900;
  const result = await refreshService(sql, jwtSecret, token, ttl);

  if (result.refreshToken) {
    const origin = c.req.header('Origin');
    const domainAttr = refreshCookieDomain(origin);
    const secureAttr = refreshCookieSecure(origin);
    const sameSiteAttr = refreshCookieSameSite(origin);
    const cookieHeader = `saome_refresh=${result.refreshToken}; HttpOnly${secureAttr}${sameSiteAttr}; Path=/api/auth${domainAttr}; Max-Age=2592000`;
    const jsonResponse = c.json(result);
    jsonResponse.headers.append('Set-Cookie', cookieHeader);
    return jsonResponse;
  }
  return c.json(result);
});

export default refreshRoute;