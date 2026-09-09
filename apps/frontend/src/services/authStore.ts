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
 *   - saome.tokenIssuedAt — Unix ms timestamp when the current access token
 *                            was issued (set by setAccessToken). Used by
 *                            scheduleProactiveRefresh() to refresh before TTL.
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
const _TOKEN_ISSUED_AT_KEY = 'saome.tokenIssuedAt';

/**
 * ACCESS_TOKEN_TTL_MS — mirrors the backend JWT TTL (apps/backend/src/shared/lib/jwt.ts).
 * Proactive refresh fires PROACTIVE_REFRESH_BEFORE_MS before expiry so the user
 * never hits an expired-token 401 in the middle of a session.
 */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const PROACTIVE_REFRESH_BEFORE_MS = 60 * 1000; // refresh 1 min before expiry

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
    sessionStorage.removeItem(_TOKEN_ISSUED_AT_KEY);
  } else {
    sessionStorage.setItem(_ACCESS_TOKEN_KEY, token);
    // Track when this token was issued so scheduleProactiveRefresh() can
    // compute the correct deadline (token expiry = issuedAt + ACCESS_TOKEN_TTL_MS).
    sessionStorage.setItem(_TOKEN_ISSUED_AT_KEY, String(Date.now()));
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

// ================================================================
// Proactive token refresh (Fix 401 — 2026-09-09)
// ================================================================

/**
 * Returns the Unix-ms timestamp when the current access token was issued,
 * or null if no token is stored.
 */
export function getTokenIssuedAt(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(_TOKEN_ISSUED_AT_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Guards the proactive refresh timer so only one setTimeout runs at a time.
 * Stored at module scope so cancelProactiveRefresh() can clear it.
 */
let _proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule a proactive token refresh.
 *
 * This is the "refresh before expiry" strategy: instead of waiting for a
 * 401 to trigger tryRefresh() (reactive), we schedule a refresh ~14 min
 * after the token is issued — 1 minute before the 15-min TTL expires. The
 * user never sees an expired-token 401 mid-session.
 *
 * Call this from AuthProvider after setTokens() and cancel it on logout.
 * Calling it twice cancels the previous timer and schedules a fresh one.
 *
 * @param refreshFn  The async refresh operation (typically authService.refresh).
 *                   Must return truthy on success, falsy on failure.
 */
export function scheduleProactiveRefresh(refreshFn: () => Promise<unknown>): void {
  if (typeof window === 'undefined') return;

  // Cancel any previously scheduled timer (idempotent — safe to call twice).
  cancelProactiveRefresh();

  const issuedAt = getTokenIssuedAt();
  if (!issuedAt) return; // No token → nothing to schedule

  const expiresAt = issuedAt + ACCESS_TOKEN_TTL_MS;
  const refreshAt = expiresAt - PROACTIVE_REFRESH_BEFORE_MS; // 1 min before TTL
  const delayMs = refreshAt - Date.now();

  if (delayMs <= 0) {
    // Token is already expired or about to expire — refresh immediately.
    refreshFn().catch(() => {
      // Swallow: reactive tryRefresh() in httpClient will handle persistent failures.
    });
    return;
  }

  if (import.meta.env.DEV) {
    const mins = Math.round(delayMs / 60000 * 10) / 10;
    console.debug(`[authStore] scheduleProactiveRefresh in ${mins} min (token expires in ${ACCESS_TOKEN_TTL_MS / 60000} min)`);
  }

  _proactiveRefreshTimer = setTimeout(() => {
    if (import.meta.env.DEV) console.debug('[authStore] proactive refresh firing...');
    refreshFn()
      .then(() => {
        if (import.meta.env.DEV) console.debug('[authStore] proactive refresh succeeded');
      })
      .catch(() => {
        // Swallow: reactive tryRefresh() in httpClient will handle persistent failures.
        // Log at warn level so it's visible in dev but doesn't crash.
        if (import.meta.env.DEV) console.warn('[authStore] proactive refresh failed — will retry on next 401');
      });
  }, delayMs);
}

/**
 * Cancel any pending proactive refresh timer.
 * Idempotent — safe to call even if no timer is scheduled.
 */
export function cancelProactiveRefresh(): void {
  if (_proactiveRefreshTimer !== null) {
    clearTimeout(_proactiveRefreshTimer);
    _proactiveRefreshTimer = null;
  }
}
