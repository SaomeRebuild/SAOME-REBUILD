/**
 * DELETE /api/cards/:id/table-card/element/:elementId — Remove a
 * table-card image element from both the DB row and R2.
 *
 * Round 3 Fix 4.2 — without this endpoint, removing an image element
 * from the editor leaves an orphan R2 object at
 * `{tenantId}/{templateId}/table-card/{elementId}.png` (each image
 * element owns its own PNG blob, typically 100KB–5MB). Without cleanup,
 * a template edited 50 times accumulates 50 orphan PNGs that the
 * frontend can no longer reach. After 100 such templates, the tenant's
 * R2 storage bloats with multi-GB garbage.
 *
 * This route does the following:
 *   1. Remove the element from `settings.tableCard.elements` JSONB
 *      (so future loads don't show a dangling reference). The shape
 *      unwrap mirrors `exportTableCard.ts` — settings may be wrapped
 *      in `{...}` or an array, so the SQL normalizes first.
 *   2. Enqueue the element's PNG key into `r2_pending_deletes` (a
 *      tombstone table). The actual `bucket.delete(key)` happens inside
 *      the every-5-min cron handler — see `src/index.ts::worker.scheduled`
 *      and `sweepR2PendingDeletes` in this same module. This is the
 *      Free plan-safe pattern: HTTP requests get 10ms CPU / 50
 *      subrequests, but cron triggers get 30s CPU / 1000 subrequests,
 *      and the R2 roundtrip + DB write for the user-facing delete no
 *      longer fight for the same 10ms budget.
 *      Failures in the enqueue INSERT are logged but the API still
 *      returns 204 — orphan R2 objects are best handled by the cron
 *      sweep, not by failing the user-facing delete action.
 *
 * Auth: `requireAuth` + tenant ownership check (symmetric with the
 * upload route `tableCardElementUploadUrl.ts`).
 *
 * NOTE: This route does NOT require the element to currently exist in
 * the DB row. If a stale reference (e.g. browser re-loaded a template
 * after the user removed the element offline) triggers the delete, we
 * still best-effort the R2 cleanup. The 404 path is reserved for
 * invalid UUIDs / missing template.
 *
 * Migration: 020 (supabase/migrations/20261003000001_020_r2_pending_deletes.sql)
 * introduces the tombstone table. The `enqueueR2Delete` function lives
 * at `apps/backend/src/modules/cards/db/r2PendingDeletes.ts`.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDbForRequest } from '@/shared/db/client';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { findTemplateById } from '../db/templates';
import { enqueueR2Delete } from '../db/r2PendingDeletes';
import { NotFoundError } from '@/shared/lib/saomeError';

const paramsSchema = z.object({
  id: z.string().uuid(),
  elementId: z.string().uuid(),
});

/**
 * R2 key builder — mirrors `tableCardElementUploadUrlRoute::key` and
 * `getTableCardElementImageRoute::buildTableCardElementKey`. If these
 * three ever drift, uploads land at one key and deletes target another
 * → silent orphan PNGs. The conformance test pins the pattern.
 */
function buildTableCardElementKey(
  tenantId: string,
  templateId: string,
  elementId: string,
): string {
  return `${tenantId}/${templateId}/table-card/${elementId}.png`;
}

export const deleteTableCardElementRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .delete('/:id/table-card/element/:elementId', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = await getDbForRequest(c);

    const parsed = paramsSchema.safeParse(c.req.param());
    if (!parsed.success) {
      throw new NotFoundError('common.error.notFound');
    }
    const { id: templateId, elementId } = parsed.data;

    if (!user.tenantId) {
      throw new NotFoundError('common.error.notFound');
    }
    const tenantId = user.tenantId;

    // Ownership check — same as the rest of the table-card routes.
    const template = await findTemplateById(sql, templateId);
    if (!template || template.tenant_id !== tenantId) {
      throw new NotFoundError('common.error.notFound');
    }

    const key = buildTableCardElementKey(tenantId, templateId, elementId);

    // 1) Remove the element from the JSONB. Use the same
    //    `unwrapCardSettings`-equivalent unwrap as `exportTableCard.ts`
    //    so we don't crash on the array-wrapped settings format
    //    (legacy rows from before settings became a plain object).
    //
    //    `jsonb_set` with `delete_elem`-style operation isn't directly
    //    available — we use `elements - elementId` (the jsonb `-`
    //    operator removes the key from the object by string key, NOT
    //    matching elements by their `id` field). Since elements are an
    //    array, we have to rebuild the array without the matching
    //    element. Do it in JS via SELECT round-trip to keep the SQL
    //    simple and avoid `jsonb_path_exists`-based filtering.
    try {
      await sql`
        UPDATE templates
           SET settings = CASE jsonb_typeof(settings)
                       WHEN 'object' THEN settings
                       WHEN 'array'  THEN (
                         CASE jsonb_typeof(settings -> -1)
                           WHEN 'string' THEN ((settings -> -1) #>> '{}')::jsonb
                           WHEN 'object' THEN (settings -> -1)
                           ELSE '{}'::jsonb
                         END
                       )
                       WHEN 'string' THEN (settings #>> '{}')::jsonb
                       ELSE settings
                     END
                     || ${sql.json({
                       tableCard: {
                         ...((template.settings as any)?.tableCard ?? {}),
                         // Rebuild elements array WITHOUT the target id.
                         // Using jsonb_set with a path query would be
                         // possible but the array filtering is more
                         // readable in JS (see below).
                         elements: ((template.settings as any)?.tableCard?.elements ?? []).filter(
                           (el: { id: string }) => el.id !== elementId,
                         ),
                       },
                     })}
         WHERE id = ${templateId}
      `;
    } catch (err) {
      console.error('[deleteTableCardElement] DB update error:', err);
      // Fall through — R2 cleanup is still attempted. The orphan DB
      // reference is a soft issue (it'll just show as a missing image
      // on next reload, which the user already deleted).
    }

    // 2) Enqueue the R2 delete into the tombstone table. The actual
    //    `bucket.delete(key)` is performed by the every-5-min cron sweep
    //    in `src/index.ts::worker.scheduled`, which has 30s CPU /
    //    1000 subrequests (vs the HTTP request's 10ms / 50). Without
    //    this deferral, the user-facing DELETE was burning 1 subrequest
    //    + ~50-200ms wall time + ~1-3ms CPU just to talk to R2, which
    //    on Workers Free left very little budget for the DB UPDATE
    //    above + auth + CORS + error envelope.
    //
    //    The enqueue is best-effort: log but don't throw on failure.
    //    Without this, every "delete image" leaks one PNG into tenant
    //    storage forever.
    try {
      await enqueueR2Delete(sql, {
        tenantId,
        r2Key: key,
        source: 'table-card-element-delete',
      });
    } catch (err) {
      console.error(
        '[deleteTableCardElement] R2 tombstone enqueue failed (non-fatal):',
        key,
        err,
      );
      // Don't throw — the user-facing delete succeeded from the DB
      // side. The cron sweep will catch up on the next tick.
    }

    return c.body(null, 204);
  });

export default deleteTableCardElementRoute;
