/**
 * Unit tests for HttpClient — focuses on the 5xx retry behavior.
 *
 * Critical invariant under test:
 *   - Retryable 5xx (502 / 503 / 504) get one or more retries with exponential
 *     backoff (250ms × 2^attempt).
 *   - Non-retryable 5xx (500) do NOT retry.
 *   - 4xx (400, 401, 404, 422) do NOT retry.
 *   - 401 specifically routes through the existing tryRefresh() flow, NOT the
 *     5xx retry loop, to avoid double-retry conflicts.
 *
 * The previously-existing httpClient had no retry on 5xx at all — 503 throws
 * immediately. This caused draft autosave to fail when the worker was
 * transiently overloaded.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient, SaomeApiError } from './httpClient';
import * as authStore from './authStore';

describe('HttpClient — 5xx retry behavior', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    // authStore is module-level singleton; ensure clean state per test
    authStore.setAccessToken(null);
    authStore.setRefreshToken(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function buildClient() {
    return new HttpClient({
      baseUrl: 'http://test.local',
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 1000,
    });
  }

  /** Build a fetch response with given status + JSON body. */
  function mockResponse(status: number, body: unknown = {}) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('retries on 503 then succeeds on second attempt (exponential backoff 250ms)', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(503, { error: { code: 'TRANSIENT', message: 'busy' } }))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));

    const client = buildClient();
    const promise = client.get<{ ok: boolean }>('/api/cards/test');

    // Advance through the 250ms backoff
    await vi.advanceTimersByTimeAsync(300);

    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on 502 and 504 (both retryable)', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(502))
      .mockResolvedValueOnce(mockResponse(504))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));

    const client = buildClient();
    const promise = client.get<{ ok: boolean }>('/api/foo');

    // First retry at 250ms, second retry at 500ms; both advance through timers
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(600);

    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on 500 (app-bug) — throws immediately', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(500, { message: 'internal error' }));

    const client = buildClient();
    await expect(client.get('/api/cards')).rejects.toThrow(SaomeApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 4xx (400, 404, 422) — caller bug', async () => {
    for (const status of [400, 404, 422]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(mockResponse(status, { message: 'bad' }));

      const client = buildClient();
      await expect(client.get('/api/cards')).rejects.toThrow(SaomeApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it('does NOT retry on 401 — handled by tryRefresh() flow instead', async () => {
    // Set a refresh token so tryRefresh() can be exercised; but since the
    // refresh endpoint also returns 401, the test ends up calling fetch
    // once + refresh once + still failing. The key invariant: the 401 on
    // the original path does NOT trigger the 5xx retry loop.
    authStore.setRefreshToken('valid-refresh');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'unauthorized' }), { status: 401 }),
    );

    const client = buildClient();
    await expect(client.get('/api/foo')).rejects.toThrow(SaomeApiError);
    // 401 path goes through tryRefresh path, not 5xx retry; just verify
    // we don't see 4 retry attempts on the same path.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });

  /**
   * Regression — 2026-09-08: when tryRefresh() returns null (refresh token
   * expired/revoked), the original request MUST throw SaomeApiError(401)
   * immediately rather than retrying with the same stale accessToken.
   *
   * Background: previously the code fell through to `if (!res.ok) throw
   * SaomeApiError(...)`, which (per the flow) retried the original request
   * with the same expired token, producing a 401 → tryRefresh → null →
   * retry → 401 loop. The user observed this in incognito mode with a
   * stale cookie: multiple 401s followed by a 429 because the rate
   * limiter counted each failed attempt.
   *
   * After the fix: tryRefresh null ⇒ immediate throw SaomeApiError(401).
   */
  it('regression 2026-09-08: tryRefresh null → immediate throw, no retry storm', async () => {
    authStore.setRefreshToken('expired-refresh');

    // original 401 → tryRefresh (mocked via the refresh endpoint returning 401)
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'refresh expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const client = buildClient();
    await expect(client.get('/api/cards')).rejects.toBeInstanceOf(SaomeApiError);

    // Critical: only 2 fetch calls (original + 1 refresh attempt).
    // The old bug would have retried the original after refresh failed,
    // producing 3+ calls on `/api/cards` and indefinite 401s.
    const originalCalls = fetchMock.mock.calls.filter((call) => {
      const url = call[0] as string;
      return url.includes('/api/cards');
    });
    expect(originalCalls).toHaveLength(1);
  });

  it('gives up after MAX_5XX_RETRIES attempts (3 retries → 4 attempts total)', async () => {
    // 4 consecutive 503s
    fetchMock.mockResolvedValue(mockResponse(503, { message: 'busy' }));

    const client = buildClient();
    const promise = client.get('/api/cards');
    // Attach a noop rejection handler up front so vitest's unhandled-rejection
    // tracker doesn't double-count the eventual rejection we expect.
    promise.catch(() => {});

    // Advance through 250ms, 500ms, 1000ms backoffs
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(1200);

    await expect(promise).rejects.toThrow(SaomeApiError);

    // 1 initial + 3 retries = 4 attempts
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('uses exponential backoff: 250ms → 500ms → 1000ms', async () => {
    fetchMock.mockResolvedValue(mockResponse(503));

    const client = buildClient();
    const promise = client.get('/api/foo');
    promise.catch(() => {});

    // Backoffs are scheduled RELATIVE to fetch attempt time, not absolute test time.
    // Timer fires at: t = 250ms (after 1st fetch), t = 250 + 500 = 750ms (after 2nd), t = 750 + 1000 = 1750ms (after 3rd).
    //
    // After 249ms: 1st retry timer (250ms) not yet fired
    await vi.advanceTimersByTimeAsync(249);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // After 250ms total: 1st retry timer fires (backoff 250ms)
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Advance to t=750ms: 2nd retry timer fires (backoff 500ms)
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Advance to t=1750ms: 3rd retry timer fires (backoff 1000ms)
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // Cleanup
    await promise.catch(() => {
      /* expected rejection */
    });
  });
});

/**
 * Phase 2.3 (2026-09-05): tryRefresh() now wraps its refresh attempt in
 * `withRefreshMutex` so concurrent 401 callers share the same in-flight
 * request instead of each spawning a separate POST /api/auth/refresh.
 *
 * Critical invariant under test:
 *   - Two concurrent tryRefresh() calls (e.g. tab A + tab B both hit 401)
 *     produce exactly ONE POST /api/auth/refresh network call.
 *   - Both callers receive the same result (success or null).
 *   - The mutex doesn't leak across calls — after the first refresh settles,
 *     a third caller can start a fresh request.
 *
 * These tests use `authService.refresh` indirectly via httpClient; the
 * mutex is shared across both call sites (authStore module-level state).
 */
describe('HttpClient — tryRefresh mutex sharing', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = vi.fn();
    authStore.setAccessToken(null);
    authStore.setRefreshToken('valid-refresh');
    // Clear any in-flight mutex from a previous test
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    authStore.setAccessToken(null);
    authStore.setRefreshToken(null);
    vi.clearAllMocks();
  });

  function buildClient() {
    return new HttpClient({
      baseUrl: 'http://test.local',
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 1000,
    });
  }

  function mockRefreshResponse(accessToken: string | null, status = 200) {
    return new Response(JSON.stringify({ accessToken }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('two concurrent 401s trigger only ONE POST /refresh (mutex shared)', async () => {
    // First 401 call → tryRefresh, second 401 call → tryRefresh,
    // but they MUST share the same in-flight fetch.
    // We mock: 401 (call 1, original), 401 (call 2, original),
    //          refresh-success (single call), 200 (call 1 retry),
    //          200 (call 2 retry).
    fetchMock
      .mockResolvedValueOnce(new Response('{"message":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"message":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(mockRefreshResponse('refreshed-token'))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const client = buildClient();
    const [r1, r2] = await Promise.all([
      client.get<{ ok: boolean }>('/api/cards/a'),
      client.get<{ ok: boolean }>('/api/cards/b'),
    ]);

    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });

    // 5 calls total: 2 original 401s + 1 shared refresh + 2 retries
    expect(fetchMock).toHaveBeenCalledTimes(5);

    // Specifically: only ONE call to /api/auth/refresh
    const refreshCalls = fetchMock.mock.calls.filter((call) => {
      const url = call[0] as string;
      return url.includes('/api/auth/refresh');
    });
    expect(refreshCalls).toHaveLength(1);
  });

  it('mutex is released after refresh settles — next caller starts fresh request', async () => {
    // First pair: 401 → mutex → shared refresh → success
    fetchMock
      .mockResolvedValueOnce(new Response('{"message":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(mockRefreshResponse('token-1'))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const client = buildClient();
    await client.get('/api/cards/first');

    // Second pair (after first settled): 401 → mutex → NEW refresh
    fetchMock
      .mockResolvedValueOnce(new Response('{"message":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(mockRefreshResponse('token-2'))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await client.get('/api/cards/second');

    // 6 calls total (3 per pair × 2 pairs)
    expect(fetchMock).toHaveBeenCalledTimes(6);

    // Exactly TWO calls to /api/auth/refresh (one per pair)
    const refreshCalls = fetchMock.mock.calls.filter((call) => {
      const url = call[0] as string;
      return url.includes('/api/auth/refresh');
    });
    expect(refreshCalls).toHaveLength(2);
  });

  it('when shared refresh fails (returns null), both 401 callers surface SaomeApiError', async () => {
    // 401 + 401 → shared refresh that returns 401 (refresh fails) → both callers throw
    fetchMock
      .mockResolvedValueOnce(new Response('{"message":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"message":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"message":"refresh failed"}', { status: 401 }));

    const client = buildClient();
    const results = await Promise.allSettled([
      client.get('/api/cards/a'),
      client.get('/api/cards/b'),
    ]);

    // Both callers rejected (mutex didn't save them — refresh genuinely failed)
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    if (results[0].status === 'rejected') {
      expect(results[0].reason).toBeInstanceOf(SaomeApiError);
    }
    if (results[1].status === 'rejected') {
      expect(results[1].reason).toBeInstanceOf(SaomeApiError);
    }

    // 3 calls: 2 originals + 1 shared refresh
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const refreshCalls = fetchMock.mock.calls.filter((call) => {
      const url = call[0] as string;
      return url.includes('/api/auth/refresh');
    });
    expect(refreshCalls).toHaveLength(1);
  });
});

/**
 * Phase 2026-09-09 — Cold start 503 dead zone closure (network-error retry).
 *
 * Critical invariant under test:
 *   - `TypeError` from `fetch` (cold-start 503 CORS drop, ERR_FAILED,
 *     connection reset) is retried with exponential backoff (500ms ×
 *     2^attempt), max 2 retries.
 *   - `AbortError` / `DOMException` (AbortSignal.timeout) is NOT retried
 *     — timeout is user/timeout-initiated.
 *   - Network-error retry and 5xx-retry are independent: cold start can
 *     trigger network-retry first (TypeError), then 5xx-retry (503
 *     response) once the isolate is warm enough to load entry code.
 *
 * Regression for production CORS drop incident at 2026-09-09 06:10 UTC:
 * user clicks Login → cold start 503 + no CORS → fetch rejects with
 * TypeError → user sees "Network error" → F5 → token fallback recovers.
 * After this fix: user clicks Login → TypeError → 500ms retry → 200 OK
 * (no F5 needed).
 */
describe('HttpClient — network-error retry behavior', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    authStore.setAccessToken(null);
    authStore.setRefreshToken(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function buildClient() {
    return new HttpClient({
      baseUrl: 'http://test.local',
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 1000,
    });
  }

  /** Build a fetch response with given status + JSON body. */
  function mockResponse(status: number, body: unknown = {}) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Mock a single TypeError rejection — mimics cold-start 503 CORS drop. */
  function mockNetworkError(message = 'Failed to fetch') {
    return Promise.reject(new TypeError(message));
  }

  it('retries once on TypeError then succeeds on second attempt (500ms backoff)', async () => {
    fetchMock
      .mockImplementationOnce(() => mockNetworkError())
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));

    const client = buildClient();
    const promise = client.get<{ ok: boolean }>('/api/cards/test');

    // Network retry backoff is 500ms
    await vi.advanceTimersByTimeAsync(600);

    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after MAX_NETWORK_RETRIES (2 retries → 3 attempts total) on persistent TypeError', async () => {
    fetchMock.mockImplementation(() => mockNetworkError());

    const client = buildClient();
    const promise = client.get('/api/cards');
    // Attach a noop rejection handler so vitest's unhandled-rejection
    // tracker doesn't double-count the eventual rejection we expect.
    promise.catch(() => {});

    // Backoffs: 500ms (after 1st) + 1000ms (after 2nd)
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(1100);

    await expect(promise).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on AbortError (AbortSignal.timeout) — surface immediately', async () => {
    // AbortSignal.timeout throws DOMException with name 'AbortError' or
    // 'TimeoutError' (varies by Node/browser version). We simulate the
    // TypeError-not-included branch by throwing a non-TypeError error.
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    fetchMock.mockRejectedValueOnce(abortError);

    const client = buildClient();
    await expect(client.get('/api/cards')).rejects.toBe(abortError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT trigger network-retry when first attempt succeeds — fetch called once', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { ok: true }));

    const client = buildClient();
    const result = await client.get<{ ok: boolean }>('/api/cards/fast-network');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('chains network-retry → 5xx-retry → success: cold start then transient 503 then OK', async () => {
    // Scenario: worker isolate cold start (TypeError) → entry code loaded
    // but first response is 503 → warm enough to return 200 on retry.
    //   attempt 0: TypeError (cold start CORS drop) → wait 500ms (network-retry)
    //   attempt 1: 503 (transient overload) → wait 500ms (5xx-retry, attempt=1, 250 × 2^1)
    //   attempt 2: 503 (still transient) → wait 1000ms (5xx-retry, attempt=2, 250 × 2^2)
    //   attempt 3: 200 (warm) → success
    fetchMock
      .mockImplementationOnce(() => mockNetworkError())
      .mockResolvedValueOnce(mockResponse(503, { error: { code: 'TRANSIENT', message: 'busy' } }))
      .mockResolvedValueOnce(mockResponse(503, { error: { code: 'TRANSIENT', message: 'busy' } }))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));

    const client = buildClient();
    const promise = client.get<{ ok: boolean }>('/api/cards/cold-start');

    // Advance enough to cover all three backoffs: 500 + 500 + 1000 = 2000ms
    await vi.advanceTimersByTimeAsync(2100);

    const result = await promise;
    expect(result).toEqual({ ok: true });
    // 1 initial (TypeError) + 1 network-retry + 2 5xx-retries + 1 success = 4 fetch calls
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
