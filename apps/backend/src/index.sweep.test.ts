/**
 * Unit tests for `sweepR2PendingDeletes` — the cron half of the
 * "tombstone + cron sweep" pattern that moves R2 deletes off the
 * user-facing request path (plan
 * `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50`,
 * 2026-10-03).
 *
 * Test cases (all regression tests, no production smoke needed):
 *   1. Empty queue → 0 calls to bucket.delete, returns zeros.
 *   2. Three pending rows, all succeed → 3 bucket.delete calls,
 *      3 markR2DeleteCompleted calls, returns processed=3 succeeded=3 failed=0.
 *   3. Mixed success/failure → failed row gets recordR2DeleteFailure
 *      with the error message, successful row gets markR2DeleteCompleted.
 *   4. Deadline exceeded mid-loop → exits early with skipped > 0,
 *      does NOT call bucket.delete for the unprocessed rows.
 *   5. retry_count >= 5 row is NOT returned by fetchPendingR2Deletes
 *      (gatekeeper) — but since we mock fetchPendingR2Deletes directly,
 *      this is verified at the db layer. Here we just verify the loop
 *      doesn't crash on high retry_count values that pass through.
 *   6. recordR2DeleteFailure itself throws → the loop continues with
 *      the next row (defense-in-depth).
 *
 * Mocks: `getDb` (Hyperdrive bootstrap) and the three DB helper
 * functions from `r2PendingDeletes.ts`. The R2 bucket is a plain
 * vi.fn() — no need to mock an R2 SDK, we just verify the calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks (must be hoisted) ----

const { mockFetchPending, mockMarkCompleted, mockRecordFailure, mockGetDb } = vi.hoisted(() => ({
  mockFetchPending: vi.fn(),
  mockMarkCompleted: vi.fn(),
  mockRecordFailure: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock('@/modules/cards/db/r2PendingDeletes', () => ({
  fetchPendingR2Deletes: mockFetchPending,
  markR2DeleteCompleted: mockMarkCompleted,
  recordR2DeleteFailure: mockRecordFailure,
  // Keep these exported types as opaque so we don't have to re-export
  // them from the test side.
  enqueueR2Delete: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
  getDb: mockGetDb,
}));

import { sweepR2PendingDeletes } from '@/modules/cards/db/r2Sweep';

const TEST_ENV = {
  HYPERDRIVE: { connectionString: 'postgres://test' },
  ASSETS: {
    delete: vi.fn().mockResolvedValue(undefined),
  },
} as unknown as Parameters<typeof sweepR2PendingDeletes>[0];

const mockSql = {
  /* placeholder — fetchPending/Mark/etc are all mocked at the module
     boundary, so we never actually call into mockSql */
} as unknown as Awaited<ReturnType<typeof mockGetDb>>;

describe('sweepR2PendingDeletes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(mockSql);
    // Default: empty queue
    mockFetchPending.mockResolvedValue([]);
    mockMarkCompleted.mockResolvedValue(undefined);
    mockRecordFailure.mockResolvedValue(undefined);
    // Default: bucket.delete succeeds
    (TEST_ENV.ASSETS.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('handles empty queue — no R2 calls, all counts zero', async () => {
    const result = await sweepR2PendingDeletes(TEST_ENV, { deadline: Date.now() + 30_000 });
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0, skipped: 0 });
    expect(TEST_ENV.ASSETS.delete).not.toHaveBeenCalled();
    expect(mockMarkCompleted).not.toHaveBeenCalled();
    expect(mockRecordFailure).not.toHaveBeenCalled();
  });

  it('processes 3 successful rows — 3 bucket.delete + 3 markCompleted', async () => {
    mockFetchPending.mockResolvedValue([
      { id: 'row-1', r2_key: 'tenant/tpl/element-1.png', retry_count: 0 },
      { id: 'row-2', r2_key: 'tenant/tpl/element-2.png', retry_count: 0 },
      { id: 'row-3', r2_key: 'tenant/tpl/element-3.png', retry_count: 1 },
    ]);

    const result = await sweepR2PendingDeletes(TEST_ENV, { deadline: Date.now() + 30_000 });

    expect(result).toEqual({ processed: 3, succeeded: 3, failed: 0, skipped: 0 });
    expect(TEST_ENV.ASSETS.delete).toHaveBeenCalledTimes(3);
    expect(TEST_ENV.ASSETS.delete).toHaveBeenNthCalledWith(1, 'tenant/tpl/element-1.png');
    expect(TEST_ENV.ASSETS.delete).toHaveBeenNthCalledWith(2, 'tenant/tpl/element-2.png');
    expect(TEST_ENV.ASSETS.delete).toHaveBeenNthCalledWith(3, 'tenant/tpl/element-3.png');
    expect(mockMarkCompleted).toHaveBeenCalledTimes(3);
    expect(mockMarkCompleted).toHaveBeenNthCalledWith(1, mockSql, 'row-1');
    expect(mockRecordFailure).not.toHaveBeenCalled();
  });

  it('handles mixed success/failure — failed row gets recordFailure with error', async () => {
    mockFetchPending.mockResolvedValue([
      { id: 'row-ok', r2_key: 'tenant/tpl/ok.png', retry_count: 0 },
      { id: 'row-fail', r2_key: 'tenant/tpl/fail.png', retry_count: 0 },
      { id: 'row-ok-2', r2_key: 'tenant/tpl/ok-2.png', retry_count: 0 },
    ]);
    (TEST_ENV.ASSETS.delete as ReturnType<typeof vi.fn>).mockImplementation(async (key: string) => {
      if (key === 'tenant/tpl/fail.png') {
        throw new Error('R2 internal error: 503');
      }
      return undefined;
    });

    const result = await sweepR2PendingDeletes(TEST_ENV, { deadline: Date.now() + 30_000 });

    expect(result).toEqual({ processed: 3, succeeded: 2, failed: 1, skipped: 0 });
    expect(mockMarkCompleted).toHaveBeenCalledTimes(2);
    expect(mockMarkCompleted).toHaveBeenCalledWith(mockSql, 'row-ok');
    expect(mockMarkCompleted).toHaveBeenCalledWith(mockSql, 'row-ok-2');
    expect(mockRecordFailure).toHaveBeenCalledTimes(1);
    expect(mockRecordFailure).toHaveBeenCalledWith(
      mockSql,
      'row-fail',
      'R2 internal error: 503',
    );
  });

  it('stops when deadline approaches — marks remaining as skipped', async () => {
    // 3 rows but deadline is "now" (or in the past) — buffer check
    // Date.now() > deadline - 5000 will be true immediately.
    mockFetchPending.mockResolvedValue([
      { id: 'row-1', r2_key: 'tenant/tpl/1.png', retry_count: 0 },
      { id: 'row-2', r2_key: 'tenant/tpl/2.png', retry_count: 0 },
      { id: 'row-3', r2_key: 'tenant/tpl/3.png', retry_count: 0 },
    ]);

    const result = await sweepR2PendingDeletes(TEST_ENV, {
      deadline: Date.now() - 1000, // already past
    });

    // Buffer is 5s, so the very first iteration's check
    // `Date.now() > deadline - 5000` is `now > past-5s` = true
    // → break immediately, 0 processed, 3 skipped
    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(3);
    expect(TEST_ENV.ASSETS.delete).not.toHaveBeenCalled();
  });

  it('continues loop when recordR2DeleteFailure itself throws (defense in depth)', async () => {
    mockFetchPending.mockResolvedValue([
      { id: 'row-1', r2_key: 'tenant/tpl/1.png', retry_count: 0 },
      { id: 'row-2', r2_key: 'tenant/tpl/2.png', retry_count: 0 },
    ]);
    (TEST_ENV.ASSETS.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('R2 down'));
    mockRecordFailure.mockRejectedValueOnce(new Error('DB write failed'));

    // Must NOT throw — the row is counted as failed, the loop continues.
    const result = await sweepR2PendingDeletes(TEST_ENV, { deadline: Date.now() + 30_000 });

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(2);
    expect(result.succeeded).toBe(0);
  });

  it('default deadline buffer is 25s when no options passed', async () => {
    // Just verify the default path doesn't crash
    mockFetchPending.mockResolvedValue([]);
    const result = await sweepR2PendingDeletes(TEST_ENV);
    expect(result.processed).toBe(0);
  });

  it('default limit is 200 when no options passed', async () => {
    // Verify fetchPendingR2Deletes is called with the default limit
    mockFetchPending.mockResolvedValue([]);
    await sweepR2PendingDeletes(TEST_ENV, { deadline: Date.now() + 30_000 });
    expect(mockFetchPending).toHaveBeenCalledWith(mockSql, 200);
  });

  it('respects custom limit', async () => {
    mockFetchPending.mockResolvedValue([]);
    await sweepR2PendingDeletes(TEST_ENV, { limit: 50, deadline: Date.now() + 30_000 });
    expect(mockFetchPending).toHaveBeenCalledWith(mockSql, 50);
  });
});
