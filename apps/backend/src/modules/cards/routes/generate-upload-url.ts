/**
 * POST /api/cards/:id/generate-upload-url — Generate a pre-signed URL for direct R2 upload.
 *
 * Flow:
 * 1. Frontend requests a pre-signed URL from this endpoint
 * 2. Backend verifies template ownership and generates a pre-signed PUT URL
 * 3. Frontend uploads the cropped image directly to R2 using the pre-signed URL
 * 4. Frontend calls PUT /api/cards/:id with issuerLogo set to the R2 key
 *
 * This avoids streaming large images through the Worker.
 *
 * Public read URL construction:
 * The R2 key is stored in the template settings. The frontend constructs the public
 * URL based on environment config (e.g., for production:
 * https://saome-assets.pages.dev/{tenantId}/{templateId}/issuer-logo.png)
 */

import { Hono } from 'hono';
import { AwsClient } from 'aws4fetch';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTenantByOwnerId } from '@/modules/auth/db/tenants';
import { findTemplateById } from '../db/templates';
import { NotFoundError, ValidationError } from '@/shared/lib/saomeError';
import { z } from 'zod';
import { buildImageKey, type CardImageType, CARD_IMAGE_KEYS } from '@saome/shared/constants/card-images';

/** 1 hour = 3600 seconds for pre-signed URL validity */
const UPLOAD_URL_TTL_SECONDS = 3600;

/** R2 bucket name */
const R2_BUCKET_NAME = 'saome';

/** R2 public URL base — used so frontend can display the uploaded image */
const R2_PUBLIC_URL = `https://pub.saome.workers.dev`;

/** Request body schema */
const generateUploadUrlSchema = z.object({
  imageType: z.enum(['logo', 'background', 'icon']),
});

type ImageType = z.infer<typeof generateUploadUrlSchema>['imageType'];

export const generateUploadUrlRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .post('/:id/generate-upload-url', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = getDb(c.env.HYPERDRIVE);
    const templateId = c.req.param('id');

    // Get tenant ID for the authenticated user
    const tenant = await findTenantByOwnerId(sql, user.id);
    if (!tenant) {
      throw new NotFoundError('common.error.notFound', 'Tenant not found');
    }

    // Parse and validate request body
    const body = await c.req.json().catch(() => ({}));
    const parsed = generateUploadUrlSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        i18nKey: i.message,
      }));
      throw new ValidationError(issues[0]?.i18nKey ?? 'common.error.validationFailed', {
        issues,
      });
    }

    // Ownership check: ensure the template belongs to the tenant
    const template = await findTemplateById(sql, templateId);
    if (!template || template.tenant_id !== tenant.id) {
      throw new NotFoundError('common.error.notFound', 'Template not found');
    }

    const { imageType } = parsed.data;

    // Validate imageType is a known CardImageType (defensive: guard against typos)
    if (!CARD_IMAGE_KEYS[imageType as CardImageType]) {
      throw new ValidationError('common.error.validationFailed', {
        issues: [{ path: 'imageType', i18nKey: 'common.error.validationFailed' }],
      });
    }

    // Map frontend imageType string to shared CardImageType
    const cardImageType: CardImageType = imageType as CardImageType;

    // Build the R2 key: {tenant_id}/{template_id}/{image_filename}
    const key = buildImageKey(tenant.id, templateId, cardImageType);

    // Create AWS client for R2 (S3-compatible API)
    const r2Client = new AwsClient({
      accessKeyId: c.env.R2_ACCESS_KEY_ID,
      secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    });

    // Build the R2 endpoint URL
    const r2Endpoint = `https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;

    // Generate pre-signed PUT URL for direct R2 upload
    const signedRequest = await r2Client.sign(
      new Request(r2Endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png',
        },
      }),
      {
        aws: {
          signQuery: true,
        },
      },
    );

    // Extract the signed URL (with query params for signature)
    const uploadUrl = signedRequest.url;

    // Return the key — frontend will use it to construct the public read URL
    // based on the R2 bucket's public URL pattern.
    // For example: https://saome-assets.pages.dev/{key}
    return c.json({
      uploadUrl,
      key,
      publicUrl: `${R2_PUBLIC_URL}/${key}`,
    });
  });

export default generateUploadUrlRoute;
