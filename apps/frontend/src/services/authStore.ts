/**
 * In-memory auth token store — shared between AuthProvider and httpClient.
 *
 * Implementation: sessionStorage (synchronous read/write).
 *
 * Stores both:
 *   - saome.accessToken  — the JWT access token (Bearer auth)
 *   - saome.refreshToken — the refresh token (used as Bearer auth on
 *                            cross-origin refresh calls; avoids the
 *                            SameSite=None cookie scoping issue where the
 *                            browser refuses to attach a cookie scoped to
 *                            Domain=saome-backend.josh1989213.workers.dev
 *                            when the frontend is on saome-frontend.*)
 *
 * sessionStorage.read and sessionStorage.write are synchronous, so
 * getAccessToken() always reflects the latest persisted value.
 *
 * Concurrency protection: withRefreshMutex ensures only one refresh is
 * in-flight at a time; subsequent callers share the same Promise rather
 * than each spawning a new request.
 */

const _ACCESS_TOKEN_KEY = 'saome.accessToken';
const _REFRESH_TOKEN_KEY = 'saome.refreshToken';

/** Guards concurrent refresh calls so they share one in-flight request. */
let _refreshPromise: Promise<unknown> | null = null;

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(_ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(_REFRESH_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token === null) {
    sessionStorage.removeItem(_ACCESS_TOKEN_KEY);
  } else {
    sessionStorage.setItem(_ACCESS_TOKEN_KEY, token);
  }
}

export function setRefreshToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token === null) {
    sessionStorage.removeItem(_REFRESH_TOKEN_KEY);
  } else {
    sessionStorage.setItem(_REFRESH_TOKEN_KEY, token);
  }
}

/**
 * Run a refresh operation with mutex protection.
 * If a refresh is already in-flight, return that same promise instead of
 * starting a new one. This prevents concurrent refresh() calls from stomping
 * on each other's token state.
 *
 * @param fn  The async refresh operation (e.g. authService.refresh)
 * @returns   The result of fn (typically AuthSessionWithTenant)
 */
export async function withRefreshMutex<T>(fn: () => Promise<T>): Promise<T> {
  if (!_refreshPromise) {
    _refreshPromise = fn().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise as Promise<T>;
}
