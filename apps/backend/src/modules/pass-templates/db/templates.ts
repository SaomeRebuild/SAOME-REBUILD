/**
 * Public-safe template queries — pass-templates module (read-only subset).
 *
 * @module modules/pass-templates/db/templates
 * @description Pure SQL functions for the `templates` table from the
 * perspective of the public (no-auth) endpoint.
 *
 * IMPORTANT (v2 — 2026-09-29):
 *   We do NOT filter by `status`. The previous gate (status = 'published' only)
 *   blocked legitimate anonymous visitors who held a valid share URL pointing
 *   at a draft. See `runs/decisions/2026-09-29-pass-templates-public-endpoint.md`
 *   § 拿掉的決策 for the full rationale.
 *
 *   The Future Reconsideration Trigger lives in the Decision Log — revisit
 *   when (a) a UI component imports `cardService.publish` or (b) the
 *   dashboard starts showing a "draft vs published" distinction.
 *
 * Response shape is intentionally narrower than the cards module's
 * `findTemplateById` — see `PublicTemplateRow` below.
 */

import type { Sql } from '@/shared/db/client';
import type { CardLanguage, CardType } from '@saome/shared/schemas/card';

/**
 * Minimal DB row shape read by the public endpoint.
 *
 * Only the columns we explicitly need to project a `PublicPassTemplateDto`.
 * We do NOT fetch `tenant_id`, `status`, `expires_at`, `created_by` etc. —
 * see Decision Log § Decision 3 (tenant isolation).
 */
export interface PublicTemplateRow {
  id: string;
  name: string;
  card_type: CardType | null;
  /** Logo text lives in `settings.logoText` (per migration 018, 2026-09-13).
   *  `language` added 2026-10-01 for the public page i18n. */
  settings: {
    logoText?: string;
    issuerName?: string;
    issuerLogo?: string;
    backgroundColor?: string;
    textColor?: string;
    language?: CardLanguage;
  };
}

/**
 * Find a single template by UUID — public, no-auth read.
 *
 * Returns null if the template does not exist. The route layer maps null to
 * a 404 NotFoundError.
 *
 * @param sql   - postgres.js instance (from getDbForRequest(c))
 * @param id    - template UUID
 * @returns     - PublicTemplateRow or null
 */
export async function findPublicTemplateById(
  sql: Sql,
  id: string,
): Promise<PublicTemplateRow | null> {
  // v2: NO status filter. See Decision Log § 拿掉的決策.
  // We only project columns needed for PublicPassTemplateDto — no
  // tenant_id, status, expires_at, etc.
  const rows = await sql<PublicTemplateRow[]>`
    SELECT id, name, card_type, settings
      FROM public.templates
     WHERE id = ${id}
     LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Variant of `PublicTemplateRow` that INCLUDES `tenant_id` — internal use only.
 *
 * Used by the public logo proxy (GET /api/pass-templates/:id/logo) which
 * must rebuild the expected R2 key via `buildImageKey()` to audit
 * cross-tenant attempts. `tenant_id` is NEVER serialized into a public DTO
 * (per Decision 2026-09-29 § Decision 3 + Decision 2026-10-01 § 影響).
 */
export interface PublicTemplateRowWithTenant {
  id: string;
  /** Tenant UUID — internal R2 key audit only. NEVER expose in responses. */
  tenant_id: string;
  name: string;
  card_type: CardType | null;
  settings: {
    logoText?: string;
    issuerName?: string;
    issuerLogo?: string;
    backgroundColor?: string;
    textColor?: string;
    language?: CardLanguage;
  };
}

/**
 * Find a single template by UUID INCLUDING tenant_id — internal use only.
 *
 * The tenant_id is required by the public logo proxy to rebuild the
 * expected R2 key via `buildImageKey()` and audit cross-tenant attempts.
 * Never use this for a code path that serializes the row into a response.
 *
 * @param sql - postgres.js instance
 * @param id  - template UUID
 * @returns   - PublicTemplateRowWithTenant or null
 */
export async function findPublicTemplateWithTenantById(
  sql: Sql,
  id: string,
): Promise<PublicTemplateRowWithTenant | null> {
  const rows = await sql<PublicTemplateRowWithTenant[]>`
    SELECT id, tenant_id, name, card_type, settings
      FROM public.templates
     WHERE id = ${id}
     LIMIT 1
  `;
  return rows[0] ?? null;
}