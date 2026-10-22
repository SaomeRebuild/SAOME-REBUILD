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
import type { Currency } from '@saome/shared/schemas/card';
import {
  findPublicTemplateById,
  findPublicTemplateWithTenantById,
  normalizeGiftCardConfig,
  normalizeMembershipTiers,
} from '../db/templates';

/**
 * Build the card-type-specific optional-field block shared by both
 * public services.
 *
 * 2026-10-23 — gift cards get their OWN branch, not the `is_paid`
 * one. A gift card is always paid, but it is not a "paid membership
 * card": it has no `isPaid` flag and no tier list. Before this change
 * `currency` was emitted ONLY inside the `is_paid` branch, so a gift
 * template could never tell the frontend which payment provider to
 * offer (TWD → 綠界, ZAR → Payfast) — the public page had no way to
 * complete a purchase. `currency` now rides along with the gift block.
 *
 * The two branches are mutually exclusive by construction: `is_paid` is
 * a membership concept, `gift_card` is a `card_type`. A template that
 * somehow satisfied both would take the gift branch first (the card type
 * is the stronger signal — it determines the page layout), so the paid
 * block is only emitted when the card is NOT a gift card.
 *
 * @see runs/decisions/2026-10-23-gift-card-paid-registration.md
 */
function projectOptionalFields(row: {
  card_type: string | null;
  is_paid?: boolean;
  membership_tiers?: unknown;
  currency?: Currency;
  gift_card_config?: unknown;
}): Pick<PublicPassTemplateDto, 'currency' | 'isPaid' | 'membershipTiers' | 'giftCard'> {
  // Gift-card branch — keyed on `card_type`, NOT on `is_paid`.
  if (row.card_type === 'gift_card') {
    const giftCard = normalizeGiftCardConfig(row.gift_card_config);
    return {
      currency: row.currency ?? 'TWD',
      // Omitted entirely when the tenant never configured a rate so
      // the public page renders no purchase section (rather than an
      // empty input that rejects every value).
      ...(giftCard ? { giftCard } : {}),
    };
  }
  // Paid-membership branch — only emitted when `is_paid` is true so
  // legacy non-paid templates don't carry a misleading
  // `membershipTiers: []`.
  if (row.is_paid) {
    return {
      isPaid: true,
      currency: row.currency ?? 'TWD',
      membershipTiers: normalizeMembershipTiers(row.membership_tiers),
    };
  }
  return {};
}

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
    // 2026-10-01 (Q2): project settings->>'language' so the public page
    // can drive i18n. Fallback to 'en' for legacy rows that pre-date the
    // migration adding `language` to settings.
    language: settings.language ?? 'en',
    issuerLogo: settings.issuerLogo,
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    // 2026-10-16 / 2026-10-23 — paid-membership OR gift-card fields,
    // both projected from the `settings` JSONB column. See
    // `projectOptionalFields` for why they are two separate branches.
    ...projectOptionalFields(row),
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
    // 2026-10-01 (Q2): mirror getPublicTemplateService — same language
    // projection + fallback so the two services return identical DTO
    // shapes (per Decision 2026-10-01 § 5 option "a": two narrow
    // services > one fat with optional flag).
    language: settings.language ?? 'en',
    issuerLogo: settings.issuerLogo,
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    // 2026-10-16 / 2026-10-23 — mirror getPublicTemplateService
    // (Decision 2026-10-01 § 5 option "a": two narrow services > one
    // fat with optional flag). Same conditional surface, same two
    // branches, same fallbacks — the two services must return
    // identical DTO shapes.
    ...projectOptionalFields(row),
  };
  return { dto, tenantId: row.tenant_id };
}