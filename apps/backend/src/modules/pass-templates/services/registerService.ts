/**
 * registerService — register a pass holder against a template.
 *
 * @module modules/pass-templates/services/registerService
 * @description Two-step idempotent register:
 *   1. SELECT pass_holders WHERE (template_id, email) — short-circuit if exists.
 *   2. INSERT pass_holders — race-safe via re-fetch on 0-row RETURNING.
 *
 * v2 (2026-09-29): NO status filter on the existence check. See Decision Log.
 *
 * Decision log: runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 */

import type { Sql } from '@/shared/db/client';
import { NotFoundError } from '@/shared/lib/saomeError';
import type { PassHolderRegisterResponseDto } from '@/shared/contracts/passTemplates';
import type { PassHolderRegisterPayload } from '../schemas/request';
import { findPublicTemplateById } from '../db/templates';
import { upsertPassHolder } from '../db/passHolders';

/**
 * Register a pass holder against a template.
 *
 * Behavior:
 *   - 404 when the template does not exist (no public template).
 *   - 200 + { ok, passHolderId, created: true } on first register.
 *   - 200 + { ok, passHolderId, created: false } on idempotent re-register
 *     (same email against same template).
 *
 * The route layer (`routes/register.ts`) is responsible for zod parsing
 * (`passHolderRegisterPayloadSchema`) before this service is invoked.
 *
 * 2026-10-16 — paid-membership extension. The 4 pass-delivery fields
 * stay the source of truth and remain required. The 5 paid-membership
 * fields (`selectedTierIndex`, `membershipTierSnapshot`,
 * `paymentProvider`, `paymentStatus`) are optional and only present
 * when the template is a paid membership card. The DB layer
 * (`upsertPassHolder`) handles the optionality and applies migration
 * 023 defaults when the fields are missing.
 *
 * The service does NOT re-validate `selectedTierIndex` against the
 * template's actual `membershipTiers` array today — the frontend's
 * PassHolderRegistration gates the picker UI on
 * `template.isPaid && template.membershipTiers.length > 0` and the
 * route layer's zod parse ensures the index is a non-negative
 * integer. A future hardening pass may add server-side re-validation
 * once the Passcreator V3 integration is in place.
 *
 * @param sql        - postgres.js instance
 * @param templateId - template UUID from URL path
 * @param payload    - validated PassHolderRegisterPayload
 * @returns          - PassHolderRegisterResponseDto
 */
export async function registerService(
  sql: Sql,
  templateId: string,
  payload: PassHolderRegisterPayload,
): Promise<PassHolderRegisterResponseDto> {
  // 1. Verify the template exists (v2: any status — see Decision Log).
  // We don't read its full body; just need existence for FK integrity.
  const template = await findPublicTemplateById(sql, templateId);
  if (!template) {
    throw new NotFoundError('passHolder.errors.templateNotFound', 'Template not found');
  }

  // 2. Idempotent INSERT (UNIQUE constraint on (template_id, email)).
  // Pass through the paid-membership fields when present. The DB layer
  // normalizes missing values via migration 023 defaults (NULL for
  // most, 'pending' for `payment_status`, TWD for `currency` via the
  // backfill).
  const { row, created } = await upsertPassHolder(sql, {
    templateId,
    name: payload.name,
    phoneCountryCode: payload.phoneCountryCode,
    phoneNumber: payload.phoneNumber,
    birthday: payload.birthday,
    email: payload.email,
    // Paid-membership extension — undefined flows through to the DB as
    // NULL or the migration 023 default. See `upsertPassHolder`.
    selectedTierIndex: payload.selectedTierIndex,
    membershipTierSnapshot: payload.membershipTierSnapshot,
    paymentProvider: payload.paymentProvider,
    paymentStatus: payload.paymentStatus,
  });

  return {
    ok: true,
    passHolderId: row.id,
    created,
  };
}