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
import type {
  CardType,
  TemplateSettings,
} from '@saome/shared/schemas/card';
import type { Currency } from '@saome/shared/schemas/card';
import type {
  PublicGiftCardConfig,
  PublicMembershipTier,
} from '@saome/shared/types/passHolder';

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
  /**
   * The full `templates.settings` JSONB.
   *
   * 2026-10-24 — this used to be a hand-written six-field interface
   * (`logoText` / `issuerName` / `issuerLogo` / `backgroundColor` /
   * `textColor` / `language`). The SQL has always returned the WHOLE
   * JSONB object, so the narrow type was a lie that hid real fields
   * from every consumer. The runtime-value issuance path needs
   * `leftField` / `rightField` (bound face slots) and the expiry
   * settings; the template mapper needs the card-specific settings.
   *
   * It now mirrors the shared Zod schema (`TemplateSettings`), which
   * is the single source of truth (Rule 019 § 2).
   *
   * The DTO projection is unchanged — `getPublicService` still emits
   * only the public-safe subset.
   */
  settings: TemplateSettings;
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
   * 2026-10-23 — gift-card purchase config, built in SQL from the six
   * `giftCard*` keys inside `settings` (`jsonb_build_object` +
   * `COALESCE`, so the result is a single object rather than 6 more
   * top-level columns). NULL when the tenant never configured a rate.
   *
   * The service layer normalizes this to `PublicGiftCardConfig` via
   * `normalizeGiftCardConfig` — kept as `unknown` here because JSONB
   * is opaque at the DB layer.
   */
  gift_card_config?: unknown;
  /**
   * Upstream Passcreator template UUID (migration 021, 2026-10-11).
   * Surfaced in the public response so the public page can build a
   * "View in Passcreator" deep link if the tenant wants it. NULL for
   * cards that have never been pushed.
   */
  passcreator_template_id?: string | null;
}

/**
 * Build the gift-card config object in SQL from the `settings` JSONB.
 *
 * Returns NULL when NEITHER rate key is present, so an unconfigured
 * gift template produces `gift_card_config = NULL` (rather than an
 * object full of nulls) and the public DTO can omit `giftCard`
 * entirely — the page then renders no purchase section at all.
 *
 * Reused verbatim by BOTH `findPublicTemplateById` and
 * `findPublicTemplateWithTenantById` so the two public reads can never
 * disagree about a gift card's rate.
 */
const GIFT_CARD_CONFIG_SQL_FRAGMENT = `
  CASE WHEN settings ? 'giftCardAmount' OR settings ? 'giftCardPoints'
    THEN jsonb_build_object(
      'giftCardAmount',             settings->'giftCardAmount',
      'giftCardPoints',             settings->'giftCardPoints',
      'giftCardCheckoutMinPoints',  settings->'giftCardCheckoutMinPoints',
      'giftCardCheckoutMaxPoints',  settings->'giftCardCheckoutMaxPoints',
      'giftCardCheckoutMinAmount',  settings->'giftCardCheckoutMinAmount',
      'giftCardCheckoutMaxAmount',  settings->'giftCardCheckoutMaxAmount'
    )
    ELSE NULL
  END`;

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
 * Normalize a raw `gift_card_config` JSONB value into a typed
 * `PublicGiftCardConfig` (or `null` when unusable).
 *
 * Defensive in the same spirit as `normalizeMembershipTiers`: the
 * `settings` JSONB is free-form, so any of the six keys can be missing,
 * the wrong type, or hold an impossible value (min > max). Every one of
 * those cases yields `null` — the public page then renders NO purchase
 * section, rather than a section that would reject every input.
 *
 * We deliberately do NOT apply defaults. CardBuilder Step 6 always writes
 * all six keys together, and `templateSettingsSchema` already enforces
 * `.int().positive()` on each. A partial config means either a corrupt
 * row or a mid-migration legacy value — both are safer to hide than to
 * guess at. (Membership tiers DO get defaults because their shape has
 * meaningful per-field fallbacks; a gift-card rate does not.)
 *
 * @param raw  JSONB value from the `gift_card_config` SQL projection.
 * @returns    - `PublicGiftCardConfig`, or `null` when unusable.
 *
 * @see runs/decisions/2026-10-23-gift-card-paid-registration.md
 */
export function normalizeGiftCardConfig(
  raw: unknown,
): PublicGiftCardConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const asPositiveInt = (key: string): number | null => {
    const value = row[key];
    if (typeof value !== 'number') return null;
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      return null;
    }
    return value;
  };

  const unitAmount = asPositiveInt('giftCardAmount');
  const unitPoints = asPositiveInt('giftCardPoints');
  const checkoutMinPoints = asPositiveInt('giftCardCheckoutMinPoints');
  const checkoutMaxPoints = asPositiveInt('giftCardCheckoutMaxPoints');
  const checkoutMinAmount = asPositiveInt('giftCardCheckoutMinAmount');
  const checkoutMaxAmount = asPositiveInt('giftCardCheckoutMaxAmount');

  if (
    unitAmount === null ||
    unitPoints === null ||
    checkoutMinPoints === null ||
    checkoutMaxPoints === null ||
    checkoutMinAmount === null ||
    checkoutMaxAmount === null
  ) {
    return null;
  }
  // Inverted fences are unrecoverable at runtime (the UI would have to
  // show a range like "10,000–100"), so treat them as an unusable config.
  if (checkoutMinPoints > checkoutMaxPoints) return null;
  if (checkoutMinAmount > checkoutMaxAmount) return null;

  return {
    unitAmount,
    unitPoints,
    checkoutMinPoints,
    checkoutMaxPoints,
    checkoutMinAmount,
    checkoutMaxAmount,
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
           ${sql.unsafe(GIFT_CARD_CONFIG_SQL_FRAGMENT)}        AS gift_card_config,
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
  /** Full `templates.settings` JSONB — mirrors the shared schema (see
   *  `PublicTemplateRow::settings` for the rationale). */
  settings: TemplateSettings;
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
  /**
   * 2026-10-23 — gift-card purchase config, built in SQL by the same
   * `GIFT_CARD_CONFIG_SQL_FRAGMENT` used in `findPublicTemplateById`.
   * Mirrored here so the two public reads can never disagree about a
   * gift card's rate (Rule 019 § 2 mirror discipline). Typed `unknown`
   * for the same reason as `PublicTemplateRow::gift_card_config`.
   */
  gift_card_config?: unknown;
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
           ${sql.unsafe(GIFT_CARD_CONFIG_SQL_FRAGMENT)}        AS gift_card_config,
           passcreator_template_id
      FROM public.templates
     WHERE id = ${id}
     LIMIT 1
  `;
  return rows[0] ?? null;
}