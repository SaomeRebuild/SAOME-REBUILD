/**
 * GET /api/cards — List all templates for the authenticated tenant.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTenantByOwnerId } from '@/modules/auth/db/tenants';
import { NotFoundError } from '@/shared/lib/saomeError';
import { listTemplatesService } from '../services/cardService';

export const listCardsRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = getDb(c.env.HYPERDRIVE);

    // Get tenant ID for the authenticated user
    const tenant = await findTenantByOwnerId(sql, user.id);
    if (!tenant) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }

    const result = await listTemplatesService(sql, tenant.id);
    return c.json(result);
  });

export default listCardsRoute;
