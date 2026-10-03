/**
 * R2 pending-deletes sweep — the cron half of the
 * "tombstone + cron sweep" pattern.
 *
 * @module index.r2Sweep
 * @description Pure function that drains rows from the
 * `r2_pending_deletes` tombstone table by issuing `bucket.delete()`.
 *
 * Lives in its own file (not `index.ts`) so the test can import it
 * without dragging in the full Hono app graph (`index.ts` imports
 * `cardsModule` which transitively imports `cardService.ts` which
 * depends on `@saome/shared/logic/cardSettings`).
 *
 * Plan: `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50`
 * (2026-10-03)
 */

import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import {
  fetchPendingR2Deletes,
  markR2DeleteCompleted,
  recordR2DeleteFailure,
} from '@/modules/cards/db/r2PendingDeletes';

/**
 * Sweep pending R2 deletes from the `r2_pending_deletes` tombstone table.
 *
 * Loop semantics:
 *   - Pull up to `limit` unfinished rows (retry_count < 5) ordered by
 *     created_at ASC (oldest first, so stale rows don't starve).
 *   - For each: try `bucket.delete(r2_key)`, on success mark
 *     `completed_at = now()`, on failure increment `retry_count` and
 *     record the error message. The row stays unfinished and is
 *     re-tried on the next tick (unless retry_count hits 5, at which
 *     point `fetchPendingR2Deletes` will stop returning it).
 *   - Stop early if `Date.now() > deadline` (5s safety buffer for the
 *     30s Free plan cron CPU limit). The next tick picks up where we
 *     left off — the partial sweep is harmless because every delete is
 *     idempotent (R2's `bucket.delete` is a no-op if the key is gone).
 *
 * @param env - Worker bindings (HYPERDRIVE + ASSETS)
 * @param options.limit - Max rows to process in this tick (default 200)
 * @param options.deadline - Stop the loop when `Date.now()` exceeds this
 * @returns Counts of processed / succeeded / failed rows
 */
export async function sweepR2PendingDeletes(
  env: HonoEnv['Bindings'],
  options: { limit?: number; deadline: number } = { deadline: Date.now() + 25_000 },
): Promise<{ processed: number; succeeded: number; failed: number; skipped: number }> {
  const limit = options.limit ?? 200;
  const deadline = options.deadline;
  const sql = await getDb(env.HYPERDRIVE);
  const bucket = env.ASSETS;

  const rows = await fetchPendingR2Deletes(sql, limit);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    // 5-second safety buffer so we exit before the 30s cron CPU limit
    if (Date.now() > deadline - 5000) {
      skipped = rows.length - processed;
      break;
    }
    try {
      await bucket.delete(row.r2_key);
      await markR2DeleteCompleted(sql, row.id);
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      try {
        await recordR2DeleteFailure(sql, row.id, msg);
      } catch (recordErr) {
        // The R2 delete failed AND we can't even record the failure —
        // log loudly so the next tick's fetchPendingR2Deletes can still
        // see the row (its retry_count stays at the old value).
        console.error(
          '[sweepR2PendingDeletes] recordR2DeleteFailure also failed:',
          { rowId: row.id, r2Key: row.r2_key },
          recordErr,
        );
      }
      failed++;
    }
    processed++;
  }

  return { processed, succeeded, failed, skipped };
}
