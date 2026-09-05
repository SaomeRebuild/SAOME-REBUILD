/**
 * POST /api/auth/logout
 *
 * B4 (2026-09-05): implements the silent-logout bug fix from
 * `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md` (option A).
 *
 * The route is **stateless and idempotent**: it does NOT depend on DB
 * success — if revocation fails for any reason (DB unavailable, malformed
 * token), the Set-Cookie clear still proceeds and the client clears its
 * own tokens. Returns 200 regardless.
 *
 * The browser-side fix:
 *   - Server emits `Set-Cookie: saome_refresh=; Max-Age=0; Path=/api/auth`
 *     so the HttpOnly cookie is cleared.
 *   - Client clears its sessionStorage tokens (handled by `authService.logout`
 *     on the frontend).
 *
 * Phase 2.2 (2026-09-05) wires option B: when a refresh token is present
 * (cookie or Bearer), additionally INSERT its jti into
 * `public.revoked_tokens`. The DB write is best-effort — if it fails, the
 * Set-Cookie path still completes and the user is logged out from the
 * browser's perspective. Server-side revocation is defense-in-depth.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { buildLogoutCookieAttrs, buildLogoutSetCookie, revokeRefreshToken } from '../services/logoutService';
import { getDb } from '@/shared/db/client';

function getRefreshCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';').map((s) => s.trim());
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const name = part.slice(0, eqIdx);
    if (name === 'saome_refresh') {
      // Wrap decode in try-catch — malformed cookie values (e.g. unterminated
      // %-encoding) would otherwise throw URIError and the route would 500.
      // The route is intentionally stateless and idempotent, so we treat
      // garbage cookies as "no cookie present" and proceed.
      try {
        return decodeURIComponent(part.slice(eqIdx + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function getBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
  return authHeader.slice('Bearer '.length).trim();
}

export const logoutRoute = new Hono<HonoEnv>().post('/', async (c) => {
  const cookieHeader = c.req.header('Cookie');
  const authHeader = c.req.header('Authorization');
  const origin = c.req.header('Origin');

  // Detect whether the caller had any refresh credential. Either:
  //   - HttpOnly `saome_refresh` cookie (same-origin browser case)
  //   - `Authorization: Bearer <refreshToken>` (cross-origin SPA case)
  const refreshToken = getRefreshCookie(cookieHeader) ?? getBearerToken(authHeader);
  const hadCredential = Boolean(refreshToken);

  // Phase 2.2: optional server-side revocation (best-effort, non-blocking).
  // If the DB is down or the token is malformed we still clear the cookie.
  if (refreshToken) {
    try {
      const sql = await getDb(c.env.HYPERDRIVE);
      const jwtSecret = (c.env as { JWT_SECRET?: string }).JWT_SECRET ?? '';
      if (jwtSecret) {
        await revokeRefreshToken(sql, refreshToken, jwtSecret);
      }
    } catch (err) {
      console.warn(
        '[POST /api/auth/logout] revokeRefreshToken failed; continuing without DB revocation:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const attrs = buildLogoutCookieAttrs(origin, hadCredential);
  const setCookieHeader = buildLogoutSetCookie(attrs);

  const jsonResponse = c.json({ loggedOut: true });
  // Always emit Set-Cookie so the browser defensively clears any stale
  // `saome_refresh` cookie (covers the case where the client forgot to
  // attach the credential header but the cookie still exists in the jar).
  jsonResponse.headers.append('Set-Cookie', setCookieHeader);
  return jsonResponse;
});

export default logoutRoute;
