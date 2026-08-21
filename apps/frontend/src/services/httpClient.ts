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
import { getAccessToken, setAccessToken, getRefreshToken } from './authStore';
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
}

export class HttpClient {
  private baseUrl: string;
  private fetchImpl: typeof fetch;

  constructor(opts: HttpClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? api.baseUrl;
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  async request<T>(
    method: string,
    path: string,
    init?: { body?: unknown; headers?: Record<string, string>; retryOn401?: boolean },
  ): Promise<T> {
    const { body, headers, retryOn401 = true } = init ?? {};
    const url = `${this.baseUrl}${path}`;

    // Attach Bearer token if available (set by AuthProvider on login/refresh)
    const token = getAccessToken();
    console.debug('[httpClient] token from authStore:', token ? 'present (' + token.slice(0, 20) + '...)' : 'NULL — this is why 401!');
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
    });

    if (res.status === 401 && retryOn401 && path !== api.paths.refresh) {
      console.debug('[httpClient] 401! Attempting refresh to get new token...');
      const newToken = await this.tryRefresh();
      console.debug('[httpClient] tryRefresh result:', newToken ? 'got token (' + newToken.slice(0, 20) + '...)' : 'FAILED — no token');
      if (newToken) {
        setAccessToken(newToken);
        return this.request<T>(method, path, { ...init, retryOn401: false });
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
   * NOTE: This does NOT call setAccessToken. The caller (httpClient.request's
   * 401 branch) sets the token after a successful retry. We intentionally avoid
   * writing to authStore here so that a concurrent authService.refresh() keeps
   * full ownership of authStore token state.
   */
  private async tryRefresh(): Promise<string | null> {
    const refreshToken = getRefreshToken();

    // Primary: send refresh token as Authorization: Bearer (cross-origin safe)
    if (refreshToken) {
      console.debug('[httpClient.tryRefresh] using Authorization: Bearer (cross-origin)');
      try {
        const res = await this.fetchImpl(`${this.baseUrl}${api.paths.refresh}`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${refreshToken}`,
          },
          credentials: 'include',
        });
        if (!res.ok) return null;
        const body = await res.json();
        return body.accessToken ?? null;
      } catch {
        return null;
      }
    }

    // Fallback: rely on HttpOnly cookie (same-origin only)
    console.debug('[httpClient.tryRefresh] no sessionStorage token, using cookie fallback');
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${api.paths.refresh}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) return null;
      const body = await res.json();
      return body.accessToken ?? null;
    } catch {
      return null;
    }
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body });
  }
}

export const httpClient = new HttpClient();

/** Whitelist paths the AuthGuard allows when on /login: send to home after login. */
export { ROUTES };