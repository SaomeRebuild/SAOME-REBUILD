/**
 * httpClient — fetch wrapper with credentials, JSON handling, and 401 retry-via-refresh.
 *
 * Side-effect on RATE_LIMITED: if the server returns 429 on /api/auth/login,
 * the local `saome.login.lockout.v1` entry is updated to the server's
 * authoritative `retryAfterSec`. This stops the UI from looping forever
 * (UI keeps local countdown slightly ahead, backend stays source-of-truth
 * via DB login_attempts).
 */

import { api } from '@/config/api';
import { limits } from '@/config/limits';
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  withRefreshMutex,
} from './authStore';
import { ROUTES } from '@/config/routes';

export class SaomeApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly i18nKey?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly details?: Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(status: number, body: { error?: { code?: string; i18nKey?: string; message?: string; details?: any }; message?: string }) {
    super(body?.error?.message ?? body?.message ?? 'API error');
    this.name = 'SaomeApiError';
    this.status = status;
    this.code = body?.error?.code;
    this.i18nKey = body?.error?.i18nKey;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.details = body?.error?.details;
  }

  /** True when the server says "too many requests" — for login, this drives the local lockout. */
  get isRateLimited(): boolean {
    return this.status === 429 || this.code === 'RATE_LIMITED';
  }
}

export interface HttpClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Request timeout in ms. Defaults to 15 seconds. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** HTTP statuses that are transient gateway/worker/proxy failures — safe to retry. */
const RETRYABLE_5XX = new Set([502, 503, 504]);

/**
 * Maximum number of retries for retryable 5xx. `4 total attempts = 1 initial + 3 retries`.
 * After this many attempts we surface the error to the caller.
 */
const MAX_5XX_RETRIES = 3;

/** Base backoff delay in ms. Subsequent retries double this: 250 → 500 → 1000. */
const RETRY_BASE_DELAY_MS = 250;

export class HttpClient {
  private baseUrl: string;
  private fetchImpl: typeof fetch;
  private timeoutMs: number;

  constructor(opts: HttpClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? api.baseUrl;
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async request<T>(
    method: string,
    path: string,
    init?: { body?: unknown; headers?: Record<string, string>; retryOn401?: boolean },
  ): Promise<T> {
    return this.requestWithRetry<T>(method, path, init, 0);
  }

  /**
   * Internal retry-aware request implementation.
   *
   * Retry policy:
   *   - 502 / 503 / 504 → exponential backoff (250ms × 2^attempt), max 3 retries
   *   - 401 → handled by `tryRefresh()` flow (see existing path below), NOT 5xx retry
   *   - 4xx (other), 429, 500 → no retry; surface immediately
   *
   * The retry loop is intentionally separated from the 401 refresh path so the
   * two retry mechanisms don't fight each other (401 triggers refresh+replay;
   * 5xx triggers backoff+replay with the same body).
   */
  private async requestWithRetry<T>(
    method: string,
    path: string,
    init: { body?: unknown; headers?: Record<string, string>; retryOn401?: boolean } | undefined,
    attempt: number,
  ): Promise<T> {
    const { body, headers, retryOn401 = true } = init ?? {};
    const url = `${this.baseUrl}${path}`;

    // Attach Bearer token if available (set by AuthProvider on login/refresh)
    const token = getAccessToken();
    if (import.meta.env.DEV) {
      console.debug('[httpClient] token from authStore:', token ? 'present (' + token.slice(0, 20) + '...)' : 'NULL — this is why 401!');
    }
    const reqHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    };

    const res = await this.fetchImpl(url, {
      method,
      headers: reqHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    // 5xx retry path — exponential backoff, capped at MAX_5XX_RETRIES attempts.
    // 401 is intentionally NOT routed here: it has its own tryRefresh() flow
    // below, and mixing the two retry mechanisms would let 401 spam the
    // refresh endpoint 4× in a row.
    if (RETRYABLE_5XX.has(res.status) && attempt < MAX_5XX_RETRIES) {
      const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      if (import.meta.env.DEV) {
        console.warn(
          `[httpClient] ${res.status} on ${method} ${path} — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_5XX_RETRIES})`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return this.requestWithRetry<T>(method, path, init, attempt + 1);
    }

    if (res.status === 401 && retryOn401 && path !== api.paths.refresh) {
      if (import.meta.env.DEV) console.debug('[httpClient] 401! Attempting refresh to get new token...');
      const newToken = await this.tryRefresh();
      if (import.meta.env.DEV) {
        console.debug('[httpClient] tryRefresh result:', newToken ? 'got token (' + newToken.slice(0, 20) + '...)' : 'FAILED — no token');
      }
      if (newToken) {
        setAccessToken(newToken);
        return this.requestWithRetry<T>(method, path, { ...init, retryOn401: false }, attempt);
      }
    }

    if (!res.ok) {
      let errBody: unknown;
      try {
        errBody = await res.json();
      } catch {
        errBody = { message: res.statusText };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = errBody as { error?: { code?: string; i18nKey?: string; message?: string; details?: any } };
      if (parsed?.error?.code === 'RATE_LIMITED' && typeof window !== 'undefined') {
        // Sync local lockout to server's authoritative retryAfterSec.
        const retryAfterSec =
          (parsed.error.details as { retryAfterSec?: number } | undefined)?.retryAfterSec ??
          limits.loginLockoutSeconds;
        try {
          window.localStorage.setItem(
            'saome.login.lockout.v1',
            JSON.stringify({
              failedCount: limits.loginMaxAttempts,
              lockedUntil: Date.now() + retryAfterSec * 1000,
            }),
          );
        } catch {
          /* ignore quota */
        }
      }
      throw new SaomeApiError(res.status, parsed);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /**
   * Refresh the session via the HttpOnly refresh cookie or Authorization header.
   * Returns the new accessToken from the server response, or null on failure.
   *
   * Strategy:
   *   1. If refreshToken is in sessionStorage (cross-origin case): send as
   *      Authorization: Bearer header. This bypasses the SameSite=None cookie
   *      scoping issue where the browser refuses to attach
   *      Domain=saome-backend.* cookies on cross-origin requests.
   *   2. Fall back to sending the HttpOnly cookie via credentials: 'include'.
   *
   * Mutex (Phase 2.3, 2026-09-05): wraps the refresh attempt in
   * `withRefreshMutex` so concurrent 401 callers share the SAME in-flight
   * request. Before this fix:
   *   - Tab A: 401 → tryRefresh → POST /refresh starts
   *   - Tab B: 401 → tryRefresh → POST /refresh starts (second fetch)
   *   Both tabs then write their own accessToken to authStore, with the
   *   later write winning (race). Sharing the mutex makes the second
   *   caller wait for the first caller's result, eliminating the race.
   *
   * NOTE: This does NOT call setAccessToken. The caller (httpClient.request's
   * 401 branch) sets the token after a successful retry. We intentionally avoid
   * writing to authStore here so that a concurrent authService.refresh() keeps
   * full ownership of authStore token state.
   */
  private async tryRefresh(): Promise<string | null> {
    const refreshToken = getRefreshToken();
    const baseUrl = this.baseUrl;
    const refreshPath = api.paths.refresh;
    const fetchImpl = this.fetchImpl;
    const timeoutMs = this.timeoutMs;

    return withRefreshMutex(async () => {
      // Primary: send refresh token as Authorization: Bearer (cross-origin safe)
      if (refreshToken) {
        if (import.meta.env.DEV) console.debug('[httpClient.tryRefresh] using Authorization: Bearer (cross-origin)');
        try {
          const res = await fetchImpl(`${baseUrl}${refreshPath}`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${refreshToken}`,
            },
            credentials: 'include',
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!res.ok) return null;
          const body = await res.json();
          return body.accessToken ?? null;
        } catch {
          return null;
        }
      }

      // Fallback: rely on HttpOnly cookie (same-origin only)
      if (import.meta.env.DEV) console.debug('[httpClient.tryRefresh] no sessionStorage token, using cookie fallback');
      try {
        const res = await fetchImpl(`${baseUrl}${refreshPath}`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          credentials: 'include',
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return null;
        const body = await res.json();
        return body.accessToken ?? null;
      } catch {
        return null;
      }
    });
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body });
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, { body });
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, { body });
  }
  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

export const httpClient = new HttpClient();

/** Whitelist paths the AuthGuard allows when on /login: send to home after login. */
export { ROUTES };