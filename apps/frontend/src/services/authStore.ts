/**
 * In-memory auth token store — shared between AuthProvider and httpClient.
 *
 * Implementation: sessionStorage (synchronous read/write).
 *
 * Why sessionStorage instead of a module-level variable:
 *   Module-level `_accessToken` is async — a read can happen before a
 *   concurrent write completes, returning stale null even though the write
 *   eventually succeeds. This caused a race condition where httpClient.read
 *   a stale token during an in-flight refresh, sending NULL to /api/cards
 *   and triggering a spurious 401.
 *
 * sessionStorage.read and sessionStorage.write are synchronous, so
 * getAccessToken() always reflects the latest persisted value.
 *
 * Concurrency protection: withRefreshMutex ensures only one refresh is
 * in-flight at a time; subsequent callers share the same Promise rather
 * than each spawning a new request.
 */

const _STORAGE_KEY = 'saome.accessToken';

/** Guards concurrent refresh calls so they share one in-flight request. */
let _refreshPromise: Promise<unknown> | null = null;

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(_STORAGE_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token === null) {
    sessionStorage.removeItem(_STORAGE_KEY);
  } else {
    sessionStorage.setItem(_STORAGE_KEY, token);
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
