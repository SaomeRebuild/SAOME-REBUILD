/**
 * DELETE /api/cards/:id — Delete a template.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { NotFoundError } from '@/shared/lib/saomeError';
import { deleteTemplateService } from '../services/cardService';

export const deleteCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .delete('/:id', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);
    const templateId = c.req.param('id');

    // Trust JWT tenantId directly — per decision 2026-09-09-jwt-tenant-id-trust.md
    if (!user.tenantId) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }
    const tenantId = user.tenantId;

    const result = await deleteTemplateService(sql, templateId, tenantId);
    return c.json(result);
  });

export default deleteCardRoute;
