/**
 * Card template service — business logic layer.
 *
 * @module modules/cards/services/cardService
 * @description Orchestrates card template operations: create, get, list, update, publish, delete.
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
 * @param sql - Database client
 * @param templateId - Template UUID
 * @param tenantId - Tenant ID from JWT (for ownership check)
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

  const row = await updateTemplate(sql, templateId, input);

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
 * Publish a template (change status from draft to published).
 */
export async function publishTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
): Promise<UpdateTemplateResponse> {
  return updateTemplateService(sql, templateId, tenantId, undefined, undefined, undefined, 'published');
}

/**
 * Delete a template.
 *
 * - draft → can be deleted (used by abandon flow + library grid)
 * - published → cannot be deleted via this route (use dedicated publish un-publish flow if needed)
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

  if (existing.status === 'published') {
    throw new Error('Published templates cannot be deleted via this route');
  }

  // Enqueue every R2 key owned by this template for async deletion
  // (plan `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50`,
  // 2026-10-03). The cron sweep at `src/index.ts::worker.scheduled`
  // picks them up on the next tick. The defensive unwrap mirrors the
  // same Bug #8 / #8.5 chain as the read path so a corrupted settings
  // column never crashes the delete.
  const settings = unwrapCardSettings(existing.settings);
  await enqueueTemplateR2Keys(sql, tenantId, templateId, settings);

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
