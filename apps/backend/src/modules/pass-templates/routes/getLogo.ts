/**
 * GET /api/pass-templates/:id/logo — Serve the public issuer logo from R2.
 *
 * @module modules/pass-templates/routes/getLogo
 *
 * UNAUTHENTICATED. The only protection is:
 *   (1) UUID zod parse — reject malformed input (404, mapped from NotFoundError)
 *   (2) Tenant audit — `buildImageKey(row.tenant_id, row.id, 'logo')` must
 *       equal `settings.issuerLogo`; otherwise silent 204 (fail-closed,
 *       don't leak cross-tenant attempts)
 *   (3) R2 miss — silent 204 (don't leak whether the bucket exists)
 *
 * No JWT verify — this is a public endpoint. The template UUID is the
 * capability. Tenant isolation is achieved by checking that the R2 key
 * recorded in `settings.issuerLogo` matches the key we'd build for this
 * tenant's template.
 *
 * Cache header is `public, max-age=31536000, immutable` — mirrors
 * `apps/backend/src/modules/cards/routes/getImage.ts`. Logos are
 * considered immutable post-upload (per dashboard convention).
 *
 * Decision log: runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md
 * § 選項 2 (R2 multi-tenant audit) + § 選項 3 (Cache header).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { buildImageKey } from '@saome/shared/constants/card-images';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { getPublicTemplateWithTenantService } from '../services/getPublicService';
import { NotFoundError, SaomeError } from '@/shared/lib/saomeError';

/**
 * Path param zod schema. UUID-only — same shape as `getPublic` route.
 * On failure → 404 (NotFoundError), NOT 400 — to avoid leaking valid UUID
 * format to attackers (per Decision 2026-09-29 § Decision 3 tenant
 * isolation via UUID entropy, not diagnostic).
 */
const paramsSchema = z.object({
  id: z.string().uuid('passHolder.errors.templateNotFound'),
});

export const getLogoRoute = new Hono<HonoEnv>().get('/:id/logo', async (c) => {
  // Step 1 — UUID zod parse (defense-in-depth: must run BEFORE getDbForRequest
  // so bot traffic can't burn SQL pool slots).
  const parsed = paramsSchema.safeParse({ id: c.req.param('id') });
  if (!parsed.success) {
    throw new NotFoundError('passHolder.errors.templateNotFound');
  }
  const templateId = parsed.data.id;

  const sql = await getDbForRequest(c);

  // Step 2 — Lookup with tenant_id (internal use only — never serialized).
  const lookup = await getPublicTemplateWithTenantService(sql, templateId);
  if (!lookup) {
    throw new NotFoundError('passHolder.errors.templateNotFound');
  }
  const { dto, tenantId } = lookup;

  // Step 3 — Multi-tenant audit: rebuild expected R2 key, fail-closed if
  // the recorded key doesn't match. Silent 204 (no diagnostic) so we don't
  // leak cross-tenant probing attempts.
  if (!dto.issuerLogo) {
    return c.body(null, 204);
  }
  const expectedKey = buildImageKey(tenantId, templateId, 'logo');
  if (dto.issuerLogo !== expectedKey) {
    return c.body(null, 204);
  }

  // Step 4 — Fetch from R2; miss → silent 204.
  const bucket = c.env.ASSETS;
  let object;
  try {
    object = await bucket.get(expectedKey);
  } catch (err) {
    console.error('[getLogo] R2 get error:', err);
    throw new SaomeError({
      status: 500,
      code: 'INTERNAL_ERROR',
      i18nKey: 'common.error.internalError',
      message: String(err),
      details: { detail: String(err) },
    });
  }
  if (!object) {
    return c.body(null, 204);
  }

  // Step 5 — Stream with immutable cache (mirrors cards/routes/getImage.ts).
  const contentType = object.httpMetadata?.contentType ?? 'image/png';
  c.header('Content-Type', contentType);
  c.header('Content-Length', String(object.size ?? ''));
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  return c.body(object.body);
});

export default getLogoRoute;
