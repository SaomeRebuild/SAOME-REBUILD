/**
 * getPublicTemplateService — read-only public template projection.
 *
 * @module modules/pass-templates/services/getPublicService
 * @description Reads a template row from DB and projects it to a
 * `PublicPassTemplateDto` (no tenant_id, no status, no internal fields).
 *
 * v2 (2026-09-29): NO status filter. See Decision Log § 拿掉的決策.
 *
 * Decision log: runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 */

import type { Sql } from '@/shared/db/client';
import type { PublicPassTemplateDto } from '@/shared/contracts/passTemplates';
import {
  findPublicTemplateById,
  findPublicTemplateWithTenantById,
} from '../db/templates';

/**
 * Look up a public-safe template view by ID.
 *
 * Returns null when the template does not exist. The route layer maps null
 * to a 404 NotFoundError with i18n key `passHolder.errors.templateNotFound`.
 *
 * Field projection logic:
 *   - `cardType` falls back to `'reward_card'` when `card_type` is NULL
 *     (matches the plan § Key programmatic detail).
 *   - `logoText` falls back to `row.name` when `settings.logoText` is
 *     missing (after migration 018, logoText is the JSONB key, NOT `name`).
 *   - `issuerName` defaults to empty string.
 *   - Optional fields (`issuerLogo` / `backgroundColor` / `textColor`)
 *     pass through unchanged.
 *
 * @param sql  - postgres.js instance
 * @param id   - template UUID
 * @returns    - PublicPassTemplateDto or null
 */
export async function getPublicTemplateService(
  sql: Sql,
  id: string,
): Promise<PublicPassTemplateDto | null> {
  const row = await findPublicTemplateById(sql, id);
  if (!row) return null;

  const settings = row.settings ?? {};

  return {
    id: row.id,
    name: row.name,
    // plan § Key programmatic detail: NULL card_type → 'reward_card' fallback.
    cardType: row.card_type ?? 'reward_card',
    // logoText: settings 內 logoText 缺失時 fallback 到 row.name.
    logoText: settings.logoText ?? row.name,
    issuerName: settings.issuerName ?? '',
    issuerLogo: settings.issuerLogo,
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
  };
}

/**
 * Result of looking up a template PLUS its tenant_id.
 *
 * `tenantId` is ONLY for internal R2 key audit (the public logo proxy).
 * It is NEVER serialized into the public DTO (per Decision 2026-09-29
 * § Decision 3 — tenant isolation). The two services below share identical
 * projection logic but different return shapes, so a future change to the
 * public DTO must update both.
 */
export interface PublicTemplateWithTenant {
  dto: PublicPassTemplateDto;
  /** Tenant UUID — internal R2 key audit only. NEVER expose in responses. */
  tenantId: string;
}

/**
 * Look up a public-safe template view AND its tenant_id (for R2 audit).
 *
 * Returns null when the template does not exist. The route layer maps null
 * to a 404 NotFoundError.
 *
 * Why a separate service (Decision 2026-10-01 § 5, option "a"):
 *   - `getPublicTemplateService` (used by GET /public) projects out
 *     tenant_id for tenant isolation (Decision Log 2026-09-29 § Decision 3).
 *   - The new logo proxy MUST verify the R2 key matches the tenant
 *     (fail-closed 204), so it needs `tenant_id` to rebuild the expected
 *     key with `buildImageKey()`.
 *   - Two narrow services > one fat service with optional `tenantId` flag
 *     (cleaner contract, no risk of accidentally returning it from /public).
 *
 * @param sql  - postgres.js instance
 * @param id   - template UUID
 * @returns    - { dto, tenantId } or null
 */
export async function getPublicTemplateWithTenantService(
  sql: Sql,
  id: string,
): Promise<PublicTemplateWithTenant | null> {
  const row = await findPublicTemplateWithTenantById(sql, id);
  if (!row) return null;

  const settings = row.settings ?? {};
  const dto: PublicPassTemplateDto = {
    id: row.id,
    name: row.name,
    cardType: row.card_type ?? 'reward_card',
    logoText: settings.logoText ?? row.name,
    issuerName: settings.issuerName ?? '',
    issuerLogo: settings.issuerLogo,
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
  };
  return { dto, tenantId: row.tenant_id };
}