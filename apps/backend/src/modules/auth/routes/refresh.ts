/**
 * POST /api/auth/refresh
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { refreshService } from '../services/refreshService';
import { AuthError } from '@/shared/lib/saomeError';
import { getDb } from '@/shared/db/client';

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
    c.res.headers.append(
      'Set-Cookie',
      `saome_refresh=${result.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Domain=.saome.org; Max-Age=2592000`,
    );
  }
  return c.json({
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    refreshToken: result.refreshToken,
  });
});

export default refreshRoute;