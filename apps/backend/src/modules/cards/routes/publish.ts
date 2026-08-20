/**
 * POST /api/cards/:id/publish — Publish a template (change status from draft to published).
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTenantByOwnerId } from '@/modules/auth/db/tenants';
import { NotFoundError } from '@/shared/lib/saomeError';
import { publishTemplateService } from '../services/cardService';

export const publishCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .post('/:id/publish', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = getDb(c.env.HYPERDRIVE);
    const templateId = c.req.param('id');

    // Get tenant ID for the authenticated user
    const tenant = await findTenantByOwnerId(sql, user.id);
    if (!tenant) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }

    const result = await publishTemplateService(sql, templateId, tenant.id);
    return c.json(result);
  });

export default publishCardRoute;
