/**
 * getLogo route tests — public R2 image proxy with multi-tenant audit.
 *
 * @module modules/pass-templates/tests/getLogo
 *
 * Decision: runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md
 *
 * Covers the 7 contract behaviors:
 *   1. Template not found → 404 (NotFoundError)
 *   2. Template found but settings.issuerLogo is empty → 204
 *   3. settings.issuerLogo does NOT match `buildImageKey(tenant_id, template_id, 'logo')`
 *      → 204 silent fail-closed (no diagnostic)
 *   4. settings.issuerLogo matches AND R2 has the object → 200 + correct headers + body
 *   5. settings.issuerLogo matches BUT R2 object is missing → 204 silent
 *   6. Malformed UUID path → 404 (NotFoundError), never 500
 *   7. tenant_id is NULL → fail-closed 204 (defensive; DB schema normally
 *      has NOT NULL but defensively handles a corrupted row)
 *
 * The route layer is tested via Hono app.request with mocked DB and a
 * mock R2 binding (the latter via env.ASSETS.get).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getLogoRoute } from '../routes/getLogo';
import { errorHandler } from '@/shared/middleware/errorHandler';
import * as templatesDb from '../db/templates';
import type { PublicTemplateRowWithTenant } from '../db/templates';
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
 * Build a Hono app that mounts the logo route with the given mock R2
 * binding. The env is wired through `app.fetch` second arg.
 */
function makeApp(r2: ReturnType<typeof makeMockR2>) {
  const app = new Hono<HonoEnv>().onError(errorHandler).route('/', getLogoRoute);
  const env = { ASSETS: r2 } as unknown as HonoEnv['Variables'];
  return { app, env };
}

// =============================================================================
// Spy helpers
// =============================================================================
function stubTemplate(row: PublicTemplateRowWithTenant | null) {
  vi.spyOn(templatesDb, 'findPublicTemplateWithTenantById').mockResolvedValue(row);
}

const baseRow: PublicTemplateRowWithTenant = {
  id: TEMPLATE_ID,
  tenant_id: TENANT_A,
  name: 'Café Rewards',
  card_type: 'reward_card',
  settings: {
    logoText: 'Café 咖啡',
    issuerName: 'Café Rewards Co.',
    issuerLogo: `${TENANT_A}/${TEMPLATE_ID}/issuer-logo.png`,
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Tests
// =============================================================================
describe('getLogoRoute — public R2 image proxy', () => {
  it('(1) template not found → 404', async () => {
    stubTemplate(null);
    const { app, env } = makeApp(makeMockR2({}));
    const res = await app.request(`/${TEMPLATE_ID}/logo`, {}, env);
    expect(res.status).toBe(404);
  });

  it('(2) settings.issuerLogo is undefined → 204 (no body)', async () => {
    stubTemplate({ ...baseRow, settings: { logoText: 'lt', issuerName: 'in' } });
    const { app, env } = makeApp(makeMockR2({}));
    const res = await app.request(`/${TEMPLATE_ID}/logo`, {}, env);
    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe('');
  });

  it('(3) R2 key mismatch → 204 silent fail-closed (no diagnostic)', async () => {
    // Recorded key is for TENANT_B but tenant_id on row is TENANT_A
    const mismatchedRow: PublicTemplateRowWithTenant = {
      ...baseRow,
      tenant_id: TENANT_A,
      settings: {
        ...baseRow.settings,
        issuerLogo: `${TENANT_B}/${TEMPLATE_ID}/issuer-logo.png`, // wrong tenant!
      },
    };
    stubTemplate(mismatchedRow);

    const r2 = makeMockR2({
      [`${TENANT_A}/${TEMPLATE_ID}/issuer-logo.png`]: makeR2Object('image/png', 'CORRECT'),
    });
    const { app, env } = makeApp(r2);
    const res = await app.request(`/${TEMPLATE_ID}/logo`, {}, env);

    expect(res.status).toBe(204);
    // Critical: R2.get MUST NOT have been called when the key doesn't match.
    // If we accidentally fetched with the WRONG key (TENANT_B/.../...) we
    // would have leaked cross-tenant bytes.
    expect(r2.get).not.toHaveBeenCalled();
  });

  it('(4) R2 key matches AND R2 hit → 200 with body + cache headers', async () => {
    stubTemplate(baseRow);
    const r2 = makeMockR2({
      [`${TENANT_A}/${TEMPLATE_ID}/issuer-logo.png`]: makeR2Object('image/png', 'PNG-BYTES'),
    });
    const { app, env } = makeApp(r2);
    const res = await app.request(`/${TEMPLATE_ID}/logo`, {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Length')).toBe('9'); // 'PNG-BYTES'.length
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    const body = await res.text();
    expect(body).toBe('PNG-BYTES');
    // Sanity: get() was called with the EXACT expected key
    expect(r2.get).toHaveBeenCalledWith(`${TENANT_A}/${TEMPLATE_ID}/issuer-logo.png`);
  });

  it('(5) R2 key matches BUT R2 object is missing → 204 silent', async () => {
    stubTemplate(baseRow);
    const r2 = makeMockR2({}); // empty
    const { app, env } = makeApp(r2);
    const res = await app.request(`/${TEMPLATE_ID}/logo`, {}, env);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(r2.get).toHaveBeenCalledWith(`${TENANT_A}/${TEMPLATE_ID}/issuer-logo.png`);
  });

  it('(6) malformed UUID path → 404 (NEVER 500)', async () => {
    const findSpy = vi.spyOn(templatesDb, 'findPublicTemplateWithTenantById');
    const { app, env } = makeApp(makeMockR2({}));
    const res = await app.request('/abc/logo', {}, env);
    expect(res.status).toBe(404);
    // Critical: DB MUST NOT be reached when zod blocks
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('(7) tenant_id is NULL → fail-closed 204 (defensive)', async () => {
    // Hypothetical: a corrupted row with NULL tenant_id. DB schema normally
    // has NOT NULL, but defensively handle the failure mode.
    const corruptedRow = {
      ...baseRow,
      tenant_id: null as unknown as string, // bypass TS for the test scenario
    };
    stubTemplate(corruptedRow);
    const { app, env } = makeApp(makeMockR2({}));
    const res = await app.request(`/${TEMPLATE_ID}/logo`, {}, env);
    // buildImageKey('') would produce '${baseRow.logText}/.../issuer-logo.png'
    // which doesn't equal `${TENANT_A}/.../issuer-logo.png` → silent 204.
    expect(res.status).toBe(204);
  });
});