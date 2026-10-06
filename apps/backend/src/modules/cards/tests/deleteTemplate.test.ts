/**
 * Unit tests for DELETE /api/cards/:id and `deleteTemplateService`.
 *
 * Regression coverage for two related fixes (plan:
 * `fix_delete_500_+_r2_cleanup_+_download_table_card_1c2ed700`):
 *
 *   1. **500 → 404**: Previously a `throw new Error('Published templates
 *      cannot be deleted via this route')` in the service layer was being
 *      wrapped by errorHandler as `ServerError(500)`, breaking every
 *      delete from the Template Library (which only shows published
 *      rows). The guard has been removed — published templates can be
 *      deleted directly. This test pins down the new behaviour: deletion
 *      succeeds regardless of status, and cross-tenant access still
 *      returns a clean 404.
 *
 *   2. **R2 cleanup completeness**: `collectR2KeysForTemplate` now
 *      includes `settings.tableCard.exportKey` (the merged PNG) in
 *      addition to per-element imageKeys. The first test below verifies
 *      that the tombstone enqueue path picks up the exportKey.
 *
 *   3. **R2 outage isolation**: A failing enqueue must NOT fail the
 *      user-facing delete (best-effort cleanup, mirroring the
 *      `enqueueTemplateR2Keys` per-key try/catch design).
 *
 * Plan reference: `fix_delete_500_+_r2_cleanup_+_download_table_card_1c2ed700`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

// ---- Mocks (must be hoisted) ----

const {
  mockEnqueueTemplateR2Keys,
  mockDeleteTemplate,
  mockFindTemplateById,
  mockGetDbForRequest,
} = vi.hoisted(() => ({
  mockEnqueueTemplateR2Keys: vi.fn(),
  mockDeleteTemplate: vi.fn(),
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
  deleteTemplate: mockDeleteTemplate,
}));

vi.mock('../services/r2Keys', () => ({
  collectR2KeysForTemplate: vi.fn(),
  diffRemovedR2Keys: vi.fn(),
  enqueueTemplateR2Keys: mockEnqueueTemplateR2Keys,
}));

// `cardService.ts` imports `@saome/shared/logic/cardSettings` for
// `unwrapCardSettings`. The workerd test pool cannot resolve the
// shared package (r2Keys.ts has the same note), so we stub it with
// a passthrough identity function for these tests.
vi.mock('@saome/shared/logic/cardSettings', () => ({
  unwrapCardSettings: (x: unknown) => x,
}));

import { errorHandler } from '@/shared/middleware/errorHandler';
import { deleteCardRoute } from '../routes/delete';

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorHandler);
  app.route('/api/cards', deleteCardRoute);
  return app;
}

const TEST_ENV = {
  HYPERDRIVE: {} as never,
  ASSETS: { delete: vi.fn(), get: vi.fn(), put: vi.fn() },
} as unknown as HonoEnv['Bindings'];

const TPL_UUID = '22222222-2222-4222-8222-222222222222';
const TENANT = 'tenant-uuid';
const OTHER_TENANT = 'OTHER-TENANT';

describe('DELETE /api/cards/:id — tombstone cleanup + status-agnostic delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default happy path: published template, owned by current tenant
    mockFindTemplateById.mockResolvedValue({
      id: TPL_UUID,
      tenant_id: TENANT,
      status: 'published',
      settings: {
        tableCard: {
          exportKey: `${TENANT}/${TPL_UUID}/table-card-export.png`,
        },
      },
    });
    mockEnqueueTemplateR2Keys.mockResolvedValue({ enqueued: 1, skipped: 0 });
    mockDeleteTemplate.mockResolvedValue(undefined);
  });

  it('deletes a published template successfully (regression: was 500, now 200)', async () => {
    const app = buildApp();
    const res = await app.request(
      `/api/cards/${TPL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
    expect(mockEnqueueTemplateR2Keys).toHaveBeenCalledTimes(1);
    expect(mockDeleteTemplate).toHaveBeenCalledTimes(1);
  });

  it('enqueues the merged exportKey for async R2 deletion (regression: was missing)', async () => {
    const app = buildApp();
    const res = await app.request(
      `/api/cards/${TPL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    // Verify the unwrapped settings (with the exportKey) reach the
    // enqueue helper, so `collectR2KeysForTemplate` can pick up the
    // merged PNG. The actual collection logic is covered in
    // r2OrphanCleanup.test.ts.
    expect(mockEnqueueTemplateR2Keys).toHaveBeenCalledTimes(1);
    const callArgs = mockEnqueueTemplateR2Keys.mock.calls[0];
    // [sql, tenantId, templateId, settings]
    expect(callArgs[1]).toBe(TENANT);
    expect(callArgs[2]).toBe(TPL_UUID);
    expect(callArgs[3]).toEqual(
      expect.objectContaining({
        tableCard: expect.objectContaining({
          exportKey: `${TENANT}/${TPL_UUID}/table-card-export.png`,
        }),
      }),
    );
  });

  it('deletes a draft template successfully (original happy path)', async () => {
    mockFindTemplateById.mockResolvedValueOnce({
      id: TPL_UUID,
      tenant_id: TENANT,
      status: 'draft',
      settings: {},
    });
    const app = buildApp();
    const res = await app.request(
      `/api/cards/${TPL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    expect(mockDeleteTemplate).toHaveBeenCalledTimes(1);
  });

  it('returns 200 even when tombstone enqueue throws (best-effort cleanup)', async () => {
    mockEnqueueTemplateR2Keys.mockRejectedValueOnce(
      new Error('r2_pending_deletes INSERT failed'),
    );
    const app = buildApp();
    const res = await app.request(
      `/api/cards/${TPL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    // The user-facing path must not 500 because of a tombstone
    // failure — the R2 sweep is async and best-effort by design.
    expect(res.status).toBe(200);
  });

  it('returns 404 when the template does not exist', async () => {
    mockFindTemplateById.mockResolvedValueOnce(undefined);
    const app = buildApp();
    const res = await app.request(
      `/api/cards/${TPL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
    expect(mockEnqueueTemplateR2Keys).not.toHaveBeenCalled();
    expect(mockDeleteTemplate).not.toHaveBeenCalled();
  });

  it('returns 404 when the template belongs to a different tenant (cross-tenant isolation)', async () => {
    mockFindTemplateById.mockResolvedValueOnce({
      id: TPL_UUID,
      tenant_id: OTHER_TENANT,
      status: 'published',
      settings: {},
    });
    const app = buildApp();
    const res = await app.request(
      `/api/cards/${TPL_UUID}`,
      { method: 'DELETE' },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
    expect(mockEnqueueTemplateR2Keys).not.toHaveBeenCalled();
    expect(mockDeleteTemplate).not.toHaveBeenCalled();
  });
});
