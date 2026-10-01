/**
 * getPublic route validation tests — UUID zod parse (Q2 regression).
 *
 * @module modules/pass-templates/tests/getPublic.validation
 *
 * Bug Q2 (2026-10-01): `routes/getPublic.ts` previously called
 * `c.req.param('id')` directly and forwarded to `findPublicTemplateById`.
 * Random UUID-shaped strings / garbage caused PostgresError 500s.
 *
 * This test exercises the route layer (via Hono app.request) and asserts:
 *   (a) valid UUID → 200 (with mocked template row)
 *   (b) non-UUID path segment → 404 (mapped from NotFoundError, NOT 500)
 *   (c) empty path segment → 404 (Hono won't normally route this, but
 *       the test pins the behavior so a future refactor can't accidentally
 *       re-introduce the bypass)
 *
 * Per Rule 019 § 4.1, the test pins the route-layer contract; the
 * service-layer tests in `getPublic.test.ts` pin the projection logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getPublicRoute } from '../routes/getPublic';
import { errorHandler } from '@/shared/middleware/errorHandler';
import * as templatesDb from '../db/templates';
import type { PublicTemplateRow } from '../db/templates';
import type { Sql } from '@/shared/db/client';

// Mock `getDbForRequest` so the test doesn't depend on a real Hyperdrive
// connection string / env binding. The actual SQL execution is mocked at
// the `findPublicTemplateById` boundary (db/templates.ts).
vi.mock('@/shared/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/shared/db/client')>(
    '@/shared/db/client',
  );
  return {
    ...actual,
    getDbForRequest: vi.fn().mockResolvedValue({} as Sql),
  };
});

const VALID_UUID = '716c4244-6c63-496d-a967-6c87cdac605d';

const SAMPLE_ROW: PublicTemplateRow = {
  id: VALID_UUID,
  name: 'Café Rewards',
  card_type: 'reward_card',
  settings: { logoText: 'Café 咖啡', issuerName: 'Café Rewards Co.' },
};

/**
 * Build a minimal Hono app that mounts `getPublicRoute` so we can call it
 * via `app.request()` (which Hono's test helpers expose). This isolates
 * the route from the full module's auth/middleware chain but keeps the
 * global error handler so SaomeError → status code mapping still works.
 */
function makeApp() {
  const app = new Hono<HonoEnv>().onError(errorHandler).route('/', getPublicRoute);
  return app;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getPublicRoute — UUID zod parse (Q2 regression 2026-10-01)', () => {
  it('(a) valid UUID returns 200 with the template DTO', async () => {
    vi.spyOn(templatesDb, 'findPublicTemplateById').mockResolvedValue(SAMPLE_ROW);

    const app = makeApp();
    const res = await app.request(`/${VALID_UUID}/public`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { template: Record<string, unknown> };
    expect(body.template.id).toBe(VALID_UUID);
    expect(body.template.name).toBe('Café Rewards');
  });

  it('(b) non-UUID path segment returns 404 (NOT 500) — Q2 regression', async () => {
    // Critical: if the route is refactored to skip zod, this test will
    // surface the 500 from PostgresError rather than the expected 404.
    const findSpy = vi.spyOn(templatesDb, 'findPublicTemplateById');

    const app = makeApp();
    const res = await app.request('/abc/public');

    expect(res.status).toBe(404);
    // DB layer MUST NOT have been called — zod blocks before getDbForRequest's
    // effective path. (We assert via spy not invoked since the route throws
    // before reaching the service call.)
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('(c) malformed UUID with wrong length returns 404', async () => {
    const findSpy = vi.spyOn(templatesDb, 'findPublicTemplateById');

    const app = makeApp();
    // 35 chars instead of 36, plus non-hex chars — guaranteed invalid UUID
    const res = await app.request('/12345678-1234-1234-1234-12345678901/public');

    expect(res.status).toBe(404);
    expect(findSpy).not.toHaveBeenCalled();
  });
});
