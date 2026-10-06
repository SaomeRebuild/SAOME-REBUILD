/**
 * Pure helpers for tracking which R2 keys belong to a template.
 *
 * @module modules/cards/services/r2Keys
 * @description Collection / diff functions used by the
 * `r2_pending_deletes` tombstone workflow (plan
 * `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50`).
 *
 * Lives in its own file (not `cardService.ts`) because cardService
 * imports `@saome/shared/logic/cardSettings` which is hard to resolve
 * in the workerd test pool. The pure helpers here have NO
 * shared/logic dependency, so they can be unit-tested in isolation.
 *
 * Three places use these helpers:
 *   1. `cardService::deleteTemplateService` — enumerate all keys,
 *      enqueue each via `enqueueR2Delete(source='template-delete')`
 *   2. `cardService::updateTemplateService` — diff before/after
 *      settings, enqueue removed keys (`source='image-clear'`)
 *   3. (none yet) Hypothetical cleanup script for historical orphans.
 */

import { enqueueR2Delete, type R2DeleteSource } from '../db/r2PendingDeletes';
import type { Sql } from '@/shared/db/client';

/**
 * Collect every R2 object key owned by a template, so the caller can
 * enqueue them all for async deletion BEFORE removing the DB row.
 *
 * This was a pre-existing orphan leak (2026-10-03 audit): the
 * `DELETE /api/cards/:id` route removed the DB row but left every PNG
 * under `{tenantId}/{templateId}/*` in R2 forever. Now that the
 * `r2_pending_deletes` tombstone + cron sweep pattern is in place,
 * this helper enumerates the keys and enqueues each one.
 *
 * Why pure (no DB writes): the caller may want to test the key
 * collection logic in isolation, and we want to keep the service layer
 * free of side effects that aren't obvious from the function name.
 *
 * @param settings - The unwrapped settings object (after the Bug #8 / #8.5
 *   defensive unwrap) — i.e. always a plain object, never an array/string.
 */
export function collectR2KeysForTemplate(
  tenantId: string,
  templateId: string,
  settings: Record<string, unknown>,
): string[] {
  const keys = new Set<string>();

  // Top-level R2 image references
  if (typeof settings.issuerLogo === 'string') keys.add(settings.issuerLogo);
  if (typeof settings.backgroundImage === 'string') keys.add(settings.backgroundImage);
  if (typeof settings.iconImage === 'string') keys.add(settings.iconImage);

  // Table-card related keys — collapsed into a single type-check so the
  // prefix guard covers both the merged export PNG and per-element image
  // uploads under the same `{tenantId}/{templateId}/table-card/...` subtree.
  const tableCard = settings.tableCard as
    | {
        exportKey?: unknown;
        elements?: Array<{ type?: string; imageKey?: string }>;
      }
    | undefined;
  if (tableCard) {
    // Merged export PNG (single key per template) — written by
    // `routes/exportTableCard.ts` to `{tenantId}/{templateId}/table-card-export.png`.
    // Prefix guard prevents accidentally enqueuing another tenant's key
    // if the JSONB column is corrupted.
    if (
      typeof tableCard.exportKey === 'string' &&
      tableCard.exportKey.startsWith(`${tenantId}/${templateId}/`)
    ) {
      keys.add(tableCard.exportKey);
    }

    // Per-element PNGs uploaded into the Step 7 canvas.
    for (const el of tableCard.elements ?? []) {
      if (el?.type === 'image' && typeof el.imageKey === 'string') {
        const expectedPrefix = `${tenantId}/${templateId}/table-card/`;
        if (el.imageKey.startsWith(expectedPrefix)) {
          keys.add(el.imageKey);
        }
      }
    }
  }

  return Array.from(keys);
}

/**
 * Diff top-level imageKey-bearing fields between two settings objects
 * and return the R2 keys that were REMOVED (i.e. present in `before`
 * but absent or changed in `after`).
 *
 * Per-element imageKey diffing (settings.tableCard.elements[].imageKey)
 * is handled by `collectR2KeysForTemplate` semantics on both sides —
 * we collect keys from each, then take the set difference.
 *
 * This is used by `updateTemplateService` to detect when an imageKey
 * is cleared or replaced (e.g. user re-uploads a logo with a NEW key
 * at the same logical slot), so we can enqueue the old R2 object for
 * async deletion via the `r2_pending_deletes` tombstone.
 *
 * @returns R2 keys that existed in `before` but are GONE from `after`.
 */
export function diffRemovedR2Keys(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const beforeKeys = new Set<string>();
  const afterKeys = new Set<string>();

  for (const field of ['issuerLogo', 'backgroundImage', 'iconImage'] as const) {
    if (typeof before[field] === 'string') beforeKeys.add(before[field] as string);
    if (typeof after[field] === 'string') afterKeys.add(after[field] as string);
  }

  // Per-element imageKey diffing
  const beforeTableCard = before.tableCard as
    | { elements?: Array<{ type?: string; imageKey?: string }> }
    | undefined;
  const afterTableCard = after.tableCard as
    | { elements?: Array<{ type?: string; imageKey?: string }> }
    | undefined;

  for (const el of beforeTableCard?.elements ?? []) {
    if (el?.type === 'image' && typeof el.imageKey === 'string') {
      beforeKeys.add(el.imageKey);
    }
  }
  for (const el of afterTableCard?.elements ?? []) {
    if (el?.type === 'image' && typeof el.imageKey === 'string') {
      afterKeys.add(el.imageKey);
    }
  }

  return Array.from(beforeKeys).filter((k) => !afterKeys.has(k));
}

/**
 * Enqueue every R2 key belonging to a template for async deletion.
 *
 * Called by `deleteTemplateService` BEFORE the DB row is removed, so
 * the cron sweep can pick them up. `source: 'template-delete'` is
 * stamped on each row for post-mortem.
 *
 * Errors from individual enqueues are logged but don't fail the whole
 * delete — a partial enqueue is still better than no enqueue.
 */
export async function enqueueTemplateR2Keys(
  sql: Sql,
  tenantId: string,
  templateId: string,
  settings: Record<string, unknown>,
): Promise<{ enqueued: number; skipped: number }> {
  const keys = collectR2KeysForTemplate(tenantId, templateId, settings);
  const source: R2DeleteSource = 'template-delete';
  let enqueued = 0;
  let skipped = 0;
  for (const r2Key of keys) {
    try {
      const inserted = await enqueueR2Delete(sql, { tenantId, r2Key, source });
      if (inserted) enqueued++;
      else skipped++;
    } catch (err) {
      // Log and continue — a single key failing to enqueue shouldn't
      // block the template deletion.
      console.error(
        '[enqueueTemplateR2Keys] failed to enqueue',
        { tenantId, templateId, r2Key },
        err,
      );
      skipped++;
    }
  }
  if (enqueued > 0 || skipped > 0) {
    console.log(
      `[enqueueTemplateR2Keys] template=${templateId} enqueued=${enqueued} skipped=${skipped} (duplicates)`,
    );
  }
  return { enqueued, skipped };
}
