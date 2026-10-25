/**
 * `pass_events` table queries — pass-templates module.
 *
 * @module modules/pass-templates/db/passEvents
 * @description Pure SQL functions for the append-only Pass runtime
 * value event ledger (migration 028).
 *
 * WHY AN EVENT LEDGER
 *
 * A holder's runtime values (points balance, spend, expiry) change over
 * time. Storing only the CURRENT value loses the "why"; storing it in
 * a mutable counter column loses the atomicity (every write is a
 * read-modify-write race). An append-only ledger avoids both: writes
 * are pure inserts, and the current state is the fold of the events.
 *
 * The fold's RESULT is cached in `pass_holders.pass_values_snapshot`
 * so the hot read path stays a single-row read. The snapshot is a CACHE
 * — this module's `listPassEvents` can always rebuild it.
 *
 * JSONB SAFETY (Rule 032 § 1)
 *
 * The `payload` column holds a `PassEvent`-shaped JSONB object. It is
 * ALWAYS written through `${sql.json(...)}` (never a manual
 * `JSON.stringify(...)::jsonb` cast — the workerd runtime corrupts
 * non-ASCII through that path, Rule 027 § workerd pitfall), and it is
 * ALWAYS validated by `passEventSchema` before it reaches SQL.
 *
 * Rule references:
 *   - Rule 000 Part B.4 — DB queries live in `db/<table>.ts`, never in
 *     a route or a service.
 *   - Rule 027 § tagged template injection + § workerd `sql.json()`.
 *   - Rule 032 § 1 — validate jsonb in the application layer.
 *
 * @see apps/backend/src/modules/pass-templates/services/passValueService.ts
 * @see packages/shared/schemas/passValues.ts
 */

import type { Sql } from '@/shared/db/client';
import type { PassEvent } from '@saome/shared/schemas/passValues';

/**
 * A row in the `pass_events` ledger.
 *
 * `payload` is stored as raw JSONB and is validated against
 * `passEventSchema` at the service layer, not here — the DB layer
 * only cares about the column shape.
 */
export interface PassEventRow {
  id: string;
  pass_holder_id: string;
  event_type: string;
  payload: unknown;
  occurred_at: Date | string;
  created_at: Date | string;
  idempotency_key: string | null;
}

/**
 * The result of appending an event.
 *
 * `inserted` distinguishes a first write from an idempotent replay.
 * The service uses it only for observability; the authoritative state
 * is always rebuilt by replaying the ledger.
 */
export interface AppendPassEventResult {
  row: PassEventRow;
  inserted: boolean;
}

/**
 * Append one event to the ledger.
 *
 * The caller is responsible for having validated `event` against
 * `passEventSchema` (the service layer does this) — this function
 * only persists.
 *
 * IDEMPOTENCY
 *
 * When `idempotencyKey` is provided, the unique constraint
 * `pass_events_holder_idempotency_unique` makes a duplicate insert a
 * no-op: the function returns the EXISTING row instead of inserting a
 * second one. That is what makes "apply the same event twice" safe —
 * which matters because the registration flow can legitimately be
 * retried.
 *
 * The conflict path uses `ON CONFLICT ... DO NOTHING` — a TRUE
 * append-only ledger never rewrites an existing row, not even to
 * re-write the same values. (Postgres treats NULLs as distinct in a
 * unique index, so events WITHOUT an idempotency key never collide —
 * which is the intended behaviour: only explicitly-keyed events
 * de-duplicate.)
 *
 * `DO NOTHING` returns NO rows on conflict, so the duplicate path
 * costs one extra SELECT. That is deliberate: it happens only on the
 * rare retry path, and it keeps the ledger strictly append-only.
 *
 * @param sql            - postgres.js instance.
 * @param passHolderId   - The holder whose ledger this event belongs to.
 * @param event          - The validated event (its `type` + `payload`).
 * @param idempotencyKey - Optional de-duplication key, scoped per holder.
 * @returns              - The persisted row (the existing one on a
 *                         duplicate).
 */
export async function appendPassEvent(
  sql: Sql,
  passHolderId: string,
  event: PassEvent,
  idempotencyKey?: string | null,
): Promise<AppendPassEventResult> {
  const rows = await sql<PassEventRow[]>`
    INSERT INTO public.pass_events (
      pass_holder_id,
      event_type,
      payload,
      occurred_at,
      idempotency_key
    ) VALUES (
      ${passHolderId},
      ${event.type},
      ${sql.json(event.payload as Parameters<typeof sql.json>[0])},
      ${event.at},
      ${idempotencyKey ?? null}
    )
    ON CONFLICT (pass_holder_id, idempotency_key) DO NOTHING
    RETURNING id, pass_holder_id, event_type, payload,
              occurred_at, created_at, idempotency_key
  `;

  const inserted = rows[0];
  if (inserted) return { row: inserted, inserted: true };

  // Conflict — fetch the row that is already there.
  if (idempotencyKey) {
    const existing = await findPassEventByIdempotencyKey(
      sql,
      passHolderId,
      idempotencyKey,
    );
    if (existing) return { row: existing, inserted: false };
  }

  throw new Error(
    `[appendPassEvent] no row returned for holder ${passHolderId}`,
  );
}

/**
 * List every event for a holder, in the order the reducer expects
 * (oldest first by occurrence time).
 *
 * The secondary sort key is `created_at` then `id` so that events
 * sharing an `occurred_at` timestamp have a STABLE, total order —
 * without it, two events inside the same second could replay in
 * different orders on different reads, and the derived snapshot would
 * not be reproducible.
 */
export async function listPassEvents(
  sql: Sql,
  passHolderId: string,
): Promise<PassEventRow[]> {
  return await sql<PassEventRow[]>`
    SELECT id, pass_holder_id, event_type, payload,
           occurred_at, created_at, idempotency_key
      FROM public.pass_events
     WHERE pass_holder_id = ${passHolderId}
     ORDER BY occurred_at ASC, created_at ASC, id ASC
  `;
}

/**
 * Look up a single event by its idempotency key.
 *
 * Returns `null` when the holder has no event with that key — the
 * caller uses this to decide whether an event is a duplicate.
 */
export async function findPassEventByIdempotencyKey(
  sql: Sql,
  passHolderId: string,
  idempotencyKey: string,
): Promise<PassEventRow | null> {
  const rows = await sql<PassEventRow[]>`
    SELECT id, pass_holder_id, event_type, payload,
           occurred_at, created_at, idempotency_key
      FROM public.pass_events
     WHERE pass_holder_id = ${passHolderId}
       AND idempotency_key = ${idempotencyKey}
     LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Count a holder's events.
 *
 * Used by the backfill dry-run to report how many holders already have
 * a ledger (and therefore must be skipped).
 */
export async function countPassEvents(
  sql: Sql,
  passHolderId: string,
): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count
      FROM public.pass_events
     WHERE pass_holder_id = ${passHolderId}
  `;
  return Number(rows[0]?.count ?? '0');
}
