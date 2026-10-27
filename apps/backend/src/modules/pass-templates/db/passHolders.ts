/**
 * pass_holders table queries — pass-templates module.
 *
 * @module modules/pass-templates/db/passHolders
 * @description Pure SQL functions for the `pass_holders` table.
 *
 * Migration history:
 *   - 20260929000001_019_init_pass_holders.sql — base table
 *   - 20261016000001_023_add_pass_holder_payment_fields.sql — paid-membership
 *     extension (selected_tier_index, membership_tier_snapshot,
 *     payment_provider, payment_status, paid_amount, currency)
 *   - 20261018000001_024_add_not_required_payment_status.sql — payment_status
 *     CHECK widened from 3 values to 4 values ('not_required' added)
 *   - 20261019000001_025_add_pass_holder_issuance_fields.sql — Passcreator
 *     V3 per-pass runtime extension (pass_identifier, download_url,
 *     barcode_value, issued_at, issuance_error)
 *   - 20261019000001_026_backfill_barcode_and_add_uri_columns.sql —
 *     Closure: (a) backfill barcode_value placeholder strings to NULL,
 *     (b) CHECK constraint blocking re-entry of placeholders,
 *     (c) add iphone_uri / android_uri TEXT columns (V3 platform URIs)
 *   - 20261023000001_027_add_pass_holder_gift_card_purchase_fields.sql —
 *     Gift-card purchase extension (purchased_points, gift_card_snapshot)
 *
 * Decision log:
 *   - runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 *   - runs/decisions/2026-10-16-pass-holder-paid-membership-snapshot.md
 *   - runs/decisions/2026-10-18-payment-status-not-required-enum.md
 *   - runs/decisions/2026-10-19-pass-holder-v3-issuance.md
 *   - runs/decisions/2026-10-19-pass-holder-v3-jsonb-consolidation.md
 *   - runs/decisions/2026-10-23-gift-card-paid-registration.md
 */

import type { Sql } from '@/shared/db/client';
import type { PassHolderPhoneCountryCodeDto } from '@/shared/contracts/passTemplates';
import type { Currency } from '@saome/shared/schemas/card';
import type { PassValuesSnapshot } from '@saome/shared/schemas/passValues';

/**
 * Minimal row shape returned by INSERT ... ON CONFLICT DO NOTHING + RETURNING.
 *
 * `created` is derived from `created_at === updated_at` at the row level
 * (within the same transaction both timestamps share the same `now()`).
 * See `registerService.ts` for how we use it.
 *
 * 2026-10-16 — paid-membership columns added (migration 023). All six
 * fields are optional (NULL on legacy / non-paid rows) because the
 * migration 023 default is only on `payment_status` ('pending'). The
 * service layer must be defensive about nulls.
 *
 * 2026-10-19 — Passcreator V3 issuance columns added (migration 025).
 * Five new columns (`pass_identifier`, `download_url`, `barcode_value`,
 * `issued_at`, `issuance_error`) — all nullable so existing rows are
 * unaffected. `issued_at` is `null` when the issuance has not yet
 * completed; `issuance_error` is the i18n key when issuance failed.
 * See `runs/decisions/2026-10-19-pass-holder-v3-issuance.md`.
 */
export interface PassHolderRow {
  id: string;
  template_id: string;
  name: string;
  phone_country_code: PassHolderPhoneCountryCodeDto;
  phone_number: string;
  birthday: string;
  email: string;
  /** 0-based index into the template's membershipTiers[]. NULL for non-paid. */
  selected_tier_index?: number | null;
  /** Frozen snapshot of the selected tier (JSONB). NULL for non-paid. */
  membership_tier_snapshot?: unknown;
  /** 'payfast' (ZAR) | 'ecpay' (TWD). NULL for non-paid. */
  payment_provider?: 'payfast' | 'ecpay' | null;
  /**
   * 'pending' (default) | 'completed' | 'failed' | 'not_required'.
   * Always populated. 'not_required' (added 2026-10-18 via migration 024)
   * signals a non-paid template (stamp card / free reward / etc.) that
   * has no payment concept at all. See
   * runs/decisions/2026-10-18-payment-status-not-required-enum.md.
   */
  payment_status: 'pending' | 'completed' | 'failed' | 'not_required';
  /** Amount actually paid. NULL for non-paid / pending. */
  paid_amount?: string | number | null;
  /** 'TWD' | 'ZAR'. NULL for non-paid; defensive TWD backfill on apply. */
  currency?: Currency | null;
  // ================================================================
  // 2026-10-27 — Spend + resolved discount tier (migration 030)
  //
  //   `spend_amount` is the holder's accumulated spend. It has the
  //   SAME source as
  //   `pass_values_snapshot->'metrics'->'spendAccumulated'` — the
  //   application writes both in ONE UPDATE statement, so they
  //   cannot drift apart. NUMERIC arrives as a string from
  //   postgres.js (same as `paid_amount`).
  //
  //   `current_tier_*` record the tier the holder resolved to. They
  //   are NOT part of the snapshot JSONB on purpose: that blob is the
  //   fold of the `pass_events` ledger, and a tier depends on the
  //   template's (mutable) tier ladder — not on the ledger alone.
  // ================================================================
  /** Accumulated spend in the card currency. NOT NULL, defaults to 0. */
  spend_amount?: string | number | null;
  /** Display name of the resolved tier. NULL for non-discount cards. */
  current_tier_name?: string | null;
  /** Discount percentage granted by the resolved tier. NULL for non-discount cards. */
  current_tier_percent?: string | number | null;
  // ================================================================
  // 2026-10-19 — Passcreator V3 issuance columns (migration 025)
  //   All five columns are NULLABLE on the row. `issued_at` is null
  //   when issuance has not yet completed; the four other columns are
  //   null on a fresh row (the issuance happens AFTER upsertPassHolder
  //   returns). `issuance_error` carries the i18n key when issuance
  //   failed so the frontend can render a retry banner.
  // ================================================================
  /** V3 `data.identifier` — per-pass UUID issued by Passcreator. */
  pass_identifier?: string | null;
  /** V3 `data.linkToPassPage` — the .pkpass link for the holder to install. */
  download_url?: string | null;
  /** V3 `data.barcodeValue` — per-pass barcode payload (nullable when absent). */
  barcode_value?: string | null;
  /** ISO timestamp at which we successfully invoked V3 (NULL until then). */
  issued_at?: Date | string | null;
  /** i18n key when issuance failed; NULL on success. */
  issuance_error?: string | null;
  // ================================================================
  // 2026-10-19 — Passcreator V3 platform URI columns (migration 026)
  //   Both columns are NULLABLE on the row. They mirror V3's
  //   `data.iPhoneUri` (Apple Wallet / Passwallet direct .pkpass) and
  //   `data.androidUri` (Google Pay deeplink). V3 always returns all 3
  //   URIs (downloadPage + iPhoneUri + androidUri) — even for
  //   Apple/Passwallet-only templates, androidUri is a string. We
  //   persist all of them so the holder's audit trail records the
  //   exact artifact we issued, regardless of which platform they
  //   install from. The frontend uses `pickDownloadUri()` helper to
  //   user-agent-detect and surface the right one.
  //   See runs/decisions/2026-10-19-pass-holder-v3-jsonb-consolidation.md
  //   for the column-vs-JSONB tradeoff rationale.
  // ================================================================
  /** V3 `data.iPhoneUri` — direct .pkpass link for Apple Wallet / Passwallet. */
  iphone_uri?: string | null;
  /** V3 `data.androidUri` — Google Pay deeplink (still persisted for Apple-only templates). */
  android_uri?: string | null;
  // ================================================================
  // 2026-10-23 — Gift-card purchase columns (migration 027)
  //   Both columns are NULLABLE: every non-gift-card row keeps them
  //   NULL, so the migration is a no-op for existing data and needs no
  //   backfill. `purchased_points` carries a DB-level CHECK (> 0) as
  //   defence-in-depth; the PRIMARY gate is the application layer
  //   (`shared/logic/giftCardPurchase.ts` + `registerService`).
  //   See runs/decisions/2026-10-23-gift-card-paid-registration.md.
  // ================================================================
  /** Points the customer purchased. NULL for every non-gift card type. */
  purchased_points?: number | null;
  /**
   * Frozen exchange rate + derived amount (JSONB), validated against
   * `giftCardSnapshotSchema` before the write (Rule 032 § 1). NULL for
   * every non-gift card type.
   */
  gift_card_snapshot?: unknown;
  /**
   * 2026-10-24 — derived runtime-value cache (migration 028).
   *
   * The event ledger (`public.pass_events`) is the source of truth;
   * this JSONB snapshot is a rebuildable cache of the folded state.
   * `null` means the holder has not entered the runtime-value flow.
   */
  pass_values_snapshot?: PassValuesSnapshot | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Input shape for `updatePassHolderIssuance()`. Mirrors
 * `PassHolderIssuanceDto` (apps/backend/src/shared/contracts/passTemplates.ts)
 * — kept as a structural alias here to avoid a circular import with the
 * contracts layer (which already mirrors Layer 1).
 *
 * `id` is the holder UUID; the rest of the fields are the runtime
 * artifact we want to persist. The UPDATE writes `pass_identifier`,
 * `download_url`, `barcode_value`, `issued_at`, `issuance_error`,
 * `iphone_uri`, `android_uri` in a single statement (atomic at the
 * row level).
 *
 * 2026-10-19 — iPhoneUri / androidUri added per migration 026.
 * V3 always returns all 3 URIs; even for Apple/Passwallet-only
 * templates, `androidUri` is a string. Persisting both keeps the
 * audit trail accurate (frontend does user-agent detection via
 * `pickDownloadUri()`, but the DB row records what we actually got).
 *
 * Failure-mode construction: pass `issuanceError: 'passHolder.errors.upstreamFailed'`
 * and leave the other fields `undefined` — the function will set
 * `issued_at = NULL` and write the error key. The six runtime fields
 * are coerced to NULL when omitted.
 */
export interface PassHolderIssuanceUpdate {
  /** Holder UUID (`pass_holders.id`). */
  id: string;
  /** V3 `data.identifier` — pass UUID. NULL-able on the row. */
  passIdentifier?: string | null;
  /** V3 `data.linkToPassPage` — the .pkpass install URL. */
  downloadUrl?: string | null;
  /** V3 `data.barcodeValue` — per-pass barcode payload (NULL-able). */
  barcodeValue?: string | null;
  /**
   * ISO timestamp at which the backend successfully invoked V3 (or
   * attempted and failed). Coerced via `toISOString()` for portability.
   * When omitted AND `issuanceError` is set, the column is cleared
   * (set to NULL) so a retry can re-populate it later.
   */
  issuedAt?: Date | string | null;
  /**
   * i18n key for the failure reason. When set, the four other columns
   * are typically cleared to NULL — `updatePassHolderIssuance` does
   * NOT enforce that automatically, callers control which fields to
   * populate.
   */
  issuanceError?: string | null;
  /** V3 `data.iPhoneUri` — direct .pkpass for Apple Wallet / Passwallet. NULL-able. */
  iPhoneUri?: string | null;
  /** V3 `data.androidUri` — Google Pay deeplink. NULL-able but typically non-null per V3. */
  androidUri?: string | null;
}

/**
 * Insert a new pass_holder, OR return the existing row when
 * (template_id, email) already exists.
 *
 * Uses `ON CONFLICT (template_id, email) DO NOTHING` so the INSERT is
 * idempotent at the SQL layer. The caller compares `RETURNING` length:
 *   - 1 row returned → new row inserted
 *   - 0 rows returned → existing row found, follow-up SELECT pulls it
 *
 * The UNIQUE constraint is `pass_holders_template_email_unique` per migration
 * 20260929000001_019. If that constraint is ever dropped, this query will
 * break — the conformance test `register.test.ts::idempotency` will catch it.
 */
export async function findPassHolderByTemplateAndEmail(
  sql: Sql,
  templateId: string,
  email: string,
): Promise<PassHolderRow | null> {
  const rows = await sql<PassHolderRow[]>`
    SELECT id, template_id, name, phone_country_code, phone_number,
           birthday::text AS birthday, email,
           selected_tier_index, membership_tier_snapshot,
           payment_provider, payment_status, paid_amount, currency,
           pass_identifier, download_url, barcode_value,
           issued_at, issuance_error,
           iphone_uri, android_uri,
           purchased_points, gift_card_snapshot,
           pass_values_snapshot,
           spend_amount, current_tier_name, current_tier_percent,
           created_at, updated_at
      FROM public.pass_holders
     WHERE template_id = ${templateId}
       AND email = ${email}
     LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Idempotent insert: returns the existing row if (template_id, email) already
 * exists, otherwise inserts a new row and returns it.
 *
 * This is a two-step operation (SELECT then INSERT) for portability across
 * postgres.js versions — we avoid the `WITH ... ON CONFLICT ... RETURNING`
 * pattern which can be flaky in some pg client versions. The SELECT-first
 * approach is explicit and easy to test.
 *
 * 2026-10-16 — paid-membership extension. The 4 pass-delivery fields stay
 * the source of truth and remain required. The 5 paid-membership fields
 * (`selectedTierIndex`, `membershipTierSnapshot`, `paymentProvider`,
 * `paymentStatus`, `paidAmount`, `currency`) are optional — when
 * omitted, the DB applies the migration 023 defaults (NULL for most,
 * 'pending' for `payment_status`, TWD for `currency` via the
 * backfill).
 */
export async function upsertPassHolder(
  sql: Sql,
  input: {
    templateId: string;
    name: string;
    phoneCountryCode: PassHolderPhoneCountryCodeDto;
    phoneNumber: string;
    birthday: string;
    email: string;
    selectedTierIndex?: number;
    membershipTierSnapshot?: unknown;
    paymentProvider?: 'payfast' | 'ecpay';
    /**
     * 2026-10-18 — added 'not_required' for non-paid templates.
     * See runs/decisions/2026-10-18-payment-status-not-required-enum.md.
     */
    paymentStatus?: 'pending' | 'completed' | 'failed' | 'not_required';
    paidAmount?: number | null;
    currency?: Currency;
    /**
     * 2026-10-23 — gift-card purchase. Points the customer bought.
     * Undefined / null for every non-gift card type.
     */
    purchasedPoints?: number;
    /**
     * 2026-10-23 — gift-card purchase. Frozen exchange rate + derived
     * amount, built by `buildGiftCardSnapshot` from the TEMPLATE's own
     * settings (never from a client-supplied price). Injected with
     * `${sql.json(...)}` per Rule 027 § workerd `JSON.stringify`
     * pitfall — the workerd runtime corrupts non-ASCII through a manual
     * `JSON.stringify` + `::jsonb` cast.
     */
    giftCardSnapshot?: unknown;
  },
): Promise<{ row: PassHolderRow; created: boolean }> {
  const existing = await findPassHolderByTemplateAndEmail(sql, input.templateId, input.email);
  if (existing) {
    return { row: existing, created: false };
  }

  // Use `sql.json()` for the two JSONB columns (membership_tier_snapshot,
  // gift_card_snapshot) to avoid the workerd `JSON.stringify` non-ASCII
  // pitfall (Rule 027 § workerd `JSON.stringify` pitfall). All other
  // values go through tagged template injection.
  const inserted = await sql<PassHolderRow[]>`
    INSERT INTO public.pass_holders (
      template_id, name, phone_country_code, phone_number, birthday, email,
      selected_tier_index, membership_tier_snapshot,
      payment_provider, payment_status, paid_amount, currency,
      purchased_points, gift_card_snapshot
    ) VALUES (
      ${input.templateId},
      ${input.name},
      ${input.phoneCountryCode},
      ${input.phoneNumber},
      ${input.birthday}::date,
      ${input.email},
      ${input.selectedTierIndex ?? null},
      ${input.membershipTierSnapshot === undefined
        ? null
        : sql.json(input.membershipTierSnapshot as Parameters<typeof sql.json>[0])},
      ${input.paymentProvider ?? null},
      ${input.paymentStatus ?? 'pending'},
      ${input.paidAmount ?? null},
      ${input.currency ?? null},
      ${input.purchasedPoints ?? null},
      ${input.giftCardSnapshot === undefined
        ? null
        : sql.json(input.giftCardSnapshot as Parameters<typeof sql.json>[0])}
    )
    RETURNING id, template_id, name, phone_country_code, phone_number,
              birthday::text AS birthday, email,
              selected_tier_index, membership_tier_snapshot,
              payment_provider, payment_status, paid_amount, currency,
              pass_identifier, download_url, barcode_value,
              issued_at, issuance_error,
              iphone_uri, android_uri,
              purchased_points, gift_card_snapshot,
              pass_values_snapshot,
              spend_amount, current_tier_name, current_tier_percent,
              created_at, updated_at
  `;

  if (!inserted[0]) {
    // Race condition: another concurrent request inserted the same
    // (template_id, email) between our SELECT and INSERT. Re-fetch.
    const raced = await findPassHolderByTemplateAndEmail(sql, input.templateId, input.email);
    if (!raced) {
      throw new Error('[upsertPassHolder] INSERT returned no rows and re-fetch failed');
    }
    return { row: raced, created: false };
  }

  return { row: inserted[0], created: true };
}

/**
 * Write the derived runtime-value snapshot for a holder.
 *
 * The snapshot is a cache of the event-ledger fold. It is validated in
 * the service layer before this function is called and is written with
 * `sql.json()` so the workerd runtime preserves non-ASCII values.
 */
export async function updatePassHolderPassValuesSnapshot(
  sql: Sql,
  passHolderId: string,
  snapshot: PassValuesSnapshot,
): Promise<void> {
  // 2026-10-27 — `spend_amount` is written in the SAME statement as
  // the snapshot it is derived from.
  //
  // WHY SAME STATEMENT: `spend_amount` and
  // `pass_values_snapshot->'metrics'->'spendAccumulated'` are the
  // same fact. Two separate UPDATEs would leave a window where a
  // crash between them desynchronizes the column from the blob — and
  // a column that silently disagrees with its own source is worse
  // than no column at all. One statement means they cannot drift.
  await sql`
    UPDATE public.pass_holders
       SET pass_values_snapshot = ${sql.json(snapshot as Parameters<typeof sql.json>[0])},
           spend_amount = ${snapshot.metrics.spendAccumulated},
           updated_at = now()
     WHERE id = ${passHolderId}
  `;
}

/**
 * Record the discount tier a holder resolved to.
 *
 * 2026-10-27 (migration 030).
 *
 * WHY A SEPARATE WRITE: the tier is NOT part of the runtime snapshot
 * JSONB. That blob is the fold of the `pass_events` ledger, and a
 * tier depends on the template's (mutable) tier ladder — not on the
 * ledger alone. Putting it in the blob would make the reducer need
 * template configuration to reproduce it.
 *
 * The tier columns are therefore written from the SERVICE layer,
 * which is the only place that has both the resolved tier and the
 * holder id.
 *
 * @param tier - The resolved tier. `null` clears both columns (a
 *               non-discount card, or a template whose ladder is
 *               empty).
 */
export async function updatePassHolderCurrentTier(
  sql: Sql,
  passHolderId: string,
  tier: { name: string; percent: number } | null,
): Promise<void> {
  await sql`
    UPDATE public.pass_holders
       SET current_tier_name = ${tier?.name ?? null},
           current_tier_percent = ${tier?.percent ?? null},
           updated_at = now()
     WHERE id = ${passHolderId}
  `;
}

/**
 * List the holders that still need a runtime-value backfill.
 *
 * A holder "needs a backfill" when BOTH of the following hold:
 *
 *   - there is NO `registered` event in their ledger, AND
 *   - `pass_values_snapshot` IS NULL on their row
 *
 * The second condition is what makes the query safe to re-run: a
 * holder whose snapshot was already written is never re-processed,
 * even if their ledger row was somehow pruned. The two conditions
 * together mean "this holder has never entered the runtime-value
 * flow".
 *
 * The anti-join is a `NOT EXISTS` rather than a `LEFT JOIN ... IS
 * NULL` because the ledger's `idempotency_key` is NULLABLE — a
 * `LEFT JOIN` on the key would need to compare NULLs, which never
 * match. `NOT EXISTS` with an explicit `event_type = 'registered'`
 * predicate is unambiguous.
 *
 * @param sql - postgres.js instance.
 * @returns   - The holder rows that need a backfill, oldest first.
 */
export async function listPassHoldersMissingRuntimeValues(
  sql: Sql,
): Promise<PassHolderRow[]> {
  return await sql<PassHolderRow[]>`
    SELECT h.id, h.template_id, h.name, h.phone_country_code, h.phone_number,
           h.birthday::text AS birthday, h.email,
           h.selected_tier_index, h.membership_tier_snapshot,
           h.payment_provider, h.payment_status, h.paid_amount, h.currency,
           h.pass_identifier, h.download_url, h.barcode_value,
           h.issued_at, h.issuance_error,
           h.iphone_uri, h.android_uri,
           h.purchased_points, h.gift_card_snapshot,
           h.pass_values_snapshot,
           h.spend_amount, h.current_tier_name, h.current_tier_percent,
           h.created_at, h.updated_at
      FROM public.pass_holders h
     WHERE h.pass_values_snapshot IS NULL
       AND NOT EXISTS (
             SELECT 1
               FROM public.pass_events e
              WHERE e.pass_holder_id = h.id
                AND e.event_type = 'registered'
           )
     ORDER BY h.created_at ASC
  `;
}

/**
 * Update the V3 per-pass runtime columns on a `pass_holders` row.
 *
 * Called by `registerService` after a successful (or failed) call to
 * Passcreator V3 `/api/v3/pass`. The function writes the five issuance
 * columns in a single UPDATE — atomic at the row level so partial
 * writes are impossible.
 *
 * Caller conventions:
 *   - On V3 success: pass `id`, `passIdentifier`, `downloadUrl`,
 *     `barcodeValue` (optional, may be null), `issuedAt`. Leave
 *     `issuanceError` undefined.
 *   - On V3 failure: pass `id`, `issuanceError` (i18n key, e.g.
 *     `'passHolder.errors.upstreamFailed'`). Leave the four other
 *     columns undefined — the column values are explicitly cleared to
 *     NULL so a retry can re-populate them later.
 *
 * Tagged-template injection (Rule 027 § tagged template):
 *   All five optional columns are written via `${}` tagged template
 *   injection rather than `$N` positional placeholders. Mixing the
 *   two styles causes the `$N` to be parsed as a dollar-quoted string
 *   delimiter (postgres.js pitfall, 2026-08-21 trace).
 *
 * Workerd `JSON.stringify` pitfall (Rule 027 § workerd pitfall):
 *   The five columns are TEXT / TIMESTAMPTZ only — no JSONB — so we
 *   do NOT use `${sql.json(...)}` here. `issued_at` is coerced via
 *   `toISOString()` so the postgres driver sees a string, which it
 *   will coerce to TIMESTAMPTZ via the `::timestamptz` cast.
 *
 * 2026-10-19 — added per Passcreator V3 integration
 * (migration 025). See runs/decisions/2026-10-19-pass-holder-v3-issuance.md
 * for the call-site rationale.
 *
 * 2026-10-19 — **partial update fix** (production bug: row
 * `83d3139a-c3bb-4806-8900-5e9b759d0122`). The previous
 * implementation unconditionally `SET xxx = ${input.xxx ?? null}` for
 * ALL 7 runtime columns, which silently nullified the 6 columns
 * not present in the caller's payload. `registerService` runs TWO
 * calls to this function on the V3 barcode-backfill path (first call
 * with all 7 fields, second call with `barcodeValue` only) — the
 * second call wiped `pass_identifier` / `download_url` / `issued_at`
 * / `iphone_uri` / `android_uri` / `issuance_error` back to NULL.
 * The fix wraps the 6 runtime columns in `COALESCE(${newValue},
 * <col>)` so the column keeps its previous value when the caller
 * omits the field. `issuance_error` is INTENTIONALLY NOT wrapped in
 * COALESCE — the success path wants to CLEAR stale errors
 * (issuing_error: undefined → NULL), the failure path wants to
 * OVERWRITE with a fresh i18n key. See
 * `runs/improvements/feedback/20261019-pass-holder-v3-partial-update-bug.md`
 * for the full production trace + 4 conformance tests.
 *
 * @returns - the updated row (caller can confirm the write landed).
 */
export async function updatePassHolderIssuance(
  sql: Sql,
  input: PassHolderIssuanceUpdate,
): Promise<PassHolderRow> {
  // Coerce issuedAt to an ISO string for portable TIMESTAMPTZ binding.
  // `null` (or undefined → coerced to null) preserves the existing
  // value via the COALESCE wrapper below (Rule 032 partial-update
  // pattern).
  const issuedAtIso =
    input.issuedAt === undefined
      ? null
      : input.issuedAt === null
        ? null
        : typeof input.issuedAt === 'string'
          ? input.issuedAt
          : input.issuedAt.toISOString();

  // PARTIAL UPDATE — 6 runtime columns use COALESCE so callers can
  // ship a partial payload (e.g. barcode backfill) without wiping
  // sibling columns. `issuance_error` is intentionally NOT wrapped
  // in COALESCE: success path wants to clear stale errors
  // (undefined → NULL → clear), failure path wants to overwrite
  // (string → overwrite).
  const rows = await sql<PassHolderRow[]>`
    UPDATE public.pass_holders
       SET pass_identifier = COALESCE(${input.passIdentifier ?? null}, pass_identifier),
           download_url     = COALESCE(${input.downloadUrl ?? null}, download_url),
           barcode_value    = COALESCE(${input.barcodeValue ?? null}, barcode_value),
           issued_at        = COALESCE(${issuedAtIso}::timestamptz, issued_at),
           issuance_error   = ${input.issuanceError ?? null},
           iphone_uri       = COALESCE(${input.iPhoneUri ?? null}, iphone_uri),
           android_uri      = COALESCE(${input.androidUri ?? null}, android_uri)
     WHERE id = ${input.id}
     RETURNING id, template_id, name, phone_country_code, phone_number,
               birthday::text AS birthday, email,
               selected_tier_index, membership_tier_snapshot,
               payment_provider, payment_status, paid_amount, currency,
               pass_identifier, download_url, barcode_value,
               issued_at, issuance_error,
               iphone_uri, android_uri,
               purchased_points, gift_card_snapshot,
               pass_values_snapshot,
               spend_amount, current_tier_name, current_tier_percent,
               created_at, updated_at
  `;
  if (!rows[0]) {
    throw new Error(`[updatePassHolderIssuance] no row matches id=${input.id}`);
  }
  return rows[0];
}