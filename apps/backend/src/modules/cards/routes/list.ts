/**
 * GET /api/cards — List all templates for the authenticated tenant.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { NotFoundError } from '@/shared/lib/saomeError';
import { listTemplatesService } from '../services/cardService';

export const listCardsRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);

    // Trust JWT tenantId directly — per decision 2026-09-09-jwt-tenant-id-trust.md
    if (!user.tenantId) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }
    const tenantId = user.tenantId;

    const result = await listTemplatesService(sql, tenantId);
    return c.json(result);
  });

export default listCardsRoute;
