/**
 * PUT /api/cards/:id — Update a template.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { ValidationError, NotFoundError } from '@/shared/lib/saomeError';
import { updateTemplateSchema } from '../schemas/request';
import { updateTemplateService } from '../services/cardService';

export const updateCardRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .put('/:id', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);
    const templateId = c.req.param('id');

    // Trust JWT tenantId directly — per decision 2026-09-09-jwt-tenant-id-trust.md
    if (!user.tenantId) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }
    const tenantId = user.tenantId;

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
      tenantId,
      name,
      cardType,
      settings,
      status,
    );

    return c.json(result);
  });

export default updateCardRoute;
