/**
 * Tests for the warmup cron route.
 *
 * Critical invariant: the route MUST NOT throw if `SAOME_BACKEND_URL` is
 * unset (it falls back to the production URL). It also MUST catch and
 * surface upstream fetch errors gracefully — a warmup failure should
 * never crash the cron worker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { warmupCronRoute } from './warmupCron';
import type { HonoEnv } from '@/shared/types/bindings';

const testEnv: HonoEnv['Bindings'] = {
  HYPERDRIVE: {} as unknown as HonoEnv['Bindings']['HYPERDRIVE'],
  JWT_SECRET: 'test',
} as unknown as HonoEnv['Bindings'];

function buildApp(env: Partial<HonoEnv['Bindings']> = {}) {
  const app = new Hono<HonoEnv>();
  app.route('/api/cron/warmup', warmupCronRoute);
  return app;
}

describe('warmupCronRoute', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('uses production default when SAOME_BACKEND_URL is unset', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = buildApp();
    const res = await app.request(
      'http://test.local/api/cron/warmup',
      { method: 'GET' },
      testEnv,
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('saome-backend.josh1989213.workers.dev/health');
  });

  it('uses SAOME_BACKEND_URL override when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = buildApp();
    const res = await app.request(
      'http://test.local/api/cron/warmup',
      { method: 'GET' },
      { ...testEnv, SAOME_BACKEND_URL: 'https://custom-backend.example.com' },
    );

    expect(res.status).toBe(200);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('https://custom-backend.example.com/health');
  });

  it('returns upstreamStatus 200 on successful ping', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200 })) as unknown as typeof fetch;

    const app = buildApp();
    const res = await app.request(
      'http://test.local/api/cron/warmup',
      { method: 'GET' },
      testEnv,
    );

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cron).toBe('warmup');
    expect(body.upstreamStatus).toBe(200);
    expect(body.upstreamError).toBeNull();
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('surfaces upstreamError gracefully on fetch failure (does NOT crash)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const app = buildApp();
    const res = await app.request(
      'http://test.local/api/cron/warmup',
      { method: 'GET' },
      testEnv,
    );

    // Route must still return 200 — warmup failure is non-fatal
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.upstreamStatus).toBeNull();
    expect(body.upstreamError).toBe('network down');
  });

  it('returns non-200 upstreamStatus when /health is degraded', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('down', { status: 503 })) as unknown as typeof fetch;

    const app = buildApp();
    const res = await app.request(
      'http://test.local/api/cron/warmup',
      { method: 'GET' },
      testEnv,
    );

    expect(res.status).toBe(200); // route itself is OK
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.upstreamStatus).toBe(503);
  });
});
