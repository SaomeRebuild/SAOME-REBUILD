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
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });

    if (res.status === 401 && retryOn401 && path !== api.paths.refresh) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
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

  private async tryRefresh(): Promise<boolean> {
    try {
      await this.fetchImpl(`${this.baseUrl}${api.paths.refresh}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      return true;
    } catch {
      return false;
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