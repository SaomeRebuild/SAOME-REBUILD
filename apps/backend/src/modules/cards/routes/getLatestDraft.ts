/**
 * GET /api/cards/drafts — Get the most recent draft for the authenticated tenant.
 * Used by "從頭建置" to check if a resume-worthy draft exists.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { NotFoundError } from '@/shared/lib/saomeError';
import { findLatestDraftByTenant } from '../db/templates';

export const getLatestDraftRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .get('/drafts', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);

    // Trust JWT tenantId directly — per decision 2026-09-09-jwt-tenant-id-trust.md
    if (!user.tenantId) {
      console.log('[getLatestDraft] tenant not found for user:', user.id);
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }
    const tenantId = user.tenantId;

    console.log('[getLatestDraft] fetching draft for tenant:', tenantId);
    const draft = await findLatestDraftByTenant(sql, tenantId);
    console.log('[getLatestDraft] draft found:', draft?.id ?? null);
    return c.json({ draft });
  });

export default getLatestDraftRoute;
