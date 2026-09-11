/**
 * PATCH /api/cards/:id/touch — Reset draft TTL to now() + 24h.
 *
 * Called by the frontend auto-save to keep active drafts alive.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { NotFoundError } from '@/shared/lib/saomeError';
import { touchTemplateService } from '../services/cardService';

export const touchCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .patch('/:id/touch', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);
    const templateId = c.req.param('id');

    // Trust JWT tenantId directly — per decision 2026-09-09-jwt-tenant-id-trust.md
    if (!user.tenantId) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }
    const tenantId = user.tenantId;

    const result = await touchTemplateService(sql, templateId, tenantId);
    return c.json(result);
  });

export default touchCardRoute;
