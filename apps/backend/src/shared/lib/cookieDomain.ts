/**
 * Domain helpers for Set-Cookie on auth routes.
 *
 * Bug-4 fix: in production the frontend is deployed to multiple origins
 * (saome-frontend.pages.dev, app.saome.org, admin.saome.org, …).
 * - If the request `Origin` belongs to the saome.org production domain
 *   family, we emit `Domain=.saome.org` so the cookie is shared across
 *   subdomains (app/admin/...).
 * - For any other origin (workers.dev, pages.dev, localhost, missing),
 *   we OMIT `Domain`. The browser will then scope the cookie to the
 *   exact host that issued the response, which is what we want for
 *   each Cloudflare Pages domain.
 */

const SAOME_ORG_SUFFIX = '.saome.org';

/**
 * Build the `Domain=...` portion of a Set-Cookie header for a refresh cookie.
 *
 * Returns `' Domain=.saome.org'` (with leading space) or `''` (empty) when no
 * Domain attribute should be emitted. Always include the leading space so the
 * value can be inlined directly into a Set-Cookie string.
 */
export function refreshCookieDomain(originHeader: string | null | undefined): string {
  if (!originHeader) return '';
  try {
    const host = new URL(originHeader).hostname.toLowerCase();
    if (host === 'saome.org' || host.endsWith(SAOME_ORG_SUFFIX)) {
      return ' Domain=.saome.org';
    }
  } catch {
    // Not a parseable URL — treat as no Domain
  }
  return '';
}

/**
 * Decide the `Secure` flag for the refresh Set-Cookie header.
 *
 * Bug-7: browsers reject `Secure` cookies on non-secure (HTTP) documents.
 * The dev frontend at http://localhost:5173 cannot store `Secure` cookies
 * even though the backend is HTTPS — the **document context** determines
 * cookie acceptance. We must drop `Secure` for HTTP origins so dev works.
 *
 * Rule:
 *   - Origin is HTTPS (or missing — assume production) → emit `; Secure`
 *   - Origin is HTTP (e.g. localhost dev) → emit empty string (no Secure)
 *
 * Production deployment of saome-frontend.pages.dev / app.saome.org is HTTPS
 * so this naturally resolves to `; Secure`. Dev (http://localhost:5173) drops
 * the flag so the cookie can be stored by the browser.
 */
export function refreshCookieSecure(originHeader: string | null | undefined): string {
  if (!originHeader) return '; Secure';
  try {
    const protocol = new URL(originHeader).protocol.toLowerCase();
    if (protocol === 'https:') return '; Secure';
    return '';
  } catch {
    // Not a parseable URL — assume secure origin (production default)
    return '; Secure';
  }
}

/**
 * Decide the `SameSite` attribute for the refresh Set-Cookie header.
 *
 * Bug-7 follow-up: `SameSite=Lax` cookies are NOT sent on cross-site
 * sub-requests (POST refresh, GET /me from a different eTLD+1 site). When
 * the dev frontend at http://localhost:5173 POSTs to
 * https://saome-backend.josh1989213.workers.dev (or any other non-same-site
 * backend), the browser will not attach the cookie on the refresh call,
 * silently logging the user out on every navigation.
 *
 * To survive cross-site, we must use `SameSite=None`. However the
 * browser spec **mandates** `Secure` whenever `SameSite=None` is used, so
 * this helper must be paired with `refreshCookieSecure`.
 *
 * Rule:
 *   - Origin is HTTPS → `; SameSite=None` (with Secure, so it works cross-site)
 *   - Origin is HTTP (localhost dev cross-site to HTTPS backend) → `; SameSite=Lax`
 *     (Lax survives same-site POST; cross-site dev pages won't carry the cookie
 *     but the backend must be reached via a same-origin proxy in that case.)
 *   - Origin missing → `; SameSite=None` (production default)
 */
export function refreshCookieSameSite(originHeader: string | null | undefined): string {
  if (!originHeader) return '; SameSite=None';
  try {
    const protocol = new URL(originHeader).protocol.toLowerCase();
    if (protocol === 'https:') return '; SameSite=None';
    return '; SameSite=Lax';
  } catch {
    return '; SameSite=None';
  }
}