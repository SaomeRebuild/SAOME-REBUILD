/**
 * GET /api/cards/:id — Get a single template by ID.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTenantByOwnerId } from '@/modules/auth/db/tenants';
import { NotFoundError } from '@/shared/lib/saomeError';
import { getTemplateService } from '../services/cardService';

export const getCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .get('/:id', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = getDb(c.env.HYPERDRIVE);
    const templateId = c.req.param('id');

    console.log('[getCard] fetching template:', templateId, 'for user:', user.id);

    const tenant = await findTenantByOwnerId(sql, user.id);
    if (!tenant) {
      console.log('[getCard] tenant not found for user:', user.id);
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }

    const result = await getTemplateService(sql, templateId, tenant.id);
    console.log('[getCard] template found:', result.template?.id);
    return c.json(result);
  });

export default getCardRoute;
