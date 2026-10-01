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
 * (passHolderRegisterPayloadSchema) before this service is invoked.
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
  const { row, created } = await upsertPassHolder(sql, {
    templateId,
    name: payload.name,
    phoneCountryCode: payload.phoneCountryCode,
    phoneNumber: payload.phoneNumber,
    birthday: payload.birthday,
    email: payload.email,
  });

  return {
    ok: true,
    passHolderId: row.id,
    created,
  };
}