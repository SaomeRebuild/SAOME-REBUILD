/**
 * POST /api/cards/:id/table-card/element/upload-url — Generate a pre-signed URL
 *   for direct R2 upload of a table-card image element.
 *
 * Mirrors `generate-upload-url.ts` but for the table-card image element
 * case (imageType = 'table_card_element').
 *
 * R2 key pattern: `{tenant_id}/{template_id}/table-card/{element_id}.png`.
 *
 * The elementId is provided in the request body (frontend generates it
 * via crypto.randomUUID() at element creation time) so the frontend can
 * set `settings.tableCard.elements[i].imageKey` BEFORE the actual upload
 * completes — no second round-trip needed.
 *
 * Round 3 Fix 6 — accept the actual `contentType` from the request body
 * and bake it into the signed PUT URL. The previous hard-coded
 * `Content-Type: image/png` caused JPG uploads to fail with a signature
 * mismatch (R2 returns 403 / SignatureDoesNotMatch), and the subsequent
 * GET on the element returned 204 → CanvasImage's `useImage` saw
 * `status === 'loading'` forever, leaving the canvas with a blank
 * placeholder Rect. PNG-only would have worked but table-card logos
 * frequently arrive as JPG from photographers, so we accept both.
 *
 * Auth: requireAuth + tenantId ownership check.
 */

import { Hono } from 'hono';
import { AwsClient } from 'aws4fetch';
import { z } from 'zod';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTemplateById } from '../db/templates';
import { NotFoundError, ValidationError } from '@/shared/lib/saomeError';

const UPLOAD_URL_TTL_SECONDS = 3600;
const R2_BUCKET_NAME = 'saome';

const requestSchema = z.object({
  elementId: z.string().uuid(),
  // Round 3 Fix 6 — accept the actual file MIME type so the signed
  // PUT URL matches what the frontend will send. The frontend
  // Inspector currently accepts image/png + image/jpeg.
  contentType: z.enum(['image/png', 'image/jpeg']),
});

export const tableCardElementUploadUrlRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .post('/:id/table-card/element/upload-url', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);
    const templateId = c.req.param('id');

    if (!user.tenantId) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }
    const tenantId = user.tenantId;

    // Parse and validate request body
    const body = await c.req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('common.error.validationFailed', {
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          i18nKey: i.message,
        })),
      });
    }

    // Ownership check
    const template = await findTemplateById(sql, templateId);
    if (!template || template.tenant_id !== tenantId) {
      throw new NotFoundError('common.error.notFound', 'Template not found');
    }

    const { elementId, contentType } = parsed.data;
    const key = `${tenantId}/${templateId}/table-card/${elementId}.png`;

    // Create AWS client for R2 (S3-compatible API)
    const r2Client = new AwsClient({
      accessKeyId: c.env.R2_ACCESS_KEY_ID,
      secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    });

    const r2Endpoint = `https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;
    const signedRequest = await r2Client.sign(
      new Request(r2Endpoint, {
        method: 'PUT',
        // Round 3 Fix 6 — sign with the actual file's MIME type. The
        // frontend MUST send the same `Content-Type` header on its
        // subsequent PUT or R2 will reject with SignatureDoesNotMatch.
        headers: { 'Content-Type': contentType },
      }),
      { aws: { signQuery: true } },
    );

    return c.json({
      uploadUrl: signedRequest.url,
      key,
      // Route mounted at GET /api/cards/:id/table-card/element/image/:elementId
      // (see getTableCardElementImageRoute). Same-origin in dev via the
      // Vite /api proxy; prod hits saome-backend directly.
      publicUrl: `${c.env.R2_PUBLIC_URL ?? 'https://saome-backend.josh1989213.workers.dev'}/api/cards/${templateId}/table-card/element/image/${elementId}`,
    });
  });

export default tableCardElementUploadUrlRoute;
