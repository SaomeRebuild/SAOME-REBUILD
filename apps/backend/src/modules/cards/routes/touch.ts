/**
 * PATCH /api/cards/:id/touch — Reset draft TTL to now() + 24h.
 *
 * Called by the frontend auto-save to keep active drafts alive.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTenantByOwnerId } from '@/modules/auth/db/tenants';
import { NotFoundError } from '@/shared/lib/saomeError';
import { touchTemplateService } from '../services/cardService';

export const touchCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .patch('/:id/touch', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = getDb(c.env.HYPERDRIVE);
    const templateId = c.req.param('id');

    // Get tenant ID for the authenticated user
    const tenant = await findTenantByOwnerId(sql, user.id);
    if (!tenant) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }

    const result = await touchTemplateService(sql, templateId, tenant.id);
    return c.json(result);
  });

export default touchCardRoute;
