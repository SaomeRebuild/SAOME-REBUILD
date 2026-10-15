/**
 * Public R2 image proxy — stamp card images (composed PNG per fillCount).
 *
 * @module modules/pass-templates/routes/getTemplateStampImage
 * @description Public, no-auth proxy for serving the composed stamp-card
 * PNG (e.g. `tenants/{tenantId}/templates/{templateId}/stamp-0.png`).
 *
 * Why this route exists:
 *   - The composed stamp card image is the **strip background** that
 *     Passcreator downloads when pushing a stamp_card / multipass template
 *     (see `passTemplateMapping.ts::images`). Passcreator is a
 *     server-to-server client that has no JWT; it needs a public URL.
 *   - The existing `getTemplateImage.ts` factory covers the
 *     `settings.<field>` R2 keys (`{tenantId}/{templateId}/{type}.png`).
 *     Stamp images live under `tenants/{tenantId}/templates/{templateId}/
 *     stamp-{fillCount}.png` and are tracked in a separate
 *     `template_stamp_card_images` table — the existing audit
 *     (which reads `settings.<imageField>`) does not apply.
 *
 * This route is the stamp-image counterpart: it reads from the
 * dedicated table, validates tenant ownership via the canonical R2
 * key prefix, then streams from R2 with `Content-Type: image/png` and
 * `Cache-Control: public, max-age=31536000, immutable`.
 *
 * Auth: UNAUTHENTICATED. The template UUID is the capability. Tenant
 * isolation is achieved by:
 *   1. UUID zod parse — reject malformed input (404, not 400)
 *   2. Tenant audit — `r2_key` MUST equal
 *      `buildStampImageKey(tenant_id, template_id, fillCount)`;
 *      otherwise silent 204 (fail-closed, no cross-tenant leak)
 *   3. R2 miss — silent 204 (don't leak whether the bucket exists)
 *
 * The route is intentionally a thin wrapper around the audit + R2
 * fetch — there's no service-layer business logic, so we don't add a
 * separate `services/<verb>Service.ts`.
 *
 * Regression history:
 *   - 2026-10-15: introduced. The composed stamp card PNG was being
 *     written to R2 by `apps/backend/src/modules/stamp-images/services/
 *     uploadStampImage.ts` (per the v14 2026-10-13 stamp card pipeline),
 *     but nothing on the Push side read it back. The
 *     `passTemplateMapping.ts` images IIFE only consulted
 *     `settings.backgroundImage`, so Passcreator saw the tenant-uploaded
 *     background (often absent) instead of the composed grid image.
 *     This route closes that gap by exposing the R2 object via a
 *     public proxy that Passcreator (and any other server-to-server
 *     client) can fetch.
 *
 * Decision log: runs/decisions/2026-10-15-stamp-card-push-wiring.md
 *
 * Cross-references:
 *   - apps/backend/src/modules/stamp-images/services/uploadStampImage.ts
 *     (`buildStampImageKey` — the canonical R2 key builder)
 *   - apps/backend/src/modules/stamp-images/db/stampImages.ts
 *     (`findUploadedStampImage` — read by templateId + fillCount)
 *   - apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts
 *     (`r2KeyToPublicUrl` — emits `${r2PublicUrl}/api/pass-templates/
 *     ${templateId}/stamp-image/${fillCount}` for stamp_card / multipass)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { NotFoundError, SaomeError } from '@/shared/lib/saomeError';
import { findStampImageAudit } from '@/modules/stamp-images/db/stampImages';
import { buildStampImageKey } from '@/modules/stamp-images/services/uploadStampImage';

/**
 * Path param zod schema.
 *
 * - `id` — UUID v4; on failure → 404 (NotFoundError), NOT 400.
 *   Mirrors `getTemplateImage.ts` so we don't leak valid-UUID format.
 * - `fillCount` — integer in `[0, STAMP_FILL_CAP]`. On failure →
 *   404 (same defensive shape). The schema pin matches the DB CHECK
 *   constraint on `template_stamp_card_images.fill_count`.
 */
const paramsSchema = z.object({
  id: z.string().uuid('passHolder.errors.templateNotFound'),
  fillCount: z.coerce.number().int().min(0).max(15),
});

/**
 * Create a public R2 image proxy route for the given fillCount.
 *
 * The route is parameterized by `fillCount` (the URL captures it as a
 * constant at mount time via the path segment) — each fillCount gets
 * its own pre-built route export. Mirrors `createGetTemplateImageRoute`
 * where the imageType is the parameter.
 *
 * Returns a Hono sub-app with a single `GET /:id/stamp-image/:fillCount`
 * route. Mount in the pass-templates module via
 * `app.route('/', createGetTemplateStampImageRoute(0))`.
 *
 * Why a factory rather than a single dynamic route:
 *   - The `buildStampImageKey` call needs `fillCount` to construct the
 *     audit key. For a single dynamic route we would still need to
 *     capture fillCount from the URL — which works via the zod parse
 *     below — but the factory shape mirrors the existing
 *     `getTemplateImage.ts` factory, keeping the contract symmetric.
 *   - Future Scanner integration may add per-fillCount read endpoints
 *     (e.g. an `acknowledge-fill` callback); the factory scales to N
 *     routes without changing the audit logic.
 */
export function createGetTemplateStampImageRoute(fillCount: number) {
  return new Hono<HonoEnv>().get('/:id/stamp-image/:fillCount', async (c) => {
    // Step 1 — Path param zod parse (defense-in-depth: must run BEFORE
    // getDbForRequest so bot traffic can't burn SQL pool slots).
    const parsed = paramsSchema.safeParse({
      id: c.req.param('id'),
      fillCount: c.req.param('fillCount'),
    });
    if (!parsed.success) {
      throw new NotFoundError('passHolder.errors.templateNotFound');
    }
    const { id: templateId } = parsed.data;

    const sql = await getDbForRequest(c);

    // Step 2 — Single JOIN query that returns `(tenant_id, r2_key)`
    // together so the audit is atomic. The LEFT JOIN guarantees we
    // get a row even when the stamp image hasn't been uploaded yet
    // (r2Key=null) — a separate `findUploadedStampImage` call would
    // have given us the same null but at two roundtrips.
    const audit = await findStampImageAudit(sql, templateId, fillCount);
    if (!audit) {
      // No template row → silent 204 (don't leak existence).
      return c.body(null, 204);
    }
    const { tenantId, r2Key } = audit;

    // Step 3 — Tenant audit + key check.
    //
    // Defensive: tenant_id NULL means a corrupted template row;
    // treat the same as a missing image (silent 204).
    if (!tenantId || !r2Key) {
      return c.body(null, 204);
    }
    const expectedKey = buildStampImageKey(tenantId, templateId, fillCount);
    if (r2Key !== expectedKey) {
      // Cross-tenant probing attempt or corrupted row → silent 204.
      return c.body(null, 204);
    }

    // Step 4 — Fetch from R2; miss → silent 204.
    const bucket = c.env.ASSETS;
    let object;
    try {
      object = await bucket.get(expectedKey);
    } catch (err) {
      console.error(`[getTemplateStampImage:${fillCount}] R2 get error:`, err);
      throw new SaomeError({
        status: 500,
        code: 'INTERNAL_ERROR',
        i18nKey: 'common.error.internalError',
        message: String(err),
        details: { detail: String(err) },
      });
    }
    if (!object) {
      return c.body(null, 204);
    }

    // Step 5 — Stream with immutable cache. Mirrors the existing
    // getTemplateImage behavior — composed stamp PNGs are immutable
    // post-upload (re-uploads overwrite, never append).
    const contentType = object.httpMetadata?.contentType ?? 'image/png';
    c.header('Content-Type', contentType);
    c.header('Content-Length', String(object.size ?? ''));
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    return c.body(object.body);
  });
}

/**
 * Pre-built routes for each fillCount in `[0, STAMP_FILL_CAP]`.
 *
 * Mounted in the pass-templates module at `/:id/stamp-image/{fillCount}`.
 * Only `fillCount=0` is wired through to the Passcreator push
 * pipeline today (the empty / no-stamps-yet state); the rest are
 * reserved for the Scanner's incremental writes (Plan Phase 3,
 * deferred).
 *
 * If the cap (`STAMP_FILL_CAP = 15`) ever increases, this list grows
 * to match — keeping the route surface symmetric with the DB CHECK
 * constraint on `template_stamp_card_images.fill_count`.
 */
export const getStampImage0Route = createGetTemplateStampImageRoute(0);
export const getStampImage1Route = createGetTemplateStampImageRoute(1);
export const getStampImage2Route = createGetTemplateStampImageRoute(2);
export const getStampImage3Route = createGetTemplateStampImageRoute(3);
export const getStampImage4Route = createGetTemplateStampImageRoute(4);
export const getStampImage5Route = createGetTemplateStampImageRoute(5);
export const getStampImage6Route = createGetTemplateStampImageRoute(6);
export const getStampImage7Route = createGetTemplateStampImageRoute(7);
export const getStampImage8Route = createGetTemplateStampImageRoute(8);
export const getStampImage9Route = createGetTemplateStampImageRoute(9);
export const getStampImage10Route = createGetTemplateStampImageRoute(10);
export const getStampImage11Route = createGetTemplateStampImageRoute(11);
export const getStampImage12Route = createGetTemplateStampImageRoute(12);
export const getStampImage13Route = createGetTemplateStampImageRoute(13);
export const getStampImage14Route = createGetTemplateStampImageRoute(14);
export const getStampImage15Route = createGetTemplateStampImageRoute(15);