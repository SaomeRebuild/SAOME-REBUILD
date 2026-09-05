/**
 * Logout service — stateless cookie-clear helper.
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
 *     (default 8h; see follow-up to shorten to 1h).
 *
 * This service only computes the cookie-clear header attribute strings.
 * The route assembles the final `Set-Cookie` value.
 *
 * Future paths (post-MVP):
 *   - Option B: insert `jti` into `public.revoked_tokens` so the next
 *     `verifyToken()` rejects it before TTL.
 *   - Option C: write to a Cloudflare KV binding with TTL.
 */

import type { HonoEnv } from '@/shared/types/bindings';
import {
  refreshCookieDomain,
  refreshCookieSecure,
  refreshCookieSameSite,
} from '@/shared/lib/cookieDomain';

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
 * Re-export for convenience in tests.
 */
export { refreshCookieDomain, refreshCookieSecure, refreshCookieSameSite };
