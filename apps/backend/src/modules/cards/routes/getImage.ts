/**
 * GET /api/cards/:id/image/:type — Serve a card template image from R2.
 *
 * This is the public read path for logo/background/icon images stored in R2.
 * The frontend calls this endpoint to display uploaded images.
 *
 * Auth: supports both Authorization header and ?token= query param
 * (query param is required for <img> requests which don't send cookies).
 *
 * @example GET /api/cards/{id}/image/logo → R2 object bytes
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTenantByOwnerId } from '@/modules/auth/db/tenants';
import { findTemplateById } from '../db/templates';
import { NotFoundError, SaomeError } from '@/shared/lib/saomeError';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['logo', 'background', 'icon']),
});

export const getImageRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .get('/:id/image/:type', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = getDb(c.env.HYPERDRIVE);
    const { id: templateId, type: imageType } = c.req.param();

    // Validate params
    const parsed = paramsSchema.safeParse({ id: templateId, type: imageType });
    if (!parsed.success) {
      throw new NotFoundError('common.error.notFound');
    }

    // Verify template ownership
    const template = await findTemplateById(sql, templateId);
    if (!template) {
      throw new NotFoundError('common.error.notFound');
    }

    const tenant = await findTenantByOwnerId(sql, user.id);
    if (!tenant) {
      throw new NotFoundError('common.error.notFound');
    }

    if (template.tenant_id !== tenant.id) {
      console.log('[getImage] OWNERSHIP CHECK FAIL:', {
        templateTenantId: template.tenant_id,
        currentTenantId: tenant.id,
        match: template.tenant_id === tenant.id,
      });
      throw new NotFoundError('common.error.notFound');
    }

    // Read the R2 key directly from template.settings — this avoids key reconstruction
    // mismatches if the tenantId used during upload differs from the current tenantId.
    type ImageKey = 'issuerLogo' | 'backgroundImage' | 'iconImage';
    const fieldMap: Record<string, ImageKey> = {
      logo: 'issuerLogo',
      background: 'backgroundImage',
      icon: 'iconImage',
    };
    const field = fieldMap[imageType];

    // Defensive: settings can be a string (malformed DB row) or object (correct)
    let settings: Record<string, unknown>;
    const rawSettings = template.settings;
    if (typeof rawSettings === 'string') {
      settings = JSON.parse(rawSettings);
    } else if (rawSettings && typeof rawSettings === 'object') {
      settings = rawSettings;
    } else {
      settings = {};
    }

    console.log('[getImage] templateId:', templateId);
    console.log('[getImage] tenantId:', tenant.id);
    console.log('[getImage] template.tenant_id:', template.tenant_id);
    console.log('[getImage] settings keys:', Object.keys(settings));
    console.log('[getImage] imageType:', imageType, '→ field:', field);
    const r2Key: string | undefined = settings[field] as string | undefined;
    console.log('[getImage] r2Key:', r2Key);

    if (!r2Key) {
      // Return a diagnostic response so the browser DevTools can reveal the root cause
      return c.json({
        debug: {
          templateId,
          tenantId: tenant.id,
          templateTenantId: template.tenant_id,
          field,
          settingsKeys: Object.keys(settings),
          r2Key,
          message: 'issuerLogo not found in template.settings',
        }
      }, 200);
    }

    // Get image from R2
    const bucket = c.env.ASSETS;
    let object;
    try {
      object = await bucket.get(r2Key);
    } catch (err) {
      console.error('[getImage] R2 get error:', err);
      throw new SaomeError({
        status: 500,
        code: 'INTERNAL_ERROR',
        i18nKey: 'common.error.internalError',
        message: String(err),
        details: { detail: String(err) },
      });
    }

    if (!object) {
      // Return 204 with empty body so the browser shows a blank image instead of an error
      return c.body(null, 204);
    }

    // Determine content type from object metadata, default to image/png
    const contentType = (object.httpMetadata?.contentType) ?? 'image/png';

    console.log('[getImage] R2 object found, contentType:', contentType, 'size:', object.size);

    // R2 get() returns a ReadableStream — Hono c.body() handles ReadableStream natively
    c.header('Content-Type', contentType);
    c.header('Content-Length', String(object.size ?? ''));
    c.header('Cache-Control', 'public, max-age=31536000, immutable');

    return c.body(object.body);
  });

export default getImageRoute;
