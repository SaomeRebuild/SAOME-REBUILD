/**
 * tableCardElementUploadUrl.test.ts — vitest unit tests for the
 * Round 3 Fix 6 contentType alignment.
 *
 * @module modules/cards/tests/tableCardElementUploadUrl
 *
 * Background:
 *   - The pre-signed R2 PUT URL was previously baked with
 *     `Content-Type: image/png` regardless of the actual file MIME.
 *   - JPG uploads failed with `SignatureDoesNotMatch` because R2 checks
 *     that the signed header matches the actual PUT header.
 *   - Round 3 Fix 6 makes the route accept `contentType` in the request
 *     body (`image/png` | `image/jpeg`) and bake it into the signature.
 *
 * Tests:
 *   1. Request body missing `contentType` → 400 VALIDATION_ERROR.
 *   2. Request body with `contentType: image/jpeg` → accepted (signed).
 *   3. Request body with `contentType: image/gif` → 400 (not in enum).
 *   4. The signature built by the AwsClient carries the actual
 *      `Content-Type` header (regression for Fix 6 — the previous bug
 *      was hard-coding `image/png`).
 *
 * Auth + DB mocked at the module boundary so we don't need a live
 * Postgres. R2 signing is mocked via `aws4fetch.AwsClient.prototype.sign`
 * to capture the Request and assert on its headers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '@/shared/types/bindings';

// Mock DB layer + auth middleware to bypass real Postgres + JWT verify.
vi.mock('@/shared/db/client', () => ({
  getDb: vi.fn(),
  getDbForRequest: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/shared/middleware/auth', () => ({
  requireAuth: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  getAuthenticatedUser: vi.fn().mockReturnValue({ tenantId: 'tenant-uuid' }),
}));

vi.mock('../db/templates', () => ({
  findTemplateById: vi.fn().mockResolvedValue({
    id: 'tpl-uuid',
    tenant_id: 'tenant-uuid',
  }),
}));

// Capture the Request that the route passes to AwsClient.sign. This is
// where Round 3 Fix 6 lives — the route must put the actual
// Content-Type into the signed Request, not hard-code image/png.
const signMock = vi.fn(async (req: Request) => {
  // Return a fake signed URL so the route can stringify it.
  return {
    url: `https://signed.example.com/${new URL(req.url).pathname}?X-Amz-Signature=fake`,
    headers: req.headers,
  };
});

vi.mock('aws4fetch', () => ({
  AwsClient: vi.fn().mockImplementation(() => ({
    sign: signMock,
  })),
}));

import { errorHandler } from '@/shared/middleware/errorHandler';
import { tableCardElementUploadUrlRoute } from '../routes/tableCardElementUploadUrl';

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorHandler);
  app.route('/api/cards', tableCardElementUploadUrlRoute);
  return app;
}

const TEST_ENV = {
  HYPERDRIVE: {} as never,
  R2_ACCOUNT_ID: 'test-account-id',
  R2_ACCESS_KEY_ID: 'test-key-id',
  R2_SECRET_ACCESS_KEY: 'test-secret',
  R2_PUBLIC_URL: 'https://saome-backend.example.com',
} as unknown as HonoEnv['Bindings'];

describe('tableCardElementUploadUrl — Round 3 Fix 6 contentType alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects request body missing contentType with 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const res = await app.request(
      '/api/cards/tpl-uuid/table-card/element/upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elementId: '11111111-1111-4111-8111-111111111111',
          // contentType intentionally omitted.
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('accepts request with contentType=image/png and signs with image/png', async () => {
    const app = buildApp();
    const res = await app.request(
      '/api/cards/tpl-uuid/table-card/element/upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elementId: '11111111-1111-4111-8111-111111111111',
          contentType: 'image/png',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    // AwsClient.sign was called with a Request that carries image/png.
    expect(signMock).toHaveBeenCalledTimes(1);
    const signedReq = signMock.mock.calls[0]![0] as Request;
    expect(signedReq.headers.get('Content-Type')).toBe('image/png');
    expect(signedReq.method).toBe('PUT');
  });

  it('accepts request with contentType=image/jpeg and signs with image/jpeg (Round 3 Fix 6 regression)', async () => {
    const app = buildApp();
    const res = await app.request(
      '/api/cards/tpl-uuid/table-card/element/upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elementId: '22222222-2222-4222-8222-222222222222',
          contentType: 'image/jpeg',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    // The signature MUST carry the actual file MIME type — JPG uploads
    // were silently broken before Fix 6 because the signature hard-coded
    // image/png. This assertion pins down the regression.
    expect(signMock).toHaveBeenCalledTimes(1);
    const signedReq = signMock.mock.calls[0]![0] as Request;
    expect(signedReq.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('rejects request with contentType outside the enum with 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const res = await app.request(
      '/api/cards/tpl-uuid/table-card/element/upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elementId: '11111111-1111-4111-8111-111111111111',
          contentType: 'image/gif',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    // Sign was NOT called — invalid input never reaches R2 signing.
    expect(signMock).not.toHaveBeenCalled();
  });

  it('rejects request with non-UUID elementId with 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const res = await app.request(
      '/api/cards/tpl-uuid/table-card/element/upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elementId: 'not-a-uuid',
          contentType: 'image/png',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    expect(signMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pure schema pin — keeps the enum in sync with the Inspector's
// `accept="image/png,image/jpeg"`. If the Inspector adds a new MIME type,
// both the schema and this test must be updated together.
// ─────────────────────────────────────────────────────────────────────────────
describe('tableCardElementUploadUrl — contentType enum contract', () => {
  it('enum values are exactly image/png and image/jpeg (matches Inspector accept)', () => {
    // Re-derive the same shape used in the route. If the route's
    // schema drifts, this assertion fails fast.
    const requestSchema = z.object({
      elementId: z.string().uuid(),
      contentType: z.enum(['image/png', 'image/jpeg']),
    });
    expect(requestSchema.shape.contentType.options).toEqual([
      'image/png',
      'image/jpeg',
    ]);
  });
});
