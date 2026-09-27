/**
 * GET /api/cards/:id/table-card/download — Stream the latest table-card PNG.
 *
 * Reads `settings.tableCard.exportKey` from the template, fetches the
 * R2 object, and streams it back with `Content-Disposition: attachment`
 * so the browser triggers a file download instead of rendering inline.
 *
 * If the template has never been exported (`exportKey` undefined),
 * returns 404 with a stable error code so the frontend can surface
 * "請先生成桌牌" instead of a generic 404.
 *
 * Auth: requireAuth + tenantId ownership check.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTemplateById } from '../db/templates';
import { NotFoundError, SaomeError } from '@/shared/lib/saomeError';

export const downloadTableCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .get('/:id/table-card/download', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);
    const templateId = c.req.param('id');

    if (!user.tenantId) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }
    const tenantId = user.tenantId;

    // Ownership check + fetch settings
    const template = await findTemplateById(sql, templateId);
    if (!template || template.tenant_id !== tenantId) {
      throw new NotFoundError('common.error.notFound', 'Template not found');
    }

    // Defensive unwrap of corrupted JSONB (Bug #8 + Bug #8.5 pattern from getImage)
    function unwrapSettings(raw: unknown): Record<string, any> {
      if (raw == null) return {};
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return {}; }
      }
      if (Array.isArray(raw)) {
        return raw.reduce<Record<string, any>>((acc, e) => ({ ...acc, ...unwrapSettings(e) }), {});
      }
      if (typeof raw === 'object') return raw as Record<string, any>;
      return {};
    }

    const settings = unwrapSettings(template.settings);
    const tableCard = settings.tableCard as { exportKey?: string } | undefined;
    const exportKey = tableCard?.exportKey;

    if (!exportKey) {
      throw new NotFoundError('common.error.notFound', 'Table card has not been exported yet');
    }

    // Fetch from R2
    const bucket = c.env.ASSETS;
    let object;
    try {
      object = await bucket.get(exportKey);
    } catch (err) {
      console.error('[downloadTableCard] R2 get error:', err);
      throw new SaomeError({
        status: 500,
        code: 'INTERNAL_ERROR',
        i18nKey: 'common.error.internalError',
        message: String(err),
      });
    }

    if (!object) {
      throw new NotFoundError('common.error.notFound', 'Exported PNG not found in R2');
    }

    const contentType = object.httpMetadata?.contentType ?? 'image/png';
    c.header('Content-Type', contentType);
    c.header('Content-Length', String(object.size ?? ''));
    c.header('Content-Disposition', 'attachment; filename="table-card.png"');
    c.header('Cache-Control', 'no-store'); // never cache — always re-fetch latest

    return c.body(object.body);
  });

export default downloadTableCardRoute;
