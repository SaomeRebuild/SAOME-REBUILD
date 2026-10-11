/**
 * getTemplateImage route tests — public R2 image proxy (logo / icon / background).
 *
 * @module modules/pass-templates/tests/getTemplateImage
 *
 * Pin the contract for `createGetTemplateImageRoute(imageType)` across
 * all three image types via a `describe.each` loop. The 7 contract
 * behaviors were originally written for `getLogo.ts` (logo only); this
 * file extends coverage to icon + background so the regression test
 * isn't tied to a specific image type.
 *
 * Covers the 7 contract behaviors (run for each of logo / icon / background):
 *   1. Template not found → 404 (NotFoundError)
 *   2. Template found but settings.<imageField> is empty → 204
 *   3. settings.<imageField> does NOT match `buildImageKey(tenant_id, template_id, imageType)`
 *      → 204 silent fail-closed (no diagnostic)
 *   4. settings.<imageField> matches AND R2 has the object → 200 + correct headers + body
 *   5. settings.<imageField> matches BUT R2 object is missing → 204 silent
 *   6. Malformed UUID path → 404 (NotFoundError), never 500
 *   7. tenant_id is NULL → fail-closed 204 (defensive; DB schema normally
 *      has NOT NULL but defensively handles a corrupted row)
 *
 * Decision: runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md
 * + 2026-10-12 extension to icon + background.
 *
 * The route layer is tested via Hono app.request with mocked DB and a
 * mock R2 binding (the latter via env.ASSETS.get).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { createGetTemplateImageRoute, type TemplateImageType } from '../routes/getTemplateImage';
import { errorHandler } from '@/shared/middleware/errorHandler';
import * as imageKeysDb from '../db/imageKeys';
import type { TemplateImageAuditRow } from '../db/imageKeys';
import { CARD_IMAGE_KEYS } from '@saome/shared/constants/card-images';
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

/**
 * Map imageType → settings.<field>. Mirrors the FIELD_MAP in
 * routes/getTemplateImage.ts and db/imageKeys.ts. Kept here too so
 * the test fixtures don't need to import internals.
 */
const FIELD_MAP: Record<TemplateImageType, string> = {
  logo: 'issuerLogo',
  icon: 'iconImage',
  background: 'backgroundImage',
};

/**
 * Mock R2 object — the real `R2ObjectBody` has more fields but the route
 * only reads `httpMetadata?.contentType` and `object.size` and `object.body`.
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

/**
 * Mock ASSETS binding with a programmable get() map. `null` → silent 204.
 */
function makeMockR2(objects: Record<string, ReturnType<typeof makeR2Object> | null>) {
  return {
    get: vi.fn(async (key: string) => objects[key] ?? null),
  };
}

/**
 * Build a Hono app that mounts the route for the given image type
 * with the given mock R2 binding. The env is wired through `app.fetch`
 * second arg.
 */
function makeApp(imageType: TemplateImageType, r2: ReturnType<typeof makeMockR2>) {
  const route = createGetTemplateImageRoute(imageType);
  const app = new Hono<HonoEnv>().onError(errorHandler).route('/', route);
  const env = { ASSETS: r2 } as unknown as HonoEnv['Variables'];
  return { app, env };
}

// =============================================================================
// Spy helpers
// =============================================================================
function stubAudit(row: TemplateImageAuditRow | null) {
  vi.spyOn(imageKeysDb, 'findTemplateImageKey').mockResolvedValue(row);
}

/**
 * Per-imageType base row. Uses the actual filename from CARD_IMAGE_KEYS
 * (the same source `buildImageKey` reads from) so the audit pass matches
 * the key produced by `buildImageKey(tenantId, templateId, imageType)`.
 * Without this, logo tests would fail because `CARD_IMAGE_KEYS.logo`
 * is `'issuer-logo.png'`, not `'logo.png'`.
 */
function makeBaseRow(imageType: TemplateImageType): TemplateImageAuditRow {
  const filename = CARD_IMAGE_KEYS[imageType];
  return {
    tenant_id: TENANT_A,
    image_key: `${TENANT_A}/${TEMPLATE_ID}/${filename}`,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Parameterized tests — run for each image type
// =============================================================================
const IMAGE_TYPES: TemplateImageType[] = ['logo', 'icon', 'background'];

describe.each(IMAGE_TYPES)('createGetTemplateImageRoute(%s)', (imageType) => {
  const field = FIELD_MAP[imageType];
  const filename = CARD_IMAGE_KEYS[imageType];
  const expectedKey = `${TENANT_A}/${TEMPLATE_ID}/${filename}`;

  it('(1) template not found → 404', async () => {
    stubAudit(null);
    const { app, env } = makeApp(imageType, makeMockR2({}));
    const res = await app.request(`/${TEMPLATE_ID}/${imageType}`, {}, env);
    expect(res.status).toBe(404);
  });

  it(`(2) settings.${field} is undefined → 204 (no body)`, async () => {
    stubAudit({ tenant_id: TENANT_A, image_key: null });
    const { app, env } = makeApp(imageType, makeMockR2({}));
    const res = await app.request(`/${TEMPLATE_ID}/${imageType}`, {}, env);
    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe('');
  });

  it('(3) R2 key mismatch → 204 silent fail-closed (no diagnostic)', async () => {
    // Recorded key is for TENANT_B but tenant_id on row is TENANT_A
    const mismatchedRow: TemplateImageAuditRow = {
      tenant_id: TENANT_A,
      image_key: `${TENANT_B}/${TEMPLATE_ID}/${filename}`, // wrong tenant!
    };
    stubAudit(mismatchedRow);

    const r2 = makeMockR2({
      [expectedKey]: makeR2Object('image/png', 'CORRECT'),
    });
    const { app, env } = makeApp(imageType, r2);
    const res = await app.request(`/${TEMPLATE_ID}/${imageType}`, {}, env);

    expect(res.status).toBe(204);
    // Critical: R2.get MUST NOT have been called when the key doesn't match.
    // If we accidentally fetched with the WRONG key (TENANT_B/.../...)
    // we would have leaked cross-tenant bytes.
    expect(r2.get).not.toHaveBeenCalled();
  });

  it('(4) R2 key matches AND R2 hit → 200 with body + cache headers', async () => {
    stubAudit(makeBaseRow(imageType));
    const r2 = makeMockR2({
      [expectedKey]: makeR2Object('image/png', 'PNG-BYTES'),
    });
    const { app, env } = makeApp(imageType, r2);
    const res = await app.request(`/${TEMPLATE_ID}/${imageType}`, {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Length')).toBe('9'); // 'PNG-BYTES'.length
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    const body = await res.text();
    expect(body).toBe('PNG-BYTES');
    // Sanity: get() was called with the EXACT expected key
    expect(r2.get).toHaveBeenCalledWith(expectedKey);
  });

  it('(5) R2 key matches BUT R2 object is missing → 204 silent', async () => {
    stubAudit(makeBaseRow(imageType));
    const r2 = makeMockR2({}); // empty
    const { app, env } = makeApp(imageType, r2);
    const res = await app.request(`/${TEMPLATE_ID}/${imageType}`, {}, env);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(r2.get).toHaveBeenCalledWith(expectedKey);
  });

  it('(6) malformed UUID path → 404 (NEVER 500)', async () => {
    const findSpy = vi.spyOn(imageKeysDb, 'findTemplateImageKey');
    const { app, env } = makeApp(imageType, makeMockR2({}));
    const res = await app.request(`/abc/${imageType}`, {}, env);
    expect(res.status).toBe(404);
    // Critical: DB MUST NOT be reached when zod blocks
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('(7) tenant_id is NULL → fail-closed 204 (defensive)', async () => {
    // Hypothetical: a corrupted row with NULL tenant_id. DB schema normally
    // has NOT NULL, but defensively handle the failure mode.
    const corruptedRow = {
      tenant_id: null as unknown as string, // bypass TS for the test scenario
      image_key: `${TENANT_A}/${TEMPLATE_ID}/${filename}`,
    };
    stubAudit(corruptedRow);
    const { app, env } = makeApp(imageType, makeMockR2({}));
    const res = await app.request(`/${TEMPLATE_ID}/${imageType}`, {}, env);
    // buildImageKey('') would produce '.../.../${filename}' which
    // doesn't equal `${TENANT_A}/.../${filename}` → silent 204.
    expect(res.status).toBe(204);
  });
});

// =============================================================================
// Cross-cutting tests — exercise behaviors shared by all image types
// =============================================================================
describe('createGetTemplateImageRoute — factory contract', () => {
  it('pre-built getLogoRoute / getIconRoute / getBackgroundRoute all exist', () => {
    // Sanity: make sure the pre-built exports from routes/getTemplateImage.ts
    // are present and are Hono sub-apps (have a .fetch method).
    return import('../routes/getTemplateImage').then((mod) => {
      expect(typeof mod.getLogoRoute.fetch).toBe('function');
      expect(typeof mod.getIconRoute.fetch).toBe('function');
      expect(typeof mod.getBackgroundRoute.fetch).toBe('function');
    });
  });
});
