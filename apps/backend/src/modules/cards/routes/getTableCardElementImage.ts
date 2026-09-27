/**
 * GET /api/cards/:id/table-card/element/image/:elementId — Serve a
 * table-card image element PNG from R2.
 *
 * Mirrors the role of `getImage.ts` (which serves logo / background /
 * icon / table-card-export), but for individual table-card elements
 * (text labels, decorative images, etc.) whose R2 keys live at
 * `{tenant_id}/{template_id}/table-card/{element_id}.png`.
 *
 * This route exists because the `publicUrl` returned by
 * `tableCardElementUploadUrlRoute` points at this exact pattern —
 * the frontend's Konva canvas needs to fetch the rendered image back
 * after the user uploads it, otherwise it stays as a placeholder.
 *
 * Auth: `requireAuth` falls back to `?token=` query param so that
 * `<img src>` / Konva `useImage` can load it (browsers don't send
 * Authorization headers on `<img>` requests).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTemplateById } from '../db/templates';
import { NotFoundError, SaomeError } from '@/shared/lib/saomeError';

const paramsSchema = z.object({
  id: z.string().uuid(),
  elementId: z.string().uuid(),
});

/** R2 key builder — mirrors `tableCardElementUploadUrlRoute::key`. */
function buildTableCardElementKey(
  tenantId: string,
  templateId: string,
  elementId: string,
): string {
  return `${tenantId}/${templateId}/table-card/${elementId}.png`;
}

export const getTableCardElementImageRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .get('/:id/table-card/element/image/:elementId', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);

    const parsed = paramsSchema.safeParse(c.req.param());
    if (!parsed.success) {
      throw new NotFoundError('common.error.notFound');
    }
    const { id: templateId, elementId } = parsed.data;

    if (!user.tenantId) {
      throw new NotFoundError('common.error.notFound');
    }
    const tenantId = user.tenantId;

    // Ownership check (same as other routes in this module).
    const template = await findTemplateById(sql, templateId);
    if (!template || template.tenant_id !== tenantId) {
      throw new NotFoundError('common.error.notFound');
    }

    const key = buildTableCardElementKey(tenantId, templateId, elementId);

    const bucket = c.env.ASSETS;
    let object;
    try {
      object = await bucket.get(key);
    } catch (err) {
      console.error('[getTableCardElementImage] R2 get error:', err);
      throw new SaomeError({
        status: 500,
        code: 'INTERNAL_ERROR',
        i18nKey: 'common.error.internalError',
        message: String(err),
      });
    }

    // 204 empty body so the browser shows a blank placeholder instead of a
    // broken-image icon when an element id has no R2 object yet (e.g.
    // upload in-flight or stale reference).
    if (!object) {
      return c.body(null, 204);
    }

    const contentType = object.httpMetadata?.contentType ?? 'image/png';
    c.header('Content-Type', contentType);
    c.header('Content-Length', String(object.size ?? ''));
    // Long cache — the object key includes a unique UUID element id so
    // re-uploads land on a new key. Existing elements are immutable.
    c.header('Cache-Control', 'public, max-age=31536000');
    return c.body(object.body);
  });

export default getTableCardElementImageRoute;