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
 *
 * Decision log: runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 *               runs/decisions/2026-10-16-pass-holder-paid-membership-snapshot.md
 */

import type { Sql } from '@/shared/db/client';
import type { PassHolderPhoneCountryCodeDto } from '@/shared/contracts/passTemplates';
import type { Currency } from '@saome/shared/schemas/card';

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
  created_at: Date;
  updated_at: Date;
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
  },
): Promise<{ row: PassHolderRow; created: boolean }> {
  const existing = await findPassHolderByTemplateAndEmail(sql, input.templateId, input.email);
  if (existing) {
    return { row: existing, created: false };
  }

  // Use `sql.json()` for the membership_tier_snapshot JSONB column to
  // avoid the workerd `JSON.stringify` non-ASCII pitfall (Rule 027
  // § workerd `JSON.stringify` pitfall). All other values go through
  // tagged template injection.
  const inserted = await sql<PassHolderRow[]>`
    INSERT INTO public.pass_holders (
      template_id, name, phone_country_code, phone_number, birthday, email,
      selected_tier_index, membership_tier_snapshot,
      payment_provider, payment_status, paid_amount, currency
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
      ${input.currency ?? null}
    )
    RETURNING id, template_id, name, phone_country_code, phone_number,
              birthday::text AS birthday, email,
              selected_tier_index, membership_tier_snapshot,
              payment_provider, payment_status, paid_amount, currency,
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