/**
 * Template image service — audit query wrapper for the public R2 proxy.
 *
 * @module modules/pass-templates/services/getTemplateImageService
 * @description Thin pass-through around the DB function
 * `findTemplateImageKey`. We keep a service layer here for two reasons:
 *   1. Future cache layer: if the proxy becomes a hot path
 *      (Passcreator can hit it on every template push), we may want
 *      to add a Cloudflare Cache API or KV short-circuit. The
 *      service layer is the natural place to add it.
 *   2. Consistent with sibling services (`getPublicService`,
 *      `getPublicTemplateWithTenantService`) — every pass-templates
 *      read goes through `services/`, never directly through `db/`.
 *
 * Today: pure pass-through. The function signature mirrors the DB
 * function so the route can swap implementations without changing
 * call sites.
 */

import type { Sql } from '@/shared/db/client';
import {
  findTemplateImageKey,
  type TemplateImageAuditRow,
} from '../db/imageKeys';
import type { TemplateImageType } from '../routes/getTemplateImage';

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
export async function getTemplateImageAudit(
  sql: Sql,
  id: string,
  imageType: TemplateImageType,
): Promise<TemplateImageAuditRow | null> {
  return findTemplateImageKey(sql, id, imageType);
}
