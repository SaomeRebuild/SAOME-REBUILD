/**
 * httpClient — fetch wrapper with credentials, JSON handling, and 401 retry-via-refresh.
 */

import { api } from '@/config/api';
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
    this.details = body?.error?.details;
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

  /**
   * Perform a request. If `credentials: true` is implied, cookies (saome_refresh) are sent.
   * If the response is 401 and the request wasn't to /refresh, attempt one /refresh then retry.
   */
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
      throw new SaomeApiError(res.status, errBody as { error?: { code?: string; i18nKey?: string; message?: string; details?: unknown } });
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
