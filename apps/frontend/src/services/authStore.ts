/**
 * In-memory auth token store — shared between AuthProvider and httpClient.
 *
 * Problem: httpClient needs access to the current accessToken for Bearer auth,
 * but the token lives in AuthProvider state. This module bridges the gap by
 * storing the token in a module-level variable that both can read/write.
 *
 * Concurrency fix: concurrent refresh() calls race on setAccessToken.
 * The mutex ensures only one refresh is in-flight at a time; subsequent
 * callers await the same promise rather than each spawning their own.
 */

let _accessToken: string | null = null;

/** Guards concurrent refresh calls so they share one in-flight request. */
let _refreshPromise: Promise<unknown> | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

/**
 * Run a refresh operation with mutex protection.
 * If a refresh is already in-flight, return that same promise instead of
 * starting a new one. This prevents concurrent refresh() calls from stomping
 * on each other's setAccessToken calls.
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
