/**
 * PUT /api/templates/:templateId/stamp-images/:fillCount
 *
 * @module modules/stamp-images/routes/uploadStampImage
 * @description Receives a base64-encoded PNG rendered by the tenant
 * device (CardBuilder Step 3 pre-renders `0.png`; future Scanner fills
 * `1.png`~`15.png`), validates the bytes + cap, and writes them to R2
 * at `tenants/{tenantId}/templates/{templateId}/stamp-{fillCount}.png`.
 *
 * Tenant ownership check:
 *   - The route uses the JWT-trusted `tenantId` (per Decision 2026-09-09).
 *   - A `findTemplateById` lookup verifies the template belongs to the
 *     tenant. This is one DB hit, but it's the LAST line of defense —
 *     bypassed only by a forged JWT (which the auth middleware catches).
 *   - The DB lookup happens AFTER zod parse so a malformed path-param
 *     never triggers a Hyperdrive roundtrip (defense-in-depth, same
 *     pattern as `pass-templates/routes/getPublic.ts`).
 *
 * Auth: `requireAuth` middleware (Bearer JWT). Standard tenant scoping.
 *
 * Failure modes:
 *   - 400 — bad UUID / fillCount out of range / base64 decode fail /
 *           non-PNG bytes / oversize (> 4 MB).
 *   - 401 — missing / invalid / revoked JWT.
 *   - 404 — template not found OR template belongs to a different tenant.
 *   - 502 — R2 PUT failed (mapped to `BadGatewayError` in the service).
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { NotFoundError } from '@/shared/lib/saomeError';
import {
  stampImageParamsSchema,
  uploadStampImageBodySchema,
} from '../schemas/request';
import {
  uploadStampImage,
  ensureTemplateBelongsToTenantOr404,
} from '../services/uploadStampImage';
import { findTemplateById } from '@/modules/cards/db/templates';

export const uploadStampImageRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .put('/:templateId/stamp-images/:fillCount', async (c) => {
    const user = getAuthenticatedUser(c);

    // Step 1 — path-param zod parse FIRST.
    // MUST run before getDbForRequest so that garbage input (e.g. an
    // attacker probing for "string-overflow" path-param values) never
    // triggers a Hyperdrive roundtrip. The fillCount range guard here
    // mirrors the table CHECK constraint; anything outside [0, 15] is
        // rejected at the door.
    const parsedParams = stampImageParamsSchema.safeParse({
      templateId: c.req.param('templateId'),
      fillCount: c.req.param('fillCount'),
    });
    if (!parsedParams.success) {
      // Map path-param errors to 404 (UUID mismatch) — same as the
      // public-template endpoint — so we don't leak UUID-format to
      // probes (Decision 2026-09-29 § Decision 3).
      throw new NotFoundError('common.error.notFound');
    }
    const { templateId, fillCount } = parsedParams.data;

    // Step 2 — tenant scoping.
    // Trust JWT tenantId directly (per Decision 2026-09-09). The
    // `!user.tenantId` branch is defensive — in practice, every
    // authenticated user has a tenantId, but a tenant-less admin
    // account would hit this. Treat as 404 (not 403) so the response
    // is uniform with the "template belongs to another tenant" path.
    if (!user.tenantId) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }
    const tenantId = user.tenantId;

    // Step 3 — template ownership check.
    // The DB row lookup is the LAST line of defense against cross-tenant
    // access. A forged JWT would be caught by `verifyToken` in
    // `requireAuth`; this check exists for defense-in-depth and to
    // return a clear 404 when the template truly doesn't exist.
    const sql = await getDbForRequest(c);
    const template = await findTemplateById(sql, templateId);
    if (!template) {
      throw new NotFoundError('common.error.notFound', 'Template not found');
    }
    // The early-return helper from the service keeps the tenant check
    // in one place — a future refactor (e.g. switching to a JOIN
    // rather than a row fetch) only needs to touch the service.
    ensureTemplateBelongsToTenantOr404(template.tenant_id, tenantId);

    // Step 4 — body zod parse.
    // Reads the JSON body, validates base64 size cap (defense before
    // the service does the expensive decode). The `imageBase64` cap is
    // 8 MB (≈ 6 MB raw), well above the 4 MB raw limit enforced
    // post-decode by `assertRawByteLength`.
    const rawBody = await c.req.json().catch(() => null);
    const parsedBody = uploadStampImageBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      // Surface the zod issues so the frontend can show field-level
      // errors. The `errorHandler` middleware reads this and returns
      // a 400 with `details.issues` populated.
      const issues = parsedBody.error.issues.map((iss) => ({
        path: iss.path.join('.'),
        i18nKey: 'common.error.validationFailed',
      }));
      throw new (await import('@/shared/lib/saomeError')).ValidationError(
        'common.error.validationFailed',
        { issues },
      );
    }
    const body = parsedBody.data;

    // Step 5 — service call (atomic-ish flow).
    // `uploadStampImage` handles decode + magic check + size cap +
    // SHA-256 + pending INSERT + R2 PUT + status flip. Errors map to:
    //   - ValidationError → 400 (bad base64 / non-PNG / oversize)
    //   - BadGatewayError → 502 (R2 PUT failed)
    //   - InternalError   → 500 (row disappeared between INSERT and UPDATE)
    const bucket = c.env.ASSETS;
    const result = await uploadStampImage(sql, bucket, {
      templateId,
      tenantId,
      fillCount,
      imageBase64: body.imageBase64,
    });

    // Step 6 — JSON response.
    // `result` is `UploadStampImageResult` (the service-layer mirror of
    // `UploadStampCardImageResponse`). The frontend's
    // `uploadStampCardImage` validates the response shape defensively
    // (see `apps/frontend/.../uploadStampCardImage.ts::UploadStampCardImageResponse`).
    return c.json(result, 200);
  });

export default uploadStampImageRoute;