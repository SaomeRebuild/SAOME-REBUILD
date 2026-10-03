/**
 * r2_pending_deletes tombstone table — DB layer.
 *
 * @module modules/cards/db/r2PendingDeletes
 * @description Pure SQL functions for the `r2_pending_deletes` table.
 *
 * Why this table exists (2026-10-03 — plan `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50`):
 *   Workers Free plan HTTP request limit = 10ms CPU / 50 subrequests.
 *   A sync `bucket.delete(key)` inline on a user-facing route burns 1
 *   subrequest + ~50-200ms wall time + ~1-3ms CPU, leaving very little
 *   headroom for the rest of the handler.
 *
 *   This table is the tombstone: the user-facing route INSERTs a row
 *   and returns 204 immediately. The actual R2 delete happens inside
 *   the existing every-5-min cron handler in `src/index.ts::worker.scheduled`
 *   (Workers Free cron = 30s CPU / 1000 subrequests — different envelope).
 *
 * Sweep direction: see `src/index.ts::sweepR2PendingDeletes`.
 *
 * Migration: 020 (supabase/migrations/20261003000001_020_r2_pending_deletes.sql).
 */

import type { Sql } from '@/shared/db/client';

/** Allowed source values — must mirror the SQL CHECK constraint. */
export type R2DeleteSource =
  | 'table-card-element-delete'
  | 'template-delete'
  | 'image-clear';

/** A row in the r2_pending_deletes table. */
export interface R2PendingDeleteRow {
  id: string;
  tenant_id: string;
  r2_key: string;
  source: R2DeleteSource;
  created_at: Date;
  retry_count: number;
  last_error: string | null;
  completed_at: Date | null;
}

/** A pending row as returned to the cron sweep (id + r2_key + retry_count). */
export interface R2PendingDeleteSweepRow {
  id: string;
  r2_key: string;
  retry_count: number;
}

/**
 * Enqueue an R2 object for deletion by the cron sweep.
 *
 * Idempotent: if the same (tenant_id, r2_key) is enqueued twice (e.g. a
 * concurrent image-clear + a manual delete), the second INSERT is a
 * no-op via `ON CONFLICT DO NOTHING`. The UNIQUE constraint is
 * `UNIQUE(tenant_id, r2_key)`.
 *
 * `source` is opaque to the sweep — it just logs which call site
 * triggered the cleanup, useful for `wrangler tail` post-mortem.
 *
 * @returns `true` if a new row was inserted, `false` if it was a duplicate
 */
export async function enqueueR2Delete(
  sql: Sql,
  args: { tenantId: string; r2Key: string; source: R2DeleteSource },
): Promise<boolean> {
  const rows = await sql<{ inserted: boolean }[]>`
    INSERT INTO r2_pending_deletes (tenant_id, r2_key, source)
    VALUES (${args.tenantId}, ${args.r2Key}, ${args.source})
    ON CONFLICT (tenant_id, r2_key) DO NOTHING
    RETURNING (xmax = 0) AS inserted
  `;
  // ON CONFLICT DO NOTHING returns no row, so the array is empty in
  // the duplicate case. In that case rows[0] is undefined → return false.
  return rows[0]?.inserted ?? false;
}

/**
 * Fetch up to `limit` pending R2 deletes for the cron sweep.
 *
 * Only rows with `completed_at IS NULL` and `retry_count < 5` are
 * considered. Ordered by `created_at` ASC so the oldest (most stale)
 * rows are processed first.
 */
export async function fetchPendingR2Deletes(
  sql: Sql,
  limit: number,
): Promise<R2PendingDeleteSweepRow[]> {
  const rows = await sql<R2PendingDeleteSweepRow[]>`
    SELECT id, r2_key, retry_count
    FROM r2_pending_deletes
    WHERE completed_at IS NULL
      AND retry_count < 5
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return rows;
}

/**
 * Mark a row as successfully deleted.
 */
export async function markR2DeleteCompleted(
  sql: Sql,
  id: string,
): Promise<void> {
  await sql`
    UPDATE r2_pending_deletes
       SET completed_at = now()
     WHERE id = ${id}
  `;
}

/**
 * Increment `retry_count` and record the error message. Does NOT set
 * `completed_at` — the row stays in the queue for the next sweep.
 *
 * The caller is responsible for checking the returned `retry_count` and
 * deciding whether to give up. We do NOT auto-mark as failed here; the
 * SQL `retry_count < 5` predicate in `fetchPendingR2Deletes` is the
 * gatekeeper.
 */
export async function recordR2DeleteFailure(
  sql: Sql,
  id: string,
  errorMessage: string,
): Promise<void> {
  await sql`
    UPDATE r2_pending_deletes
       SET retry_count = retry_count + 1,
           last_error = ${errorMessage}
     WHERE id = ${id}
  `;
}
