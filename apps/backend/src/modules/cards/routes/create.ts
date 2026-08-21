/**
 * POST /api/cards — Create a new template draft.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTenantByOwnerId } from '@/modules/auth/db/tenants';
import { ValidationError, NotFoundError } from '@/shared/lib/saomeError';
import { createTemplateSchema } from '../schemas/request';
import { createTemplateService } from '../services/cardService';

export const createCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .post('/', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = getDb(c.env.HYPERDRIVE);

    // Get tenant ID for the authenticated user
    const tenant = await findTenantByOwnerId(sql, user.id);
    if (!tenant) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }

    // Parse and validate request body
    const body = await c.req.json().catch(() => ({}));
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        i18nKey: i.message,
      }));
      throw new ValidationError(issues[0]?.i18nKey ?? 'common.error.validationFailed', {
        issues,
      });
    }

    const { id, name, cardType, settings } = parsed.data;
    console.log('[createCard] creating template:', { id, name, cardType, tenantId: tenant.id });
    const result = await createTemplateService(
      sql,
      tenant.id,
      cardType,
      name,
      settings,
      id,
    );
    console.log('[createCard] template created:', result.template.id);

    return c.json(result, 201);
  });

export default createCardRoute;
