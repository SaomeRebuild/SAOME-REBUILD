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
