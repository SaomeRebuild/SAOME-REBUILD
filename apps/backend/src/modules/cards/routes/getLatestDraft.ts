/**
 * GET /api/cards/drafts — Get the most recent draft for the authenticated tenant.
 * Used by "從頭建置" to check if a resume-worthy draft exists.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTenantByOwnerId } from '@/modules/auth/db/tenants';
import { NotFoundError } from '@/shared/lib/saomeError';
import { findLatestDraftByTenant } from '../db/templates';

export const getLatestDraftRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .get('/drafts', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = getDb(c.env.HYPERDRIVE);

    const tenant = await findTenantByOwnerId(sql, user.id);
    if (!tenant) {
      console.log('[getLatestDraft] tenant not found for user:', user.id);
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }

    console.log('[getLatestDraft] fetching draft for tenant:', tenant.id);
    const draft = await findLatestDraftByTenant(sql, tenant.id);
    console.log('[getLatestDraft] draft found:', draft?.id ?? null);
    return c.json({ draft });
  });

export default getLatestDraftRoute;
