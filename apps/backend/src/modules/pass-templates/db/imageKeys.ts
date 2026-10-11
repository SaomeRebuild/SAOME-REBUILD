/**
 * Template image audit query — minimal projection for the public R2 proxy.
 *
 * @module modules/pass-templates/db/imageKeys
 * @description Returns ONLY the fields the public R2 image proxy needs
 * to audit and serve a template image (logo / icon / background):
 *   - `tenant_id` — used to rebuild the expected R2 key
 *   - `image_key` — the recorded R2 key in `settings.<field>` (or NULL
 *     if the user hasn't uploaded this image yet)
 *
 * We deliberately do NOT use the existing `findPublicTemplateWithTenantById`
 * here because:
 *   1. That function projects to `PublicPassTemplateDto`, which exposes
 *      `issuerLogo` but NOT `iconImage` / `backgroundImage`. Extending
 *      the public DTO to expose those fields would leak image references
 *      that the public pass-holder page doesn't need.
 *   2. The new query is narrower — fewer columns, no JSONB parsing,
 *      faster. Passcreator can hit this route on every push, so we
 *      want the read path to be cheap.
 *
 * SQL design:
 *   - We project the image key via `settings->>'<field>'` rather than
 *     `settings->'<field>'` so the return type is `text` (always a
 *     string, or NULL). `settings->'<field>'` would return `jsonb`
 *     which is awkward to type at the application layer.
 *   - We do NOT filter on `status` — the public image proxy serves
 *     any template by UUID, consistent with `findPublicTemplateById`.
 *     See Decision 2026-09-29 § 拿掉的決策.
 */

import type { Sql } from '@/shared/db/client';
import type { TemplateImageType } from '../routes/getTemplateImage';

/**
 * Result row for the audit query. Both fields may be NULL in
 * edge cases (corrupted row, missing image).
 */
export interface TemplateImageAuditRow {
  /** Tenant UUID — internal R2 key audit only. NEVER expose in responses. */
  tenant_id: string | null;
  /**
   * R2 object key recorded in `settings.<field>`, or NULL when the
   * user hasn't set this image. The caller compares this against
   * `buildImageKey(tenantId, templateId, imageType)` to audit
   * cross-tenant attempts.
   */
  image_key: string | null;
}

/**
 * Map image type to the `settings.<field>` column name.
 * Mirrors the FIELD_MAP in routes/getTemplateImage.ts (kept here as
 * a private const because the SQL has to interpolate the field name
 * via `sql` template — postgres.js won't let us parameterize a
 * column name with `${}`).
 */
const FIELD_MAP: Record<TemplateImageType, string> = {
  logo: 'issuerLogo',
  icon: 'iconImage',
  background: 'backgroundImage',
};

/**
 * Look up the tenant_id + image_key for a template's image slot.
 *
 * Returns null when the template does not exist. The route layer
 * maps null to a 404 NotFoundError.
 *
 * @param sql       - postgres.js instance
 * @param id        - template UUID
 * @param imageType - which image slot to read (logo / icon / background)
 * @returns         - { tenant_id, image_key } or null
 */
export async function findTemplateImageKey(
  sql: Sql,
  id: string,
  imageType: TemplateImageType,
): Promise<TemplateImageAuditRow | null> {
  const field = FIELD_MAP[imageType];
  // `settings->>${field}` is safe here: `field` is a hard-coded
  // server-side constant (one of 'issuerLogo' | 'iconImage' |
  // 'backgroundImage'), never user input. We could not parameterize
  // it with `${}` because postgres.js treats placeholder values as
  // parameter values, not as column names. SQL-injection-safe because
  // the value of `field` is constrained by TypeScript to the
  // TemplateImageType union.
  const rows = await sql<TemplateImageAuditRow[]>`
    SELECT
      tenant_id,
      settings->>${field} AS image_key
    FROM public.templates
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}
