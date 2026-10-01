/**
 * POST /api/pass-templates/:id/register
 *
 * Public, NO AUTH REQUIRED. Idempotent on (template_id, email).
 *
 * v2 (2026-09-29): NO status filter on the template existence check — any
 * template is reachable by UUID. See Decision Log § 拿掉的決策.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { ValidationError } from '@/shared/lib/saomeError';
import { registerService } from '../services/registerService';
import { passHolderRegisterPayloadSchema } from '../schemas/request';

export const registerRoute = new Hono<HonoEnv>().post('/:id/register', async (c) => {
  const sql = await getDbForRequest(c);
  const templateId = c.req.param('id');

  // zod parse — fail with 400 + i18n key on validation failure.
  const body = await c.req.json().catch(() => ({}));
  const parsed = passHolderRegisterPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      i18nKey: i.message,
    }));
    throw new ValidationError(issues[0]?.i18nKey ?? 'common.error.validationFailed', {
      issues,
    });
  }

  const result = await registerService(sql, templateId, parsed.data);
  return c.json(result, 200);
});

export default registerRoute;