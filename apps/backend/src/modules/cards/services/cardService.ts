/**
 * Card template service — business logic layer.
 *
 * @module modules/cards/services/cardService
 * @description Orchestrates card template operations: create, get, list, update, publish, delete.
 *
 * v4 (2026-10-11, Step 8 Passcreator push):
 *   `updateTemplateService` is the publish-action choke point. When
 *   `status === 'published'`, the service now ALSO syncs the template
 *   to Passcreator via `syncTemplateToPasscreator` BEFORE writing the
 *   DB row. If Passcreator rejects the request, the service throws
 *   `BadGatewayError` (502) and the DB row is left untouched — the
 *   user sees the Passcreator error banner and can retry.
 */

import type { Sql } from '@/shared/db/client';
import { unwrapCardSettings } from '@saome/shared/logic/cardSettings';
import {
  insertTemplate,
  findTemplateById,
  findTemplatesByTenantId,
  updateTemplate,
  deleteTemplate,
  touchExpiresAt,
} from '../db/templates';
import { enqueueR2Delete } from '../db/r2PendingDeletes';
import {
  collectR2KeysForTemplate,
  diffRemovedR2Keys,
  enqueueTemplateR2Keys,
} from './r2Keys';
import { NotFoundError } from '@/shared/lib/saomeError';
import type {
  TemplatesRow,
  TemplateSettings,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '../db/templates';
import type {
  TemplateDto,
  CreateTemplateResponse,
  GetTemplateResponse,
  ListTemplatesResponse,
  UpdateTemplateResponse,
  DeleteTemplateResponse,
} from '../schemas/response';
import { syncTemplateToPasscreator } from '@/modules/pass-templates/services/passTemplateSync';
import type { PassLanguage } from '@saome/shared/i18n/fieldLabels';
import type { HonoEnv } from '@/shared/types/bindings';

// Re-export for backward compatibility — the test
// `src/modules/cards/tests/r2OrphanCleanup.test.ts` (and any other
// future caller) can now import directly from `./r2Keys`. Keeping the
// re-export so existing call sites in cardService continue to work
// without churn.
export { collectR2KeysForTemplate, diffRemovedR2Keys, enqueueTemplateR2Keys };

// The pure helpers `collectR2KeysForTemplate`, `diffRemovedR2Keys`, and
// `enqueueTemplateR2Keys` live in `./r2Keys` (extracted from this file
// to break the dependency on `@saome/shared/logic/cardSettings` for
// unit testing). Re-exported above for backward compatibility.

/**
 * Convert a DB row to a TemplateDto.
 *
 * Bug #8.5 defensive (2026-08-31): the settings column may be a JSON object,
 * a JSON string (legacy corruption), or an array of partial merges (Bug #8
 * partial fix). unwrapCardSettings handles all cases.
 */
function toDto(row: TemplatesRow): TemplateDto {
  const settings: Record<string, unknown> = unwrapCardSettings(row.settings);
  return {
    id: row.id,
    status: row.status,
    name: row.name,
    cardType: row.card_type,
    settings: settings as TemplateSettings,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

/**
 * Defensive parser for `templates.settings` JSONB.
 *
 * Bug #8.5 (2026-08-31): handles:
 *   - jsonb object (normal)
 *   - jsonb string (legacy corruption)
 *   - jsonb array of partial merges (Bug #8 partial fix)
 *   - jsonb array of jsonb strings (Bug #8.5 worst case)
 *
 * Now sourced from `packages/shared/logic/cardSettings.ts` (Plan Phase 5.7)
 * so both this file and the frontend store share the exact same defensive
 * logic; drift is prevented at compile time (single source of truth).
 *
 * @see packages/shared/logic/cardSettings.ts
 * @see packages/shared/logic/cardSettings.test.ts (10 case contract)
 */
// unwrapCardSettings now imported from @saome/shared/logic/cardSettings

/**
 * Create a new template draft.
 *
 * @param sql - Database client
 * @param tenantId - Tenant ID from JWT
 * @param cardType - Card type (optional — NULL if user has not selected yet)
 * @param name - Optional template name
 * @param settings - Optional initial settings
 * @param id - Optional client-generated UUID (for immediate redirect)
 */
export async function createTemplateService(
  sql: Sql,
  tenantId: string,
  cardType: string | undefined,
  name?: string,
  settings?: Partial<TemplateSettings>,
  id?: string,
): Promise<CreateTemplateResponse> {
  const input: CreateTemplateInput = {
    id,
    tenantId,
    name: name ?? '未命名卡片',
    cardType: cardType as CreateTemplateInput['cardType'],
    settings,
  };
  const row = await insertTemplate(sql, input);
  return { template: toDto(row) };
}

/**
 * Get a template by ID.
 *
 * @param sql - Database client
 * @param templateId - Template UUID
 * @param tenantId - Tenant ID from JWT (for ownership check)
 */
export async function getTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
): Promise<GetTemplateResponse> {
  const row = await findTemplateById(sql, templateId);
  if (!row) {
    throw new NotFoundError('common.error.notFound', 'Template not found');
  }
  // Ownership check: ensure the template belongs to the tenant
  if (row.tenant_id !== tenantId) {
    throw new NotFoundError('common.error.notFound', 'Template not found');
  }
  return { template: toDto(row) };
}

/**
 * List all templates for a tenant.
 *
 * @param sql - Database client
 * @param tenantId - Tenant ID from JWT
 */
export async function listTemplatesService(
  sql: Sql,
  tenantId: string,
): Promise<ListTemplatesResponse> {
  const rows = await findTemplatesByTenantId(sql, tenantId);
  return { templates: rows.map(toDto) };
}

/**
 * Update a template.
 *
 * v4 (2026-10-11, Step 8 Passcreator push):
 *   When `status === 'published'`, this service now ALSO syncs the
 *   template to Passcreator. The Passcreator call happens BEFORE the
 *   DB write so a rejection rolls back cleanly: the user's template
 *   stays in the same draft state and the error surfaces to the UI
 *   as a 502 banner.
 *
 * @param sql - Database client
 * @param templateId - Template UUID
 * @param tenantId - Tenant ID from JWT (for ownership check)
 * @param env - Hono env (required only for the publish path; pass
 *              `c.env` from the route layer). Type-erased to `unknown`
 *              to keep the service signature decoupled from HonoEnv.
 * @param name - Optional new name
 * @param cardType - Optional new card type
 * @param settings - Optional partial settings
 * @param status - Optional new status
 */
/**
 * Diff top-level imageKey-bearing fields between two settings objects
 * is handled by `diffRemovedR2Keys` in `./r2Keys` (extracted so the
 * unit test for it can run without pulling in `@saome/shared/logic`).
 */

export async function updateTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
  env: HonoEnv['Bindings'] | unknown,
  name?: string,
  cardType?: string,
  settings?: Partial<TemplateSettings>,
  status?: 'draft' | 'published' | 'abandoned',
): Promise<UpdateTemplateResponse> {
  // Ownership check
  const existing = await findTemplateById(sql, templateId);
  if (!existing || existing.tenant_id !== tenantId) {
    throw new NotFoundError('common.error.notFound', 'Template not found');
  }

  const input: UpdateTemplateInput = {};
  if (name !== undefined) input.name = name;
  if (cardType !== undefined) input.cardType = cardType as UpdateTemplateInput['cardType'];
  if (settings !== undefined) input.settings = settings;
  if (status !== undefined) input.status = status;

  // Capture pre-update imageKey state for the orphan-cleanup diff.
  // `unwrapCardSettings` mirrors the read path so a corrupted row
  // doesn't crash the diff.
  const beforeSettings = unwrapCardSettings(existing.settings);

  // ===== Passcreator push (v4) =====
  // When the user publishes, push the template upstream BEFORE writing
  // the DB row. If Passcreator rejects, we throw BadGatewayError and
  // the DB write below never runs — the user sees the 502 banner and
  // can retry. The local `passcreator_template_id` stays at the
  // pre-publish value (null on first publish, or the existing id on
  // subsequent updates).
  //
  // Why push BEFORE the DB write (not after):
  //   - Atomic semantics: the user's "publish" intent is a single
  //     logical action. If the upstream rejects, the local state
  //     should not have flipped to "published" — that would lie to
  //     the user and create an orphan in the Library.
  //   - The next sync attempt reads `existing` (pre-update) and either
  //     creates or updates accordingly. Re-running after a 502 will
  //     work because `existing` is unchanged.
  //
  // Idempotency: if `existing.passcreator_template_id` is null, we
  // CREATE; if it is set, we UPDATE. The Passcreator call is
  // idempotent across retries because the body is the same.
  let nextPasscreatorId: string | null = existing.passcreator_template_id ?? null;
  if (status === 'published') {
    const language = pickTemplateLanguage(existing.settings);
    const r2PublicUrl = (env as { R2_PUBLIC_URL?: string } | undefined)?.R2_PUBLIC_URL
      ?? 'https://saome-backend.josh1989213.workers.dev';
    // Build the "would-be" updated settings so the push reflects the
    // final state, not the pre-update state.
    const projectedSettings: Partial<TemplateSettings> = {
      ...(unwrapCardSettings(existing.settings) as TemplateSettings),
      ...(input.settings ?? {}),
    };
    const projectedRow: TemplatesRow = {
      ...existing,
      name: input.name ?? existing.name,
      card_type: (input.cardType as TemplatesRow['card_type']) ?? existing.card_type,
      settings: projectedSettings as TemplateSettings,
    };
    const sync = await syncTemplateToPasscreator({
      env,
      sql,
      template: projectedRow,
      language,
      r2PublicUrl,
    });
    nextPasscreatorId = sync.id;
  }

  // If the sync produced a new id, persist it alongside the status flip.
  if (nextPasscreatorId !== existing.passcreator_template_id) {
    input.settings = {
      ...(input.settings ?? {}),
      // We need to also pass passcreator_template_id via the SET clauses.
      // But `updateTemplate` only accepts name/cardType/settings/status.
      // → we have to extend the DB layer OR run a second UPDATE here.
      // For v1, the DB layer is extended via the partial settings: we
      // sneak the id into the JSONB settings column under a reserved
      // key. A future cleanup will add a typed `passcreator_template_id`
      // parameter to updateTemplate.
    } as Partial<TemplateSettings>;
    // Actually, we update the row with the new id by a side-channel:
    // run the regular updateTemplate, then a follow-up UPDATE.
    // (See post-update passcreator_template_id write below.)
  }

  const row = await updateTemplate(sql, templateId, input);

  // Post-update passcreator_template_id write — when the sync produced
  // a new id on first publish, persist it. On subsequent updates the
  // id is unchanged, so the UPDATE is a no-op row-count-wise but
  // keeps the SQL layer's audit trail accurate.
  if (nextPasscreatorId && nextPasscreatorId !== existing.passcreator_template_id) {
    await sql`
      UPDATE templates
         SET passcreator_template_id = ${nextPasscreatorId}
       WHERE id = ${templateId}
    `;
    // Re-read so the returned DTO has the new id.
    const updated = await findTemplateById(sql, templateId);
    if (updated) {
      return { template: toDto(updated) };
    }
  }

  // Post-update imageKey diff — enqueue any R2 keys that disappeared.
  // This catches:
  //   1. User explicitly clears `settings.issuerLogo = ''`
  //   2. User re-uploads a logo and the new key is different (rare;
  //      generate-upload-url uses the same key, so this only happens
  //      if the frontend explicitly chose a different key)
  //   3. User removes a table-card image element
  //
  // Note: the actual R2 delete happens in the cron sweep. We only
  // INSERT a tombstone row here.
  const afterSettings = unwrapCardSettings(row.settings);
  const removedKeys = diffRemovedR2Keys(beforeSettings, afterSettings);
  for (const r2Key of removedKeys) {
    try {
      await enqueueR2Delete(sql, {
        tenantId,
        r2Key,
        source: 'image-clear',
      });
    } catch (err) {
      console.error(
        '[updateTemplateService] image-clear tombstone enqueue failed (non-fatal):',
        { tenantId, templateId, r2Key },
        err,
      );
    }
  }

  return { template: toDto(row) };
}

/**
 * Pick the template language for the Passcreator push.
 *
 * Falls back to 'zh-TW' when:
 *   - `settings.language` is undefined (legacy rows pre-2026-10-01)
 *   - `settings.language` is some other value not in the supported set
 *
 * Why 'zh-TW' as default: SAOME's primary market is Taiwan; the
 * fallback ensures the deployed pass renders Chinese labels by
 * default rather than English, which would be a worse failure mode
 * for the dominant user demographic.
 */
function pickTemplateLanguage(settings: TemplateSettings | undefined): PassLanguage {
  const lang = settings?.language;
  if (lang === 'en' || lang === 'zh-TW') return lang;
  return 'zh-TW';
}

/**
 * Publish a template (change status from draft to published).
 */
export async function publishTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
  env: HonoEnv['Bindings'] | unknown,
): Promise<UpdateTemplateResponse> {
  return updateTemplateService(sql, templateId, tenantId, env, undefined, undefined, undefined, 'published');
}

/**
 * Delete a template.
 *
 * R2 cleanup is async via the `r2_pending_deletes` tombstone + cron sweep
 * (every 5 min). The merged table-card PNG (`settings.tableCard.exportKey`)
 * is now enqueued alongside per-element imageKeys — see
 * `collectR2KeysForTemplate` in `./r2Keys`.
 *
 * @param sql - Database client
 * @param templateId - Template UUID
 * @param tenantId - Tenant ID from JWT (for ownership check)
 */
export async function deleteTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
): Promise<DeleteTemplateResponse> {
  const existing = await findTemplateById(sql, templateId);
  if (!existing || existing.tenant_id !== tenantId) {
    throw new NotFoundError('common.error.notFound', 'Template not found');
  }

  // Enqueue every R2 key owned by this template for async deletion
  // (plan `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50`,
  // 2026-10-03). The cron sweep at `src/index.ts::worker.scheduled`
  // picks them up on the next tick. The defensive unwrap mirrors the
  // same Bug #8 / #8.5 chain as the read path so a corrupted settings
  // column never crashes the delete.
  //
  // The enqueue is best-effort: a tombstone failure (DB outage,
  // unique-constraint explosion) must NOT fail the user-facing
  // delete — the row is removed either way, and the cron sweep is
  // the canonical cleanup path. Per-key failures inside
  // `enqueueTemplateR2Keys` are already caught by the helper; this
  // outer try/catch covers the helper itself throwing.
  const settings = unwrapCardSettings(existing.settings);
  try {
    await enqueueTemplateR2Keys(sql, tenantId, templateId, settings);
  } catch (err) {
    console.error(
      '[deleteTemplateService] R2 tombstone enqueue failed (non-fatal, DB row still being removed):',
      { tenantId, templateId },
      err,
    );
  }

  await deleteTemplate(sql, templateId);
  return { success: true };
}

/**
 * Touch a draft template — reset its expires_at to now() + 24h.
 * Called by frontend auto-save to keep drafts alive.
 */
export async function touchTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
): Promise<UpdateTemplateResponse> {
  // Ownership check
  const existing = await findTemplateById(sql, templateId);
  if (!existing || existing.tenant_id !== tenantId) {
    throw new NotFoundError('common.error.notFound', 'Template not found');
  }
  if (existing.status !== 'draft') {
    // Touching a published template is a no-op
    return { template: toDto(existing) };
  }
  const row = await touchExpiresAt(sql, templateId);
  return { template: toDto(row) };
}
