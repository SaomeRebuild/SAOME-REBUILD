/**
 * PATCH /api/cards/:id/abandon — Mark a draft template as abandoned.
 * The draft remains in the DB (for pg_cron TTL cleanup), but is excluded
 * from "resume draft" queries and the draft grid.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTenantByOwnerId } from '@/modules/auth/db/tenants';
import { NotFoundError } from '@/shared/lib/saomeError';
import { findTemplateById, updateTemplate } from '../db/templates';

export const abandonCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .patch('/:id/abandon', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = getDb(c.env.HYPERDRIVE);
    const templateId = c.req.param('id');

    const tenant = await findTenantByOwnerId(sql, user.id);
    if (!tenant) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }

    const existing = await findTemplateById(sql, templateId);
    if (!existing || existing.tenant_id !== tenant.id) {
      throw new NotFoundError('common.error.notFound', 'Template not found');
    }

    if (existing.status !== 'draft') {
      // Can only abandon draft templates
      return c.json({ error: 'Only draft templates can be abandoned' }, 400);
    }

    const updated = await updateTemplate(sql, templateId, { status: 'abandoned' });
    return c.json({ success: true, template: updated });
  });

export default abandonCardRoute;
