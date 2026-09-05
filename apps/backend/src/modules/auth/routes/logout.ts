/**
 * POST /api/auth/logout
 *
 * B4 (2026-09-05): implements the silent-logout bug fix from
 * `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md` (option A).
 *
 * The route is **stateless and idempotent**: it does NOT touch the DB, and
 * it returns 200 regardless of whether the caller supplied a refresh cookie
 * or Bearer token. The browser-side fix is:
 *   - Server emits `Set-Cookie: saome_refresh=; Max-Age=0; Path=/api/auth`
 *     so the HttpOnly cookie is cleared.
 *   - Client clears its sessionStorage tokens (handled by `authService.logout`
 *     on the frontend).
 *
 * Why idempotent: a logout retry (e.g. flaky network → user double-clicks)
 * should always succeed; the route never errors on missing credentials.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { buildLogoutCookieAttrs, buildLogoutSetCookie } from '../services/logoutService';

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
  const hadCredential =
    Boolean(getRefreshCookie(cookieHeader)) || Boolean(getBearerToken(authHeader));

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
