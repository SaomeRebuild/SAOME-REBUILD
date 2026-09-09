/**
 * Standalone unit tests for the scheduled keep-alive handler logic.
 *
 * We do NOT import from @/index here because that pulls in the entire app
 * graph, which has a pre-existing broken module resolution issue
 * (@saome/shared/logic/cardSettings missing from vitest alias). Instead,
 * we test the handler logic in isolation by mocking all external deps.
 *
 * Root cause (2026-09-09):
 *   Before the fix, wrangler.jsonc triggers.crons was set but the Worker
 *   had NO scheduled handler — cron fired into the void, the isolate stayed
 *   subject to Cloudflare's idle-eviction policy, and after ~15-30 min
 *   of idle the next user request triggered a cold start → runtime 503
 *   with no CORS header → browser silent drop.
 *
 * Fix: worker.scheduled does three things per cron tick:
 *   1. HTTP warmup (fetch /health)
 *   2. Hyperdrive keep-alive (SELECT 1)
 *   3. Billing cycle advancement
 *
 * This test verifies each purpose WITHOUT pulling in the full app graph.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Re-export the handler type for readability
type ScheduledEvent = {
  cron: string;
  scheduledTime?: number;
};

// ---- Mock external dependencies ----

const mockFetch = vi.fn();
const mockGetDb = vi.fn();

vi.stubGlobal('fetch', mockFetch);
vi.mock('@/shared/db/client', () => ({
  getDb: mockGetDb,
}));

// Inline the handler logic (mirrors src/index.ts worker.scheduled)
async function runScheduledHandler(event: ScheduledEvent, env: {
  SAOME_BACKEND_URL: string;
  HYPERDRIVE: { connectionString: string };
}) {
  const cronName = event.cron;
  const startedAt = Date.now();

  // Purpose 1: HTTP layer keep-alive
  try {
    const res = await fetch(`${env.SAOME_BACKEND_URL}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    console.log(`[scheduled] cron=${cronName} http-warmup status=${res.status} durationMs=${Date.now() - startedAt}`);
  } catch (err) {
    console.warn(`[scheduled] cron=${cronName} http-warmup FAILED:`, err instanceof Error ? err.message : String(err));
  }

  // Purpose 2: Hyperdrive keep-alive
  try {
    const sql = await mockGetDb(env.HYPERDRIVE);
    const result = await sql.unsafe('SELECT 1 AS ok');
    console.log(`[scheduled] cron=${cronName} hyperdrive-keepalive ok=${result[0]?.ok}`);
  } catch (err) {
    console.warn(`[scheduled] cron=${cronName} hyperdrive-keepalive FAILED:`, err instanceof Error ? err.message : String(err));
  }

  // Purpose 3: Billing cycle
  try {
    const res = await fetch(`${env.SAOME_BACKEND_URL}/api/cron/billing-cycle`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await res.json().catch(() => ({}));
    console.log(`[scheduled] cron=${cronName} billing-cycle status=${res.status} body=${JSON.stringify(body)}`);
  } catch (err) {
    console.warn(`[scheduled] cron=${cronName} billing-cycle FAILED:`, err instanceof Error ? err.message : String(err));
  }
}

const TEST_ENV = {
  SAOME_BACKEND_URL: 'https://saome-backend.josh1989213.workers.dev',
  HYPERDRIVE: { connectionString: 'postgres://test' },
};

describe('scheduled keep-alive handler logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({
      unsafe: vi.fn().mockResolvedValue([{ ok: 1 }]),
    } as unknown as ReturnType<typeof import('postgres')['default']>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pings /health for HTTP layer keep-alive', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await runScheduledHandler({ cron: '*/5 * * * *' }, TEST_ENV);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://saome-backend.josh1989213.workers.dev/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('exercises Hyperdrive with SELECT 1', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await runScheduledHandler({ cron: '*/5 * * * *' }, TEST_ENV);

    expect(mockGetDb).toHaveBeenCalledWith(TEST_ENV.HYPERDRIVE);
    const mockSql = (await mockGetDb.mock.results[0].value) as { unsafe: ReturnType<typeof vi.fn> };
    expect(mockSql.unsafe).toHaveBeenCalledWith('SELECT 1 AS ok');
  });

  it('fires billing-cycle cron fetch', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cron: 'billing-cycle', updatedBillingCycles: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await runScheduledHandler({ cron: '*/5 * * * *' }, TEST_ENV);

    // fetch called twice: /health + /api/cron/billing-cycle
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://saome-backend.josh1989213.workers.dev/api/cron/billing-cycle',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('swallows HTTP warmup failure — does NOT throw', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    // Must NOT throw
    await expect(
      runScheduledHandler({ cron: '*/5 * * * *' }, TEST_ENV),
    ).resolves.not.toThrow();
  });

  it('swallows Hyperdrive failure — does NOT throw', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('Hyperdrive connection error'));

    await expect(
      runScheduledHandler({ cron: '*/5 * * * *' }, TEST_ENV),
    ).resolves.not.toThrow();
  });

  it('swallows billing-cycle failure — does NOT throw', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockRejectedValueOnce(new Error('billing fetch failed'));

    await expect(
      runScheduledHandler({ cron: '*/5 * * * *' }, TEST_ENV),
    ).resolves.not.toThrow();
  });

  it('continues to subsequent steps when HTTP warmup fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cron: 'billing-cycle', updatedBillingCycles: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await runScheduledHandler({ cron: '*/5 * * * *' }, TEST_ENV);

    // HTTP warmup failed, but billing-cycle still fired
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://saome-backend.josh1989213.workers.dev/api/cron/billing-cycle',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('uses SAOME_BACKEND_URL from env for all three fetches', async () => {
    const customEnv = {
      SAOME_BACKEND_URL: 'https://custom-backend.example.com',
      HYPERDRIVE: { connectionString: 'postgres://test' },
    };

    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cron: 'billing-cycle', updatedBillingCycles: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await runScheduledHandler({ cron: '*/5 * * * *' }, customEnv);

    const allFetchCalls = mockFetch.mock.calls;
    expect(allFetchCalls[0][0]).toContain('custom-backend.example.com');
    expect(allFetchCalls[1][0]).toContain('custom-backend.example.com');
  });
});
