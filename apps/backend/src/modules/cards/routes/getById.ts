/**
 * GET /api/cards/:id — Get a single template by ID.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { NotFoundError } from '@/shared/lib/saomeError';
import { getTemplateService } from '../services/cardService';

export const getCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .get('/:id', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);
    const templateId = c.req.param('id');

    console.log('[getCard] fetching template:', templateId, 'for user:', user.id);

    // Trust JWT tenantId directly — per decision 2026-09-09-jwt-tenant-id-trust.md
    if (!user.tenantId) {
      console.log('[getCard] tenant not found for user:', user.id);
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }
    const tenantId = user.tenantId;

    const result = await getTemplateService(sql, templateId, tenantId);
    console.log('[getCard] template found:', result.template?.id);
    return c.json(result);
  });

export default getCardRoute;
