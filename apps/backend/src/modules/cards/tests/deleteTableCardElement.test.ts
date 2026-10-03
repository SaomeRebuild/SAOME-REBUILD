/**
 * Unit tests for `deleteTableCardElement` route.
 *
 * The route used to do a sync `bucket.delete(key)` inline on the
 * user-facing DELETE handler. That was a Workers Free plan risk:
 * the R2 roundtrip + DB UPDATE + auth + CORS + error envelope was
 * eating the 10ms CPU / 50 subrequest budget.
 *
 * The route now does:
 *   1. DB JSONB merge (settings.tableCard.elements filter)
 *   2. INSERT into `r2_pending_deletes` (enqueueR2Delete)
 *   3. return 204
 *
 * The actual R2 delete is moved to a cron sweep — see
 * `src/index.sweep.test.ts`. This test verifies the route does NOT
 * call bucket.delete directly.
 *
 * Plan: `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50`
 * (2026-10-03)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

// ---- Mocks (must be hoisted) ----

const { mockEnqueue, mockFindTemplateById, mockGetDbForRequest } = vi.hoisted(() => ({
  mockEnqueue: vi.fn(),
  mockFindTemplateById: vi.fn(),
  mockGetDbForRequest: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
  getDb: vi.fn(),
  getDbForRequest: mockGetDbForRequest,
}));

vi.mock('@/shared/middleware/auth', () => ({
  requireAuth: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  getAuthenticatedUser: vi.fn().mockReturnValue({
    tenantId: 'tenant-uuid',
    userId: 'user-uuid',
  }),
}));

vi.mock('../db/templates', () => ({
  findTemplateById: mockFindTemplateById,
}));

vi.mock('../db/r2PendingDeletes', () => ({
  enqueueR2Delete: mockEnqueue,
}));

import { errorHandler } from '@/shared/middleware/errorHandler';
import { deleteTableCardElementRoute } from '../routes/deleteTableCardElement';

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorHandler);
  app.route('/api/cards', deleteTableCardElementRoute);
  return app;
}

const TEST_ENV = {
  HYPERDRIVE: {} as never,
  // CRITICAL: bucket.delete is provided here so we can assert it's NEVER called.
  ASSETS: {
    delete: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
} as unknown as HonoEnv['Bindings'];

describe('deleteTableCardElement — tombstone pattern (Free plan safe)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: template exists, owned by tenant
    mockFindTemplateById.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      tenant_id: 'tenant-uuid',
      settings: { tableCard: { elements: [] } },
    });
    // enqueueR2Delete succeeds by default
    mockEnqueue.mockResolvedValue(true);
    // getDbForRequest returns a stub sql — the DB UPDATE in the route
    // is not asserted here, only that the R2 tombstone is enqueued.
    mockGetDbForRequest.mockResolvedValue({
      __update: vi.fn().mockResolvedValue([]),
    });
  });

  const TPL_UUID = '22222222-2222-4222-8222-222222222222';
  const EL_UUID = '11111111-1111-4111-8111-111111111111';

  it('enqueues tombstone on success and returns 204', async () => {
    const app = buildApp();
    const res = await app.request(
      `/api/cards/${TPL_UUID}/table-card/element/${EL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(204);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: 'tenant-uuid',
        r2Key: `tenant-uuid/${TPL_UUID}/table-card/${EL_UUID}.png`,
        source: 'table-card-element-delete',
      }),
    );
  });

  it('does NOT call bucket.delete inline (regression for Free plan CPU risk)', async () => {
    const app = buildApp();
    await app.request(
      `/api/cards/${TPL_UUID}/table-card/element/${EL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    // The whole point of this refactor — the user-facing route must
    // never burn a subrequest on R2.
    expect(TEST_ENV.ASSETS.delete).not.toHaveBeenCalled();
  });

  it('returns 204 even when enqueueR2Delete throws (best-effort cleanup)', async () => {
    mockEnqueue.mockRejectedValueOnce(new Error('DB write failed'));
    const app = buildApp();
    const res = await app.request(
      `/api/cards/${TPL_UUID}/table-card/element/${EL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    // user-facing path must not fail because of the tombstone
    expect(res.status).toBe(204);
  });

  it('rejects with 404 when template not found', async () => {
    mockFindTemplateById.mockResolvedValueOnce(undefined);
    const app = buildApp();
    const res = await app.request(
      `/api/cards/${TPL_UUID}/table-card/element/${EL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(TEST_ENV.ASSETS.delete).not.toHaveBeenCalled();
  });

  it('rejects with 404 when template belongs to a different tenant', async () => {
    mockFindTemplateById.mockResolvedValueOnce({
      id: TPL_UUID,
      tenant_id: 'OTHER-TENANT',
      settings: {},
    });
    const app = buildApp();
    const res = await app.request(
      `/api/cards/${TPL_UUID}/table-card/element/${EL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
