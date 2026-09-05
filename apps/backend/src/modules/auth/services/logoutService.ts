/**
 * Logout service — cookie-clear helper + (Phase 2.2) optional revocation.
 *
 * @module modules/auth/services/logoutService
 *
 * B4 (2026-09-05): implements Decision Log
 * `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md` option A
 * (cookie + JWT short TTL).
 *
 * For the MVP path we do NOT touch the DB. The actual revocation is:
 *   - The server emits `Set-Cookie: saome_refresh=; Max-Age=0` so the
 *     browser drops the HttpOnly cookie.
 *   - The client clears its own sessionStorage tokens.
 *   - Any existing access token will expire naturally within its TTL
 *     (default 1h, see wrangler.jsonc ACCESS_TOKEN_TTL).
 *
 * Phase 2.2 (2026-09-05) wires option B: when a refresh token is presented
 * (cookie or Bearer), we additionally INSERT its `jti` into
 * `public.revoked_tokens` so any access tokens already issued under that
 * jti lineage get rejected at verify time. Cookie clearing stays as the
 * primary path — revocation is the defense-in-depth backstop.
 *
 * This service only computes the cookie-clear header attribute strings.
 * The route assembles the final `Set-Cookie` value and may call
 * `revokeRefreshToken` for the optional DB-side revocation.
 */

import type { Sql } from '@/shared/db/client';
import type { HonoEnv } from '@/shared/types/bindings';
import {
  refreshCookieDomain,
  refreshCookieSecure,
  refreshCookieSameSite,
} from '@/shared/lib/cookieDomain';
import { revokeToken } from '../db/revokedTokens';
import { verifyToken } from '@/shared/lib/jwt';

export interface LogoutCookieAttrs {
  /** Whether the request had any refresh credential (cookie or Bearer). */
  hadRefreshCredential: boolean;
  /** `Domain=...` attribute, or empty string. */
  domain: string;
  /** `; Secure` for HTTPS origin, empty for HTTP. */
  secure: string;
  /** `; SameSite=...` attribute. */
  sameSite: string;
}

/**
 * Build the cookie attribute strings for the logout Set-Cookie header.
 *
 * @param originHeader   Origin header from the request (or null).
 * @param hadCredential  Whether the request carried a refresh cookie OR
 *                       an Authorization: Bearer refresh token.
 * @returns              Attribute fragments ready for string interpolation.
 */
export function buildLogoutCookieAttrs(
  originHeader: string | null | undefined,
  hadCredential: boolean,
): LogoutCookieAttrs {
  return {
    hadRefreshCredential: hadCredential,
    domain: refreshCookieDomain(originHeader),
    secure: refreshCookieSecure(originHeader),
    sameSite: refreshCookieSameSite(originHeader),
  };
}

/**
 * Assemble the full Set-Cookie value for clearing the refresh cookie.
 *
 * The resulting header is:
 *   `saome_refresh=; HttpOnly{secure}{sameSite}; Path=/api/auth{domain}; Max-Age=0`
 *
 * - HttpOnly: prevents JS access (defense in depth)
 * - Secure:   only for HTTPS origins (dev HTTP drops it for cross-site compat)
 * - SameSite: Lax for HTTP (dev), None for HTTPS (cross-origin prod)
 * - Path:     only `/api/auth` so the cookie scope is minimal
 * - Max-Age=0: instructs browser to delete the cookie immediately
 */
export function buildLogoutSetCookie(attrs: LogoutCookieAttrs): string {
  const { hadRefreshCredential, domain, secure, sameSite } = attrs;
  // We always emit the Set-Cookie header (even when hadCredential=false) so
  // the browser defensively clears any stale cookie it might still hold.
  // The route decides whether to attach this header.
  return `saome_refresh=; HttpOnly${secure}${sameSite}; Path=/api/auth${domain}; Max-Age=0`;
}

/**
 * Phase 2.2 (2026-09-05): revoke a refresh token's jti in
 * `public.revoked_tokens`. Defensive — never throws; failures are logged
 * but do not block the logout response (cookie-clear is the primary path).
 *
 * @param sql         Postgres.js client
 * @param refreshToken The raw refresh token JWT (cookie or Bearer value)
 * @param jwtSecret   Server JWT secret used for verifyToken()
 * @returns           true if revocation succeeded, false on any error
 */
export async function revokeRefreshToken(
  sql: Sql,
  refreshToken: string,
  jwtSecret: string,
): Promise<boolean> {
  try {
    const payload = await verifyToken(refreshToken, jwtSecret);
    // expires_at on the revocation row = when the token would have
    // expired naturally. The pg_cron cleanup job deletes rows past this
    // point so the table stays bounded.
    const expiresAt = new Date(payload.exp * 1000);
    await revokeToken(sql, payload.jti, expiresAt, 'logout');
    return true;
  } catch (err) {
    console.warn(
      '[logoutService.revokeRefreshToken] verify failed; skipping DB revocation:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * Re-export for convenience in tests.
 */
export { refreshCookieDomain, refreshCookieSecure, refreshCookieSameSite };
