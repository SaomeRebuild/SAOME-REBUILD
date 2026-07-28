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