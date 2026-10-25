/**
 * passValueService — the backend's Pass runtime value state layer.
 *
 * @module modules/pass-templates/services/passValueService
 * @description Applies runtime-value events to a holder's ledger and
 * pushes the derived snapshot to Passcreator.
 *
 * THE TRANSACTION BOUNDARY (the important part)
 *
 * ```
 *   ┌── DB transaction ──────────────────────────────┐
 *   │ 1. append the event (append-only)              │
 *   │ 2. replay the whole ledger → snapshot          │
 *   │ 3. write the snapshot cache                    │
 *   └────────────────────────────────────────────────┘
 *                    ↓ COMMIT
 *   ┌── Passcreator PATCH (outside the transaction) ─┐
 *   │ 4. format the snapshot → PATCH → read-back     │
 *   └────────────────────────────────────────────────┘
 * ```
 *
 * The external API call is DELIBERATELY outside the transaction:
 *
 *   - The ledger is the source of truth. A Passcreator outage must
 *     not roll back a fact that genuinely happened (a purchase, a
 *     scan). The event stays committed, and the sync is retried from
 *     the snapshot — which never re-adds the delta.
 *   - Holding a Postgres transaction open across a network call to a
 *     third party burns a pooled connection for the duration of the
 *     upstream round-trip.
 *
 * WHY THE LEDGER IS REPLAYED RATHER THAN INCREMENTED
 *
 * `applyPassEvent` re-reads the holder's ENTIRE event list and folds
 * it with the shared reducer (`reducePassValues`). It does not read
 * the current snapshot and add the delta. Two reasons:
 *
 *   1. The snapshot is a CACHE, not the truth. Replaying makes the
 *      cache self-healing: a snapshot that drifted (or a row written
 *      by an older code path) is corrected by the next event.
 *   2. It keeps ONE derivation. Registration and every later event
 *      go through the same pure function, so "what a registration
 *      means" is written down exactly once.
 *
 * IDEMPOTENCE
 *
 * `idempotencyKey` is scoped per holder and enforced by the DB's
 * UNIQUE constraint. A duplicate insert is a no-op — the service
 * receives the EXISTING row, replays the ledger, and reports
 * `duplicate: true`. The value is therefore never applied twice,
 * which is what makes a retried request safe.
 *
 * Rule references:
 *   - Rule 000 Part B.4 — DB queries live in `db/<table>.ts`; this
 *     file is the ORCHESTRATION layer (transaction + external call).
 *   - Rule 032 § 1 — the event payload is validated with Zod BEFORE
 *     it reaches SQL.
 *   - Rule 027 — JSONB writes go through `sql.json()` (in the db
 *     layer), never a manual `JSON.stringify(...)::jsonb` cast.
 *   - Rule 019 § 4.1 — Layer 2 (backend service) mirrors Layer 1
 *     (`packages/shared/schemas/passValues.ts`).
 *
 * @see apps/backend/src/modules/pass-templates/db/passEvents.ts
 * @see packages/shared/logic/passValueCalculator.ts
 * @see packages/shared/logic/passFieldFormatter.ts
 * @see runs/decisions/2026-10-24-pass-runtime-value-model.md
 */

import type { Sql } from '@/shared/db/client';
import type { HonoEnv } from '@/shared/types/bindings';
import {
  appendPassEvent,
  listPassEvents,
  type PassEventRow,
} from '../db/passEvents';
import { updatePassHolderPassValuesSnapshot } from '../db/passHolders';
import { updatePassValues } from '@/shared/lib/passcreator';
import type { PassUpdateResult } from '@/shared/lib/passcreator';
import { formatPassValues } from '@saome/shared/logic/passFieldFormatter';
import { reducePassValues } from '@saome/shared/logic/passValueCalculator';
import {
  passEventSchema,
  passValuesSnapshotSchema,
  type PassEvent,
  type PassValuesSnapshot,
} from '@saome/shared/schemas/passValues';
import type { CardType } from '@saome/shared/schemas/card';
import type { CardFieldKey } from '@saome/shared/constants/card-fields';

/**
 * Where a holder's values should be pushed after the ledger commit.
 *
 * The sync is OPTIONAL: a caller that only wants to record the fact
 * (e.g. the registration flow, where the pass does not exist yet)
 * omits it entirely.
 */
export interface PassEventSyncTarget {
  /** Worker bindings — the Passcreator credentials live here. */
  env: HonoEnv['Bindings'];
  /** The per-pass identifier issued by Passcreator. */
  passIdentifier: string;
  /**
   * The template's card type. Decides which header slot the value
   * lands in (see `packages/shared/constants/headerSlots.ts`).
   */
  cardType: CardType | null | undefined;
  /**
   * The template's BOUND face field keys (the Step 3 left / right
   * slots). Only keys the template binds are sent upstream.
   */
  boundFieldKeys?: readonly (CardFieldKey | null | undefined)[];
}

/** Input for `applyPassEvent`. */
export interface ApplyPassEventInput {
  /** postgres.js instance (the caller owns the pool lifetime). */
  sql: Sql;
  /** The holder whose ledger the event belongs to. */
  passHolderId: string;
  /** The event to record. Validated with `passEventSchema` here. */
  event: PassEvent;
  /**
   * Optional de-duplication key, scoped per holder. Two events with
   * the same key are the same fact.
   */
  idempotencyKey?: string | null;
  /** Optional Passcreator sync target (runs AFTER the commit). */
  sync?: PassEventSyncTarget;
}

/** The outcome of `applyPassEvent`. */
export interface ApplyPassEventResult {
  /** The id of the appended (or pre-existing) ledger row. */
  eventId: string;
  /** True when the event was already in the ledger (idempotent replay). */
  duplicate: boolean;
  /** The snapshot derived by replaying the ledger. */
  snapshot: PassValuesSnapshot;
  /** The Passcreator sync verdict — present only when a sync was requested. */
  syncResult?: PassUpdateResult;
}

/**
 * Convert a ledger row into a validated event.
 *
 * The row's `payload` is re-validated against `passEventSchema`
 * rather than trusted: the JSONB column is writable by any future
 * code path, and a malformed payload must fail loudly here rather
 * than silently corrupting the derived snapshot.
 *
 * `occurred_at` arrives as a `Date` from postgres.js (or as an ISO
 * string from a test double) — both are normalised to an ISO
 * timestamp so the reducer's ordering is well-defined.
 */
function toPassEvent(row: PassEventRow): PassEvent {
  const at =
    row.occurred_at instanceof Date
      ? row.occurred_at.toISOString()
      : String(row.occurred_at);
  return passEventSchema.parse({
    type: row.event_type,
    at,
    payload: row.payload,
  });
}

/**
 * Apply one runtime-value event to a holder's ledger.
 *
 * @throws {ZodError} when the event does not satisfy `passEventSchema`
 *         (the validation happens BEFORE any SQL runs).
 * @throws {BadGatewayError} when the optional Passcreator sync fails.
 *         The DB work is already committed at that point — the caller
 *         may retry with the SAME idempotency key and the value will
 *         not be applied twice.
 */
export async function applyPassEvent(
  input: ApplyPassEventInput,
): Promise<ApplyPassEventResult> {
  const { sql, passHolderId, event, idempotencyKey, sync } = input;

  // 1. Validate BEFORE opening a transaction — an invalid payload
  //    must never reach SQL (Rule 032 § 1).
  const validated = passEventSchema.parse(event);

  // 2. Append + replay + snapshot write, all inside ONE transaction.
  const committed = await sql.begin(async (tx) => {
    const appended = await appendPassEvent(
      tx as unknown as Sql,
      passHolderId,
      validated,
      idempotencyKey ?? null,
    );
    const rows = await listPassEvents(tx as unknown as Sql, passHolderId);
    const derived = passValuesSnapshotSchema.parse(
      reducePassValues(rows.map(toPassEvent)),
    );
    await updatePassHolderPassValuesSnapshot(
      tx as unknown as Sql,
      passHolderId,
      derived,
    );
    return {
      eventId: appended.row.id,
      duplicate: !appended.inserted,
      snapshot: derived,
    };
  });

  // 3. Push to Passcreator AFTER the commit. A failure here leaves
  //    the ledger + snapshot intact (the whole point of the boundary).
  let syncResult: PassUpdateResult | undefined;
  if (sync) {
    syncResult = await syncValuesToPasscreator({
      env: sync.env,
      passIdentifier: sync.passIdentifier,
      snapshot: committed.snapshot,
      cardType: sync.cardType,
      boundFieldKeys: sync.boundFieldKeys,
    });
  }

  return {
    eventId: committed.eventId,
    duplicate: committed.duplicate,
    snapshot: committed.snapshot,
    ...(syncResult ? { syncResult } : {}),
  };
}

/**
 * The partial unique index migration 029 added.
 *
 * It is the DB-level guarantee for "a holder has AT MOST ONE
 * `registered` event" — a guarantee the `UNIQUE (pass_holder_id,
 * idempotency_key)` constraint cannot give, because a second
 * `registered` row under a DIFFERENT key slips past it.
 */
export const ONE_REGISTERED_PER_HOLDER_CONSTRAINT =
  'pass_events_one_registered_per_holder_idx';

/**
 * Is this error the partial unique index rejecting a second
 * `registered` event for the same holder?
 *
 * Postgres reports it as SQLSTATE `23505` (`unique_violation`) with
 * the index name in the `constraint_name` field. postgres.js copies
 * the raw error fields onto the thrown `PostgresError`, so both
 * `constraint_name` and the shorter `constraint` alias are checked.
 *
 * The check is deliberately NARROW: a `23505` from any OTHER
 * constraint (or a connection error, or a syntax error) must keep
 * propagating. Swallowing those would turn a real fault into a
 * silently "replayed" state — the exact failure mode this whole
 * mechanism exists to prevent.
 */
export function isOneRegisteredPerHolderViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;

  const candidate = err as {
    code?: unknown;
    constraint?: unknown;
    constraint_name?: unknown;
    message?: unknown;
  };

  if (candidate.code !== '23505') return false;

  const constraintName =
    typeof candidate.constraint_name === 'string'
      ? candidate.constraint_name
      : typeof candidate.constraint === 'string'
        ? candidate.constraint
        : null;

  if (constraintName !== null) {
    return constraintName === ONE_REGISTERED_PER_HOLDER_CONSTRAINT;
  }

  // Fallback for drivers that do not surface the constraint field:
  // Postgres always names the offending index in the message
  // (`duplicate key value violates unique constraint "<index>"`).
  return (
    typeof candidate.message === 'string' &&
    candidate.message.includes(ONE_REGISTERED_PER_HOLDER_CONSTRAINT)
  );
}

/**
 * The outcome of replaying a holder's ledger WITHOUT appending.
 *
 * This is the shape the migration-029 conflict path returns: the
 * holder's opening event already exists, so the ledger is read back
 * and re-folded instead of a second event being written.
 */
export interface PassRuntimeReplayResult {
  /** The id of the holder's opening (`registered`) event. */
  eventId: string;
  /** Always true — a replay never appends. */
  duplicate: true;
  /** The snapshot derived by replaying the ledger. */
  snapshot: PassValuesSnapshot;
}

/**
 * Replay a holder's ledger WITHOUT appending anything.
 *
 * WHY THIS EXISTS
 *
 * `appendPassEvent` inserts with
 * `ON CONFLICT (pass_holder_id, idempotency_key) DO NOTHING`. That
 * arbiter absorbs a replay of the SAME fact (same holder, same key),
 * but it cannot absorb the partial unique index migration 029 added —
 * `pass_events_one_registered_per_holder_idx` rejects a second
 * `registered` row for the same holder under a DIFFERENT key, and a
 * partial index cannot be named in an `ON CONFLICT` clause.
 *
 * So the DB is the arbiter for that invariant, and the rejection comes
 * back as SQLSTATE 23505. This function is the READ side of that
 * contract: re-read the ledger, re-fold it, refresh the snapshot
 * cache, and report the opening event's id. The caller turns the
 * rejection into `duplicate: true` instead of a 500.
 *
 * The snapshot write is kept (it is a CACHE — Rule: the ledger is the
 * source of truth), and it happens inside ONE transaction with the
 * read, exactly like `applyPassEvent`.
 *
 * @throws {Error} when the holder's ledger holds no opening event —
 *         a 23505 without a `registered` row means the ledger and the
 *         index disagree, which is a real fault, not a replay.
 */
export async function replayPassRuntimeState(
  sql: Sql,
  passHolderId: string,
): Promise<PassRuntimeReplayResult> {
  const replayed = await sql.begin(async (tx) => {
    const rows = await listPassEvents(tx as unknown as Sql, passHolderId);
    const snapshot = passValuesSnapshotSchema.parse(
      reducePassValues(rows.map(toPassEvent)),
    );
    await updatePassHolderPassValuesSnapshot(
      tx as unknown as Sql,
      passHolderId,
      snapshot,
    );
    const opening = rows.find((row) => row.event_type === 'registered');
    return { openingId: opening?.id ?? null, snapshot };
  });

  if (!replayed.openingId) {
    throw new Error(
      `[replayPassRuntimeState] holder ${passHolderId} has no opening event`,
    );
  }

  return {
    eventId: replayed.openingId,
    duplicate: true,
    snapshot: replayed.snapshot,
  };
}

/** Input for `syncValuesToPasscreator`. */
export interface SyncValuesInput {
  /** Worker bindings — the Passcreator credentials live here. */
  env: HonoEnv['Bindings'];
  /** The per-pass identifier issued by Passcreator. */
  passIdentifier: string;
  /** The snapshot to push. */
  snapshot: PassValuesSnapshot;
  /** The template's card type (decides the header slot). */
  cardType: CardType | null | undefined;
  /** The template's BOUND face field keys. */
  boundFieldKeys?: readonly (CardFieldKey | null | undefined)[];
}

/**
 * Push a holder's snapshot to Passcreator.
 *
 * The formatter is the SAME one the initial issuance uses
 * (`packages/shared/logic/passFieldFormatter.ts`), so a value can
 * never be formatted one way at creation and another way at update
 * time — the two requests carry an identical shape.
 *
 * @throws {BadGatewayError} when the PATCH fails.
 */
export async function syncValuesToPasscreator(
  input: SyncValuesInput,
): Promise<PassUpdateResult> {
  const { env, passIdentifier, snapshot, cardType, boundFieldKeys } = input;
  const values = formatPassValues({ cardType, snapshot, boundFieldKeys });
  return await updatePassValues(env, passIdentifier, values);
}
