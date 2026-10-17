/**
 * registerService — register a pass holder against a template.
 *
 * @module modules/pass-templates/services/registerService
 * @description Three-step register flow:
 *   1. SELECT pass_holders WHERE (template_id, email) — short-circuit if exists.
 *   2. INSERT pass_holders — race-safe via re-fetch on 0-row RETURNING.
 *   3. (2026-10-19) Call Passcreator V3 `/api/v3/pass` to issue the
 *      holder's wallet pass. On success, persist the per-pass runtime
 *      fields. On failure, persist an `issuance_error` i18n key — the
 *      row is still considered registered (200 + retry banner).
 *
 * v2 (2026-09-29): NO status filter on the existence check. See Decision Log.
 *
 * Decision log:
 *   - runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 *   - runs/decisions/2026-10-19-pass-holder-v3-issuance.md
 */

import type { Sql } from '@/shared/db/client';
import type { HonoEnv } from '@/shared/types/bindings';
import { NotFoundError, BadGatewayError } from '@/shared/lib/saomeError';
import type { PassHolderRegisterResponseDto, PassHolderIssuanceDto } from '@/shared/contracts/passTemplates';
import type { PassHolderRegisterPayload } from '../schemas/request';
import { findPublicTemplateById } from '../db/templates';
import {
  upsertPassHolder,
  updatePassHolderIssuance,
  type PassHolderRow,
} from '../db/passHolders';
import { issuePass } from '@/shared/lib/passcreator';

/**
 * Register a pass holder against a template.
 *
 * Behavior:
 *   - 404 when the template does not exist (no public template).
 *   - 200 + { ok, passHolderId, created: true, issuance? } on first
 *     register; `issuance` is populated when the V3 call succeeds
 *     OR fails (with `issuanceError` i18n key) — never throws on V3
 *     failure (q8-a confirmed — preserve 200 so the frontend can
 *     render a retry banner).
 *   - 200 + { ok, passHolderId, created: false, issuance? } on
 *     idempotent re-register (same email against same template). The
 *     `issuance` is taken from the EXISTING row (we don't re-issue
 *     — would create a duplicate pass for the same holder).
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
 * 2026-10-19 — V3 issuance wired in. `issuePass` is invoked immediately
 * after `upsertPassHolder` returns successfully for a NEW row (existing
 * rows skip re-issuance — see Decision Log § "Issue pass relation").
 * On V3 failure, `BadGatewayError.details.kind` discriminates the
 * underlying cause; the row is updated with `issuance_error =
 * 'passHolder.errors.upstreamFailed'` (the stable i18n key the
 * frontend banner surfaces) — `pass_identifier` / `download_url` /
 * `barcode_value` stay NULL so a retry can re-populate them.
 *
 * @param sql        - postgres.js instance
 * @param env        - Hono env bindings (for Passcreator V3 call)
 * @param templateId - template UUID from URL path
 * @param payload    - validated PassHolderRegisterPayload
 * @returns          - PassHolderRegisterResponseDto
 */
export async function registerService(
  sql: Sql,
  env: HonoEnv['Bindings'],
  templateId: string,
  payload: PassHolderRegisterPayload,
): Promise<PassHolderRegisterResponseDto> {
  // 1. Verify the template exists (v2: any status — see Decision Log).
  // We don't read its full body; just need existence for FK integrity
  // AND for the `passcreator_template_id` we need for V3 issuance.
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

  // 3. (2026-10-19) V3 issuance — only attempt for NEW rows OR for
  // existing rows whose `pass_identifier` was never populated (e.g.
  // the row was created during a Passcreator outage and we left it
  // un-issued). Already-issued rows short-circuit and return the
  // existing issuance data verbatim — Decision Log § "Issue pass
  // relation" prevents duplicate passes for the same (template, email).
  const issuance = await attemptIssuance(sql, env, row, template.passcreator_template_id);

  return {
    ok: true,
    passHolderId: row.id,
    created,
    issuance,
  };
}

/**
 * Attempt Passcreator V3 issuance for a fresh / un-issued holder row.
 *
 * Decision log: runs/decisions/2026-10-19-pass-holder-v3-issuance.md
 * § "V3 呼叫時機：B — 註冊成功立即發行".
 *
 * Behavior:
 *   - Row already has `pass_identifier` populated → return the
 *     existing issuance data verbatim (idempotent re-register path).
 *   - Template has no `passcreator_template_id` (never pushed to
 *     Passcreator) → return undefined; the frontend surfaces "Pass
 *     not yet ready, please retry later". We DON'T write an error
 *     key because this is a known-pre-launch state, not a failure.
 *   - V3 call succeeds → write the runtime fields to DB; return
 *     the persisted artifact.
 *   - V3 call throws `BadGatewayError` → write the i18n key to DB
 *     (issuance_error) and return the failure DTO so the frontend
 *     banner can render "重試簽發". We do NOT re-throw — the holder
 *     row is in a valid state, the user just hasn't received the
 *     .pkpass yet.
 *   - V3 call throws any other Error → unexpected. We log via
 *     `console.warn` and treat it as upstream_failed (defensive —
 *     `passcreatorFetch` should always wrap into `BadGatewayError`,
 *     but a future refactor could regress this contract).
 */
async function attemptIssuance(
  sql: Sql,
  env: HonoEnv['Bindings'],
  row: PassHolderRow,
  passcreatorTemplateId: string | null | undefined,
): Promise<PassHolderIssuanceDto | undefined> {
  // Short-circuit: already issued. Return whatever runtime fields
  // are present on the row (idempotent re-register path).
  if (row.pass_identifier) {
    return {
      passIdentifier: row.pass_identifier,
      downloadPage: row.download_url ?? undefined,
      barcodeValue: row.barcode_value ?? null,
      issuedAt:
        row.issued_at instanceof Date
          ? row.issued_at.toISOString()
          : typeof row.issued_at === 'string'
            ? row.issued_at
            : undefined,
    };
  }

  // No Passcreator template id → template never pushed upstream.
  // Per Decision § "V3 呼叫時機": we don't error here because this
  // is a known-pre-launch state for new templates. Frontend surfaces
  // "Pass not ready yet" via the absence of `downloadPage`.
  if (!passcreatorTemplateId) {
    return undefined;
  }

  // V3 call — wrapped in try/catch so BadGatewayError doesn't
  // propagate (we want to preserve 200 + `issuanceError`).
  try {
    const issued = await issuePass(env, passcreatorTemplateId, {
      name: row.name,
      phone: `${row.phone_country_code}${row.phone_number}`,
      birthday: row.birthday,
      email: row.email,
    });
    const issuedAt = new Date();
    // 2026-10-19 — Persist ALL 3 URIs that V3 returns. Migration 026
    // adds `iphone_uri` + `android_uri` columns; even Apple/Passwallet-
    // only templates get a real androidUri string from V3, so we
    // capture it for audit trail (frontend does user-agent detection
    // via `pickDownloadUri()` to surface the right one in the UI).
    await updatePassHolderIssuance(sql, {
      id: row.id,
      passIdentifier: issued.identifier,
      downloadUrl: issued.downloadPage,
      barcodeValue: issued.barcodeValue,
      issuedAt,
      iPhoneUri: issued.iPhoneUri,
      androidUri: issued.androidUri,
    });
    return {
      passIdentifier: issued.identifier,
      downloadPage: issued.downloadPage,
      iPhoneUri: issued.iPhoneUri,
      androidUri: issued.androidUri,
      barcodeValue: issued.barcodeValue,
      issuedAt: issuedAt.toISOString(),
    };
  } catch (err) {
    // Log for observability (the frontend banner is the real user-
    // facing surface; this log helps ops correlate the failure rate).
    // eslint-disable-next-line no-console
    console.warn(
      '[registerService] Passcreator V3 issuance failed for holder',
      row.id,
      ':',
      err instanceof Error ? err.message : String(err),
    );
    // Map upstream errors to a stable i18n key. The frontend has a
    // single banner copy ("重試簽發") for any failure; we don't
    // differentiate kinds in the response to keep the contract
    // small. Kind-aware copy is a future hardening.
    const i18nKey = 'passHolder.errors.upstreamFailed';
    try {
      await updatePassHolderIssuance(sql, {
        id: row.id,
        issuanceError: i18nKey,
      });
    } catch (updateErr) {
      // Even the error-write failed — surface as a 502 so the
      // frontend at least sees a different signal than "register
      // succeeded". This is the only path where `registerService`
      // lets a `BadGatewayError` escape.
      if (err instanceof BadGatewayError) throw err;
      throw new BadGatewayError({
        upstream: 'passcreator',
        upstreamStatus: 502,
        upstreamBody: `issuance + update both failed: ${String(updateErr)}`,
      });
    }
    return { issuanceError: i18nKey };
  }
}