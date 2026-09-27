/**
 * POST /api/cards/:id/table-card/export — Upload a rasterized table-card PNG to R2.
 *
 * Frontend rasterizes the Konva canvas client-side via
 * `stage.toDataURL({ pixelRatio: 3 })`, converts to Blob, and POSTs it
 * here as multipart/form-data. The backend writes it to R2 and updates
 * the JSONB pointer (`settings.tableCard.exportKey` +
 * `settings.tableCard.lastExportedAt`).
 *
 * R2 key (single-key-per-template): `{tenant_id}/{template_id}/table-card-export.png`.
 * The key is overwritten on each export — only the latest snapshot is
 * retained. If versioned PNG history is needed later, switch to a
 * `{timestamp}` sub-directory.
 *
 * IMPORTANT: This endpoint intentionally does NOT regenerate the PNG.
 * Frontend Konva canvas → toDataURL is faster than workerd canvas
 * (workerd has no Canvas API; would need node-canvas shim). And it
 * avoids round-tripping a multi-MB blob through the Worker.
 *
 * Auth: requireAuth + tenantId ownership check (Rule 036 3 層 CORS
 * + standard tenant scoping).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTemplateById } from '../db/templates';
import { NotFoundError, ValidationError, SaomeError } from '@/shared/lib/saomeError';

/** Table card export R2 key builder. */
function buildTableCardExportKey(tenantId: string, templateId: string): string {
  return `${tenantId}/${templateId}/table-card-export.png`;
}

export const exportTableCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .post('/:id/table-card/export', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);
    const templateId = c.req.param('id');

    if (!user.tenantId) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }
    const tenantId = user.tenantId;

    // Ownership check
    const template = await findTemplateById(sql, templateId);
    if (!template || template.tenant_id !== tenantId) {
      throw new NotFoundError('common.error.notFound', 'Template not found');
    }

    // Parse multipart/form-data; expect single 'image' field with PNG Blob.
    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      throw new ValidationError('common.error.validationFailed', {
        issues: [{ path: 'image', i18nKey: 'common.error.validationFailed' }],
      });
    }
    const imageFile = formData.get('image');
    // FormData.get() returns FormDataEntryValue (string | File). Use type guard
    // (not instanceof File) because workerd's File global is a distinct
    // constructor from the one declared by lib.dom — instanceof would fail
    // at runtime even though both represent the same browser File type.
    if (typeof imageFile === 'string' || !imageFile || typeof (imageFile as Blob).arrayBuffer !== 'function') {
      throw new ValidationError('common.error.validationFailed', {
        issues: [{ path: 'image', i18nKey: 'common.error.validationFailed' }],
      });
    }
    const file = imageFile as File;

    // Validate content type and size (PNG, ≤ 10 MB to be defensive — Konva at
    // 2551×3579 produces ~3-5 MB on typical designs).
    if (file.type !== 'image/png') {
      throw new ValidationError('common.error.validationFailed', {
        issues: [{ path: 'image', i18nKey: 'common.error.validationFailed' }],
      });
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new ValidationError('common.error.validationFailed', {
        issues: [{ path: 'image', i18nKey: 'common.error.validationFailed' }],
      });
    }

    const key = buildTableCardExportKey(tenantId, templateId);

    // Upload to R2
    const bucket = c.env.ASSETS;
    try {
      await bucket.put(key, file.stream(), {
        httpMetadata: { contentType: 'image/png' },
      });
    } catch (err) {
      console.error('[exportTableCard] R2 put error:', err);
      throw new SaomeError({
        status: 500,
        code: 'INTERNAL_ERROR',
        i18nKey: 'common.error.internalError',
        message: String(err),
      });
    }

    // Update JSONB pointer + timestamp (Rule 030 stale-detection source of truth).
    // Uses SQL `||` merge so other settings are untouched.
    const lastExportedAt = new Date().toISOString();
    try {
      await sql`
        UPDATE templates
           SET settings = CASE jsonb_typeof(settings)
                       WHEN 'object' THEN settings
                       WHEN 'array'  THEN (
                         CASE jsonb_typeof(settings -> -1)
                           WHEN 'string' THEN ((settings -> -1) #>> '{}')::jsonb
                           WHEN 'object' THEN (settings -> -1)
                           ELSE '{}'::jsonb
                         END
                       )
                       WHEN 'string' THEN (settings #>> '{}')::jsonb
                       ELSE settings
                     END
                     || ${sql.json({
                       tableCard: {
                         ...((template.settings as any)?.tableCard ?? {}),
                         exportKey: key,
                         lastExportedAt,
                       },
                     })}
         WHERE id = ${templateId}
      `;
    } catch (err) {
      console.error('[exportTableCard] DB update error:', err);
      throw new SaomeError({
        status: 500,
        code: 'INTERNAL_ERROR',
        i18nKey: 'common.error.internalError',
        message: String(err),
      });
    }

    // Public read URL (frontend constructs from env-configured R2 public base)
    const R2_PUBLIC_URL = c.env.R2_PUBLIC_URL ?? `https://saome-backend.josh1989213.workers.dev`;
    return c.json({
      exportKey: key,
      publicUrl: `${R2_PUBLIC_URL}/api/cards/${templateId}/image/table-card-export`,
      lastExportedAt,
    });
  });

export default exportTableCardRoute;
