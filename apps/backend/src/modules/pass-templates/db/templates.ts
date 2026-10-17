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
import type { Currency } from '@saome/shared/schemas/card';
import type { PublicMembershipTier } from '@saome/shared/types/passHolder';

/**
 * Minimal DB row shape read by the public endpoint.
 *
 * Only the columns we explicitly need to project a `PublicPassTemplateDto`.
 * We do NOT fetch `tenant_id`, `status`, `expires_at`, `created_by` etc. —
 * see Decision Log § Decision 3 (tenant isolation).
 *
 * 2026-10-16 (paid-membership MVP):
 *   `is_paid` / `membership_tiers` / `currency` are projected from the
 *   `settings` JSONB column via `(settings->>'isPaid')::boolean` /
 *   `settings->'membershipTiers'` / `settings->>'currency'`. The fields
 *   live in JSONB today (set by the CardBuilder editor) and are surfaced
 *   as top-level SQL columns for ergonomic TypeScript consumption.
 *   A future migration may promote them to dedicated columns for indexing
 *   — until then this JSONB-projection keeps the read path zero-migration.
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
  /**
   * 2026-10-16 — projected from `settings->>'isPaid'`. true when the
   * template is a paid-membership card (renders the tier picker +
   * simulated payment UI).
   */
  is_paid?: boolean;
  /**
   * 2026-10-16 — projected from `settings->'membershipTiers'` as raw
   * JSONB. The service layer normalizes this to `PublicMembershipTier[]`
   * with defensive defaults for missing / malformed rows. We type as
   * `unknown` here because JSONB is opaque at the DB layer — the
   * `normalizeMembershipTiers` helper in `getPublicService.ts` enforces
   * the runtime shape.
   */
  membership_tiers?: unknown;
  /**
   * 2026-10-16 — projected from `settings->>'currency'`. Drives the
   * simulated payment button (TWD → Ecpay, ZAR → Payfast).
   */
  currency?: Currency;
  /**
   * Upstream Passcreator template UUID (migration 021, 2026-10-11).
   * Surfaced in the public response so the public page can build a
   * "View in Passcreator" deep link if the tenant wants it. NULL for
   * cards that have never been pushed.
   */
  passcreator_template_id?: string | null;
}

/**
 * Normalize a raw `settings->'membershipTiers'` JSONB value into a typed
 * `PublicMembershipTier[]`. Defensive against missing / malformed rows —
 * the JSONB column is free-form so any row could be missing keys or have
 * a wrong `durationType`. The frontend's `PassHolderRegistration` will
 * silently drop the picker if the result is empty.
 *
 * Exported so `getPublic.test.ts` can unit-test the normalization rules.
 *
 * @param raw  JSONB value (parsed postgres.js output — array, null, or anything)
 * @returns         - filtered, defaulted PublicMembershipTier[]
 */
export function normalizeMembershipTiers(raw: unknown): PublicMembershipTier[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicMembershipTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) continue;
    const durationType =
      row.durationType === 'yearly' ? 'yearly' : 'monthly';
    const monthlyCost =
      typeof row.monthlyCost === 'number' && Number.isFinite(row.monthlyCost)
        ? row.monthlyCost
        : null;
    const yearlyCost =
      typeof row.yearlyCost === 'number' && Number.isFinite(row.yearlyCost)
        ? row.yearlyCost
        : null;
    // rewards: tolerate missing / non-object rows; default to []
    const rawRewards = Array.isArray(row.rewards) ? row.rewards : [];
    const rewards = rawRewards
      .map((r) => {
        if (!r || typeof r !== 'object') return null;
        const label = typeof (r as { label?: unknown }).label === 'string'
          ? (r as { label: string }).label
          : '';
        const value = typeof (r as { value?: unknown }).value === 'string'
          ? (r as { value: string }).value
          : '';
        if (!label && !value) return null;
        return { label, value };
      })
      .filter((r): r is { label: string; value: string } => r !== null);
    out.push({
      name,
      rewards,
      monthlyCost,
      yearlyCost,
      durationType,
    });
  }
  return out;
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
  //
  // 2026-10-16: paid-membership fields are projected from the `settings`
  // JSONB column. The frontend renders the tier picker + simulated payment
  // button when `is_paid = true` AND `membership_tiers` is a non-empty array.
  // We keep `settings` itself in the projection so existing call sites
  // (logoText, issuerName, etc.) continue to work.
  const rows = await sql<PublicTemplateRow[]>`
    SELECT id, name, card_type,
           settings,
           (settings->>'isPaid')::boolean                       AS is_paid,
           settings->'membershipTiers'                          AS membership_tiers,
           settings->>'currency'                                AS currency,
           passcreator_template_id
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
  /**
   * 2026-10-16 — projected from `settings->>'isPaid'` (see
   * `PublicTemplateRow::is_paid` for full rationale).
   */
  is_paid?: boolean;
  /**
   * 2026-10-16 — projected from `settings->'membershipTiers'` as raw
   * JSONB (typed as `unknown` at the DB layer; normalized via
   * `normalizeMembershipTiers` in the service).
   */
  membership_tiers?: unknown;
  /**
   * 2026-10-16 — projected from `settings->>'currency'`.
   */
  currency?: Currency;
  passcreator_template_id?: string | null;
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
    SELECT id, tenant_id, name, card_type,
           settings,
           (settings->>'isPaid')::boolean                       AS is_paid,
           settings->'membershipTiers'                          AS membership_tiers,
           settings->>'currency'                                AS currency,
           passcreator_template_id
      FROM public.templates
     WHERE id = ${id}
     LIMIT 1
  `;
  return rows[0] ?? null;
}