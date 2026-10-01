/**
 * pass_holders table queries — pass-templates module.
 *
 * @module modules/pass-templates/db/passHolders
 * @description Pure SQL functions for the `pass_holders` table.
 *
 * Migration: supabase/migrations/20260929000001_019_init_pass_holders.sql
 * Decision log: runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 */

import type { Sql } from '@/shared/db/client';
import type { PassHolderPhoneCountryCodeDto } from '@/shared/contracts/passTemplates';

/**
 * Minimal row shape returned by INSERT ... ON CONFLICT DO NOTHING + RETURNING.
 *
 * `created` is derived from `created_at === updated_at` at the row level
 * (within the same transaction both timestamps share the same `now()`).
 * See `registerService.ts` for how we use it.
 */
export interface PassHolderRow {
  id: string;
  template_id: string;
  name: string;
  phone_country_code: PassHolderPhoneCountryCodeDto;
  phone_number: string;
  birthday: string;
  email: string;
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
           birthday::text AS birthday, email, created_at, updated_at
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
  },
): Promise<{ row: PassHolderRow; created: boolean }> {
  const existing = await findPassHolderByTemplateAndEmail(sql, input.templateId, input.email);
  if (existing) {
    return { row: existing, created: false };
  }

  const inserted = await sql<PassHolderRow[]>`
    INSERT INTO public.pass_holders (
      template_id, name, phone_country_code, phone_number, birthday, email
    ) VALUES (
      ${input.templateId},
      ${input.name},
      ${input.phoneCountryCode},
      ${input.phoneNumber},
      ${input.birthday}::date,
      ${input.email}
    )
    RETURNING id, template_id, name, phone_country_code, phone_number,
              birthday::text AS birthday, email, created_at, updated_at
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