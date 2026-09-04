/**
 * PUT /api/cards/:id — Update a template.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTenantByOwnerId } from '@/modules/auth/db/tenants';
import { ValidationError, NotFoundError } from '@/shared/lib/saomeError';
import { updateTemplateSchema } from '../schemas/request';
import { updateTemplateService } from '../services/cardService';

export const updateCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .put('/:id', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDb(c.env.HYPERDRIVE);
    const templateId = c.req.param('id');

    // Get tenant ID for the authenticated user
    const tenant = await findTenantByOwnerId(sql, user.id);
    if (!tenant) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }

    // Parse and validate request body
    const body = await c.req.json().catch(() => ({}));
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        i18nKey: i.message,
      }));
      throw new ValidationError(issues[0]?.i18nKey ?? 'common.error.validationFailed', {
        issues,
      });
    }

    const { name, cardType, settings, status } = parsed.data;
    const result = await updateTemplateService(
      sql,
      templateId,
      tenant.id,
      name,
      cardType,
      settings,
      status,
    );

    return c.json(result);
  });

export default updateCardRoute;
