/**
 * uploadStampImage route — integration tests (no DB, no real R2).
 *
 * @module modules/stamp-images/tests/uploadStampImageRoute
 *
 * Tests the route layer end-to-end via `app.request(...)`. The auth
 * middleware, DB layer, and R2 binding are all mocked so the test
 * runs in milliseconds without a live Postgres or R2 bucket.
 *
 * Coverage:
 *   1. Auth required (no Bearer header → 401).
 *   2. Path-param UUID guard (bad UUID → 404).
 *   3. fillCount range guard (out of range → 404, not 400, to
 *      avoid leaking the UUID format to attackers).
 *   4. Tenant ownership (different tenant → 404).
 *   5. Body validation (missing imageBase64 → 400).
 *   6. Happy path (valid input → 200, response shape correct).
 *
 * The route calls `uploadStampImage` (the service) — that service
 * has its own test surface (`./uploadStampImage.test.ts`). These
 * tests focus on the HTTP plumbing, not the service internals.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

// === Mocks ===
// Mock auth so we can simulate "no token" / "different tenant" /
// "valid token" by returning different getAuthenticatedUser results.
const mockGetAuthenticatedUser = vi.fn();
const mockRequireAuthImpl = vi.fn(async (_c: unknown, next: () => Promise<void>) => next());
vi.mock('@/shared/middleware/auth', () => ({
  requireAuth: (c: unknown, next: () => Promise<void>) => mockRequireAuthImpl(c, next),
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
}));

// Mock the DB layer so we never touch real Postgres. The shape mirrors
// `apps/backend/src/modules/stamp-images/db/stampImages.ts`.
const mockFindTemplateById = vi.fn();
const mockInsertPending = vi.fn();
const mockMarkUploaded = vi.fn();
vi.mock('../db/stampImages', () => ({
  insertPendingStampImage: (...args: unknown[]) => mockInsertPending(...args),
  markStampImageUploaded: (...args: unknown[]) => mockMarkUploaded(...args),
  markStampImageFailed: vi.fn(async () => null),
  deletePendingStampImage: vi.fn(async () => undefined),
  findUploadedStampImage: vi.fn(async () => null),
}));

// Mock the service so the route's error mapping (SaomeError → HTTP
// status) is exercised without depending on real R2. Each test
// re-mocks the implementation per-case.
const mockUploadStampImage = vi.fn();
vi.mock('../services/uploadStampImage', () => ({
  uploadStampImage: (...args: unknown[]) => mockUploadStampImage(...args),
  buildStampImageKey: vi.fn(),
  sha256Hex: vi.fn(),
  decodeBase64ToBytes: vi.fn(),
  ensureTemplateBelongsToTenantOr404: vi.fn(), // real impl, no-op
  getUploadedStampImage: vi.fn(),
  dropPendingStampImage: vi.fn(),
}));

// Mock cards db templates so the route's `findTemplateById` call
// doesn't reach the real DB.
vi.mock('@/modules/cards/db/templates', () => ({
  findTemplateById: (...args: unknown[]) => mockFindTemplateById(...args),
}));

const mockGetDbForRequest = vi.fn();
vi.mock('@/shared/db/client', () => ({
  getDbForRequest: (...args: unknown[]) => mockGetDbForRequest(...args),
}));

import { errorHandler } from '@/shared/middleware/errorHandler';
import { stampImagesModule } from '../index';
import { BadGatewayError, NotFoundError, ValidationError } from '@/shared/lib/saomeError';

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorHandler);
  app.route('/api/templates', stampImagesModule);
  return app;
}

const TEST_ENV = {
  HYPERDRIVE: {} as never,
  ASSETS: {} as R2Bucket,
  R2_ACCOUNT_ID: 'test',
  R2_ACCESS_KEY_ID: 'test',
  R2_SECRET_ACCESS_KEY: 'test',
  R2_PUBLIC_URL: 'https://saome-backend.example.com',
} as unknown as HonoEnv['Bindings'];

const VALID_TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const VALID_TENANT_ID = 'tenant-uuid';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthenticatedUser.mockReturnValue({ tenantId: VALID_TENANT_ID });
  mockGetDbForRequest.mockResolvedValue({});
  mockFindTemplateById.mockResolvedValue({
    id: VALID_TEMPLATE_ID,
    tenant_id: VALID_TENANT_ID,
  });
});

describe('PUT /api/templates/:templateId/stamp-images/:fillCount — auth', () => {
  it('returns 401 when no Authorization header is present', async () => {
    // Override the auth middleware for this test only — it should
    // throw AuthError as if the JWT was missing.
    mockRequireAuthImpl.mockImplementationOnce(async () => {
      const { AuthError } = await import('@/shared/lib/saomeError');
      throw new AuthError(
        'auth.error.missingToken',
        'Missing or malformed Authorization header',
      );
    });

    const app = buildApp();
    const res = await app.request(
      `/api/templates/${VALID_TEMPLATE_ID}/stamp-images/0`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillCount: 0,
          imageBase64: 'iVBORw0KGgo=',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/templates/:templateId/stamp-images/:fillCount — path params', () => {
  it('returns 404 when templateId is not a UUID (anti-probe)', async () => {
    const app = buildApp();
    const res = await app.request(
      '/api/templates/not-a-uuid/stamp-images/0',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillCount: 0,
          imageBase64: 'iVBORw0KGgo=',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
    // No DB lookup triggered for malformed UUID.
    expect(mockFindTemplateById).not.toHaveBeenCalled();
  });

  it('returns 404 when fillCount is out of range (16+)', async () => {
    const app = buildApp();
    const res = await app.request(
      `/api/templates/${VALID_TEMPLATE_ID}/stamp-images/16`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillCount: 16,
          imageBase64: 'iVBORw0KGgo=',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when template belongs to a different tenant', async () => {
    mockFindTemplateById.mockResolvedValueOnce({
      id: VALID_TEMPLATE_ID,
      tenant_id: 'other-tenant',
    });
    mockUploadStampImage.mockImplementationOnce(() => {
      throw new NotFoundError('common.error.notFound', 'Template not found');
    });

    const app = buildApp();
    const res = await app.request(
      `/api/templates/${VALID_TEMPLATE_ID}/stamp-images/0`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillCount: 0,
          imageBase64: 'iVBORw0KGgo=',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when template row does not exist', async () => {
    mockFindTemplateById.mockResolvedValueOnce(null);
    const app = buildApp();
    const res = await app.request(
      `/api/templates/${VALID_TEMPLATE_ID}/stamp-images/0`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillCount: 0,
          imageBase64: 'iVBORw0KGgo=',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/templates/:templateId/stamp-images/:fillCount — body validation', () => {
  it('returns 400 when imageBase64 is missing', async () => {
    const app = buildApp();
    const res = await app.request(
      `/api/templates/${VALID_TEMPLATE_ID}/stamp-images/0`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillCount: 0,
          // imageBase64 intentionally omitted.
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    expect(mockUploadStampImage).not.toHaveBeenCalled();
  });

  it('returns 400 when imageBase64 is empty string', async () => {
    const app = buildApp();
    const res = await app.request(
      `/api/templates/${VALID_TEMPLATE_ID}/stamp-images/0`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillCount: 0,
          imageBase64: '',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is not valid JSON', async () => {
    const app = buildApp();
    const res = await app.request(
      `/api/templates/${VALID_TEMPLATE_ID}/stamp-images/0`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json-at-all',
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/templates/:templateId/stamp-images/:fillCount — happy path', () => {
  it('returns 200 with the canonical response shape on success', async () => {
    const fakeResult = {
      r2Key: 'tenants/tenant-uuid/templates/11111111-1111-4111-8111-111111111111/stamp-5.png',
      byteHash: 'a'.repeat(64),
      byteLength: 12345,
      uploadedAt: '2026-10-13T10:00:00.000Z',
    };
    mockUploadStampImage.mockResolvedValueOnce(fakeResult);

    const app = buildApp();
    const res = await app.request(
      `/api/templates/${VALID_TEMPLATE_ID}/stamp-images/5`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillCount: 5,
          imageBase64: 'iVBORw0KGgo=',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof fakeResult;
    expect(body).toEqual(fakeResult);

    // Service was called with the parsed path params + body.
    expect(mockUploadStampImage).toHaveBeenCalledTimes(1);
    const callArgs = mockUploadStampImage.mock.calls[0]!;
    // callArgs: [sql, bucket, { templateId, tenantId, fillCount, imageBase64 }]
    const serviceArgs = callArgs[2] as Record<string, unknown>;
    expect(serviceArgs.templateId).toBe(VALID_TEMPLATE_ID);
    expect(serviceArgs.tenantId).toBe(VALID_TENANT_ID);
    expect(serviceArgs.fillCount).toBe(5);
    expect(serviceArgs.imageBase64).toBe('iVBORw0KGgo=');
  });
});

describe('PUT /api/templates/:templateId/stamp-images/:fillCount — error mapping', () => {
  it('maps service ValidationError → 400', async () => {
    mockUploadStampImage.mockRejectedValueOnce(
      new ValidationError('common.error.validationFailed', { reason: 'bad png' }),
    );
    const app = buildApp();
    const res = await app.request(
      `/api/templates/${VALID_TEMPLATE_ID}/stamp-images/0`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillCount: 0,
          imageBase64: 'iVBORw0KGgo=',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('maps service BadGatewayError → 502 (R2 PUT failed)', async () => {
    mockUploadStampImage.mockRejectedValueOnce(
      new BadGatewayError({
        upstream: 'r2',
        kind: 'invalid_response',
        message: 'R2 PUT failed',
      }),
    );
    const app = buildApp();
    const res = await app.request(
      `/api/templates/${VALID_TEMPLATE_ID}/stamp-images/0`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fillCount: 0,
          imageBase64: 'iVBORw0KGgo=',
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(502);
  });
});