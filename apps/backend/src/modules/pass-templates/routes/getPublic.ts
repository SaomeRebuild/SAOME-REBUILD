/**
 * GET /api/pass-templates/:id/public
 *
 * Public-safe template fetch. NO AUTH REQUIRED.
 *
 * v2 (2026-09-29): NO status filter — any template is reachable by UUID.
 * See `runs/decisions/2026-09-29-pass-templates-public-endpoint.md` § 拿掉的決策.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { NotFoundError } from '@/shared/lib/saomeError';
import { getPublicTemplateService } from '../services/getPublicService';
import type { PublicPassTemplateResponseDto } from '../schemas/response';

/**
 * Path param zod schema. UUID-only — reject malformed input to prevent
 * PostgresError 500s from scanner / bot traffic (Q2 regression 2026-10-01).
 * On failure, route layer maps to 404 (not 400) to avoid leaking valid UUID
 * format to attackers — per Decision 2026-09-29 § Decision 3 (tenant
 * isolation via UUID entropy, not diagnostic).
 */
const paramsSchema = z.object({
  id: z.string().uuid('passHolder.errors.templateNotFound'),
});

export const getPublicRoute = new Hono<HonoEnv>().get('/:id/public', async (c) => {
  // Step 1 — UUID zod parse FIRST (Q2 fix: was raw c.req.param → 500).
  // MUST run before getDbForRequest so that garbage input never triggers
  // a Hyperdrive connection attempt (defense-in-depth — bot traffic
  // can't burn SQL pool slots).
  const parsed = paramsSchema.safeParse({ id: c.req.param('id') });
  if (!parsed.success) {
    throw new NotFoundError('passHolder.errors.templateNotFound');
  }
  const templateId = parsed.data.id;

  const sql = await getDbForRequest(c);

  const template = await getPublicTemplateService(sql, templateId);
  if (!template) {
    throw new NotFoundError('passHolder.errors.templateNotFound', 'Template not found');
  }

  const response: PublicPassTemplateResponseDto = { template };
  return c.json(response, 200);
});

export default getPublicRoute;