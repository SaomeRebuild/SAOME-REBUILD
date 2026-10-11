/**
 * Public R2 image proxy — template image routes (logo / icon / background).
 *
 * @module modules/pass-templates/routes/getTemplateImage
 * @description Public, no-auth proxy for serving template images (issuer
 * logo, push-notification icon, pass strip background) from the R2
 * bucket. Used by:
 *   1. The public "Get Pass" page (`/pass/{templateId}`) — browser
 *      `<img src>` hits `GET /api/pass-templates/:id/{logo,icon,background}`.
 *   2. Passcreator's V2 API — when SAOME pushes a template upstream,
 *      the `images.{logo,icon,strip}` field values point at these
 *      public URLs so Passcreator can fetch them server-to-server.
 *
 * Why a factory (vs. three copy-pasted routes):
 *   - The audit + R2-fetch logic is identical for all three image
 *     types. Only the settings field name and route suffix differ.
 *   - One factory + three pre-built exports keeps the contract
 *     symmetric — when we add a new image type (e.g. `thumbnail`),
 *     we add a single line and the tests get coverage for free.
 *   - Refactor of getLogo.ts (2026-10-12): the original `getLogo.ts`
 *     was copy-pasted in 2026-10-01; this factory absorbs that logic
 *     and extends it to icon + background.
 *
 * Auth: UNAUTHENTICATED. The template UUID is the capability. Tenant
 * isolation is achieved by:
 *   1. UUID zod parse — reject malformed input (404, not 400)
 *   2. Tenant audit — `settings.<imageField>` MUST equal
 *      `buildImageKey(tenant_id, template_id, imageType)`; otherwise
 *      silent 204 (fail-closed, don't leak cross-tenant attempts)
 *   3. R2 miss — silent 204 (don't leak whether the bucket exists)
 *
 * Cache header is `public, max-age=31536000, immutable` — logos,
 * icons, and backgrounds are considered immutable post-upload
 * (per dashboard convention; see Step 3 icon uploader plan).
 *
 * Why this route exists (vs. reusing the auth'd `/api/cards/:id/image/:type`):
 *   - `/api/cards/:id/image/:type` requires JWT and is for authenticated
 *     users editing their own templates. Passcreator is a
 *     server-to-server client that has no JWT; it needs a public URL.
 *   - `/api/pass-templates/:id/{logo,icon,background}` is the
 *     public-facing counterpart, mirroring the existing public
 *     `GET /:id/public` and `POST /:id/register` endpoints.
 *
 * Regression history:
 *   - 2026-10-01: getLogo.ts introduced (logo only).
 *   - 2026-10-11: passTemplateMapping was added to push templates to
 *     Passcreator. It constructed icon URLs as
 *     `${R2_PUBLIC_URL}/${r2Key}` (e.g. `.../<tenantId>/<templateId>/icon.png`)
 *     which has NO matching route — Passcreator's server-to-server
 *     fetch hit 404 and rejected the template with
 *     `errors[].images.icon = 'The given icon ... could not be downloaded.'`.
 *   - 2026-10-12: this factory adds `icon` + `background` routes and
 *     passTemplateMapping::r2KeyToPublicUrl is updated to point at
 *     the new public URLs.
 *
 * Decision log: runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md
 * (logo only) + new entry 2026-10-12 for the icon/background extension.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { buildImageKey, type CardImageType } from '@saome/shared/constants/card-images';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { getTemplateImageAudit } from '../services/getTemplateImageService';
import { NotFoundError, SaomeError } from '@/shared/lib/saomeError';

/**
 * The three image types this route serves. The `settings` field name
 * (where the R2 key is stored) is derived from this — see `FIELD_MAP`
 * below. Passcreator's `images` payload keys are also keyed off this
 * (`icon` / `logo` / `strip`); the mapping is:
 *
 *   imageType | settings field       | passcreator key
 *   ----------+----------------------+----------------
 *   logo      | settings.issuerLogo  | images.logo
 *   icon      | settings.iconImage   | images.icon
 *   background| settings.backgroundImage | images.strip
 */
export type TemplateImageType = 'logo' | 'icon' | 'background';

/**
 * settings.<field> → image type. Keeps the audit + mapping logic in
 * sync with the schema layer.
 */
const FIELD_MAP: Record<TemplateImageType, string> = {
  logo: 'issuerLogo',
  icon: 'iconImage',
  background: 'backgroundImage',
};

/**
 * Path param zod schema. UUID-only — same shape as `getPublic` route.
 * On failure → 404 (NotFoundError), NOT 400 — to avoid leaking valid
 * UUID format to attackers (per Decision 2026-09-29 § Decision 3).
 */
const paramsSchema = z.object({
  id: z.string().uuid('passHolder.errors.templateNotFound'),
});

/**
 * Create a public R2 image proxy route for the given image type.
 *
 * Returns a Hono sub-app with a single `GET /:id/{imageType}` route.
 * Mount in the pass-templates module via `app.route('/', createGetTemplateImageRoute('logo'))`.
 *
 * The route is intentionally a thin wrapper around the audit + R2
 * fetch — there's no service-layer business logic, so we don't add
 * a separate `services/<verb>Service.ts` for it.
 */
export function createGetTemplateImageRoute(imageType: TemplateImageType) {
  const fieldName = FIELD_MAP[imageType];
  // buildImageKey takes CardImageType, which is a superset of TemplateImageType.
  // The cast is safe because CardImageType's keyof is exactly TemplateImageType.
  const cardImageType = imageType as CardImageType;

  return new Hono<HonoEnv>().get(`/:id/${imageType}`, async (c) => {
    // Step 1 — UUID zod parse (defense-in-depth: must run BEFORE
    // getDbForRequest so bot traffic can't burn SQL pool slots).
    const parsed = paramsSchema.safeParse({ id: c.req.param('id') });
    if (!parsed.success) {
      throw new NotFoundError('passHolder.errors.templateNotFound');
    }
    const templateId = parsed.data.id;

    const sql = await getDbForRequest(c);

    // Step 2 — Lookup with tenant_id (internal use only — never serialized).
    const audit = await getTemplateImageAudit(sql, templateId, imageType);
    if (!audit) {
      throw new NotFoundError('passHolder.errors.templateNotFound');
    }
    const { tenant_id: tenantId, image_key: imageKey } = audit;

    // Step 3 — Multi-tenant audit: rebuild expected R2 key, fail-closed
    // if the recorded key doesn't match. Silent 204 (no diagnostic) so
    // we don't leak cross-tenant probing attempts.
    // tenant_id is typed as `string | null` for the defensive corrupted-row
    // case (test 7) — but buildImageKey requires a string. We treat a
    // NULL tenant_id the same as a missing image: silent 204, no
    // diagnostic, no R2 fetch.
    if (!tenantId || !imageKey) {
      return c.body(null, 204);
    }
    const expectedKey = buildImageKey(tenantId, templateId, cardImageType);
    if (imageKey !== expectedKey) {
      return c.body(null, 204);
    }

    // Step 4 — Fetch from R2; miss → silent 204.
    const bucket = c.env.ASSETS;
    let object;
    try {
      object = await bucket.get(expectedKey);
    } catch (err) {
      console.error(`[getTemplateImage:${imageType}] R2 get error:`, err);
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

    // Step 5 — Stream with immutable cache. Uses imageType in the
    // log/error paths so an operator tail-ing logs can tell which
    // image broke.
    const contentType = object.httpMetadata?.contentType ?? 'image/png';
    c.header('Content-Type', contentType);
    c.header('Content-Length', String(object.size ?? ''));
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    return c.body(object.body);
  });
}

/**
 * Pre-built routes for the three image types. Mounted in the
 * pass-templates module at `/:id/{imageType}`.
 */
export const getLogoRoute = createGetTemplateImageRoute('logo');
export const getIconRoute = createGetTemplateImageRoute('icon');
export const getBackgroundRoute = createGetTemplateImageRoute('background');
