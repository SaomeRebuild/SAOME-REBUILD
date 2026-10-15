/**
 * getTemplateStampImage route tests — public R2 image proxy for stamp card PNGs.
 *
 * @module modules/pass-templates/tests/getTemplateStampImage
 *
 * Pins the 5 contract behaviors of `createGetTemplateStampImageRoute(fillCount)`:
 *   1. Template not found OR no uploaded stamp image → 204 (no body)
 *   2. Uploaded stamp image BUT r2_key does NOT match
 *      `buildStampImageKey(tenant_id, template_id, fillCount)` → 204 silent
 *      fail-closed (no diagnostic)
 *   3. r2_key matches AND R2 has the object → 200 + correct headers + body
 *   4. r2_key matches AND R2 object is missing → 204 silent
 *   5. Malformed UUID path → 404 (NotFoundError), never 500
 *   6. tenant_id is NULL → fail-closed 204 (defensive; corrupted row)
 *
 * Decision: runs/decisions/2026-10-15-stamp-card-push-wiring.md
 *
 * The route reads a JOIN'd audit row via `findStampImageAudit` (a
 * single SQL query), mocked here. The route layer is otherwise
 * integration-tested end-to-end via the `passTemplateMapping` tests
 * (which pin the dispatch contract from the mapping's perspective).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { createGetTemplateStampImageRoute } from '../routes/getTemplateStampImage';
import { errorHandler } from '@/shared/middleware/errorHandler';
import * as stampImagesDb from '@/modules/stamp-images/db/stampImages';
import type { StampImageAuditRow } from '@/modules/stamp-images/db/stampImages';
import { buildStampImageKey } from '@/modules/stamp-images/services/uploadStampImage';
import type { Sql } from '@/shared/db/client';

// =============================================================================
// Mock: getDbForRequest (so we don't need a real Hyperdrive connection)
// =============================================================================
vi.mock('@/shared/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/shared/db/client')>(
    '@/shared/db/client',
  );
  return {
    ...actual,
    getDbForRequest: vi.fn().mockResolvedValue({} as Sql),
  };
});

// =============================================================================
// Test fixtures
// =============================================================================
const TENANT_A = '11111111-1111-4111-a111-111111111111';
const TENANT_B = '22222222-2222-4222-a222-222222222222';
const TEMPLATE_ID = '716c4244-6c63-496d-a967-6c87cdac605d';
const FILL_COUNT = 0;
const expectedKey = buildStampImageKey(TENANT_A, TEMPLATE_ID, FILL_COUNT);

/**
 * Mock R2 object — mirrors the shape the route reads.
 */
function makeR2Object(contentType: string, body: string) {
  return {
    httpMetadata: { contentType },
    size: body.length,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
  };
}

function makeMockR2(objects: Record<string, ReturnType<typeof makeR2Object> | null>) {
  return {
    get: vi.fn(async (key: string) => objects[key] ?? null),
  };
}

function makeApp(r2: ReturnType<typeof makeMockR2>) {
  const route = createGetTemplateStampImageRoute(FILL_COUNT);
  const app = new Hono<HonoEnv>().onError(errorHandler).route('/', route);
  const env = { ASSETS: r2 } as unknown as HonoEnv['Variables'];
  return { app, env };
}

function stubAudit(row: StampImageAuditRow | null) {
  vi.spyOn(stampImagesDb, 'findStampImageAudit').mockResolvedValue(row);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Test suite
// =============================================================================
describe('createGetTemplateStampImageRoute(0)', () => {
  it('(1) no uploaded stamp image → 204 (no body)', async () => {
    // audit row with tenantId but NO r2Key = template exists, no upload yet
    stubAudit({ tenantId: TENANT_A, r2Key: null });
    const r2 = makeMockR2({
      [expectedKey]: makeR2Object('image/png', 'SHOULD-NOT-FETCH'),
    });
    const { app, env } = makeApp(r2);
    const res = await app.request(`/${TEMPLATE_ID}/stamp-image/${FILL_COUNT}`, {}, env);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    // Defensive: R2.get MUST NOT have been called when there's no row.
    expect(r2.get).not.toHaveBeenCalled();
  });

  it('(1b) template not found → 204 (no diagnostic)', async () => {
    stubAudit(null);
    const r2 = makeMockR2({});
    const { app, env } = makeApp(r2);
    const res = await app.request(`/${TEMPLATE_ID}/stamp-image/${FILL_COUNT}`, {}, env);
    expect(res.status).toBe(204);
    expect(r2.get).not.toHaveBeenCalled();
  });

  it('(2) r2_key mismatched → 204 silent (cross-tenant probing guard)', async () => {
    // Row's r2Key points at TENANT_B but the template belongs to
    // TENANT_A — corrupted row or probing attempt.
    const mismatched: StampImageAuditRow = {
      tenantId: TENANT_A,
      r2Key: buildStampImageKey(TENANT_B, TEMPLATE_ID, FILL_COUNT),
    };
    stubAudit(mismatched);
    const r2 = makeMockR2({
      [expectedKey]: makeR2Object('image/png', 'CORRECT-BYTES'),
    });
    const { app, env } = makeApp(r2);
    const res = await app.request(`/${TEMPLATE_ID}/stamp-image/${FILL_COUNT}`, {}, env);
    expect(res.status).toBe(204);
    // Critical: R2.get MUST NOT have been called when the key doesn't match.
    expect(r2.get).not.toHaveBeenCalled();
  });

  it('(3) r2_key matches AND R2 hit → 200 + cache headers + body', async () => {
    stubAudit({ tenantId: TENANT_A, r2Key: expectedKey });
    const r2 = makeMockR2({
      [expectedKey]: makeR2Object('image/png', 'PNG-BYTES'),
    });
    const { app, env } = makeApp(r2);
    const res = await app.request(`/${TEMPLATE_ID}/stamp-image/${FILL_COUNT}`, {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Length')).toBe('9'); // 'PNG-BYTES'.length
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    const body = await res.text();
    expect(body).toBe('PNG-BYTES');
    expect(r2.get).toHaveBeenCalledWith(expectedKey);
  });

  it('(4) r2_key matches BUT R2 object missing → 204 silent', async () => {
    stubAudit({ tenantId: TENANT_A, r2Key: expectedKey });
    const r2 = makeMockR2({}); // no objects
    const { app, env } = makeApp(r2);
    const res = await app.request(`/${TEMPLATE_ID}/stamp-image/${FILL_COUNT}`, {}, env);
    expect(res.status).toBe(204);
    expect(r2.get).toHaveBeenCalledWith(expectedKey);
  });

  it('(5) malformed UUID path → 404 (NotFoundError), never 500', async () => {
    stubAudit(null);
    const r2 = makeMockR2({});
    const { app, env } = makeApp(r2);
    const res = await app.request('/not-a-uuid/stamp-image/0', {}, env);
    expect(res.status).toBe(404);
    // Critical: the bot should NOT see a 5xx (which would invite retries).
    expect(res.status).toBeLessThan(500);
  });

  it('(6) tenant_id is NULL → fail-closed 204 (corrupted row defense)', async () => {
    stubAudit({ tenantId: null, r2Key: expectedKey });
    const r2 = makeMockR2({
      [expectedKey]: makeR2Object('image/png', 'SHOULD-NOT-FETCH'),
    });
    const { app, env } = makeApp(r2);
    const res = await app.request(`/${TEMPLATE_ID}/stamp-image/${FILL_COUNT}`, {}, env);
    expect(res.status).toBe(204);
    // Defensive: must not have called R2.get with a NULL-derived key.
    expect(r2.get).not.toHaveBeenCalled();
  });
});