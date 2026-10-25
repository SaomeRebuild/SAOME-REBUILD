/**
 * Registration runtime state — the holder's opening Pass values.
 *
 * @module modules/pass-templates/services/passRegistrationService
 * @description Turns a freshly registered holder row into the runtime
 * value state that the Pass must carry from its very first render.
 *
 * WHY A SEPARATE SERVICE
 *
 * `registerService` is already responsible for the HTTP-shaped
 * orchestration (find template → upsert holder → issue pass). The
 * runtime-value derivation is a pure business concern with its own
 * contract, so it lives here:
 *
 *   holder row + template settings
 *     → `registered` event (shared calculator)
 *     → event ledger + snapshot (shared event service)
 *     → Passcreator payload (shared formatter)
 *
 * The idempotency key is `registered:<holderId>`, so the event ledger
 * holds AT MOST ONE opening event per holder. Re-registering an
 * existing holder therefore cannot append a second event, and the
 * snapshot is rebuilt from the ledger (never from the request).
 *
 * THE DB IS THE ARBITER (migration 029)
 *
 * The `registered:<holderId>` key is a CONVENTION, and a convention
 * can be broken (a replay path, a legacy row, a manual insert). The
 * ledger therefore ALSO carries a partial unique index
 * (`pass_events_one_registered_per_holder_idx`) that rejects a second
 * `registered` row for the same holder at the DATABASE level — with a
 * DIFFERENT idempotency key, which the `UNIQUE (pass_holder_id,
 * idempotency_key)` constraint cannot catch.
 *
 * That rejection arrives as a Postgres `unique_violation` (SQLSTATE
 * 23505). It is NOT a server error: it means "this holder already has
 * their opening event". So this service treats it as an IDEMPOTENT
 * REPLAY — the existing opening event stays the opening fact, the
 * snapshot is derived from the ledger that already exists, and
 * `duplicate` is true. A raw 500 here would mean "the Wallet balance
 * got reset", which is exactly the failure the index exists to
 * prevent.
 *
 * The event timestamp is the holder row's `created_at` — the moment
 * the holder actually registered. That matters for a legacy holder
 * who registers again after the runtime-value feature shipped: their
 * opening event carries their ORIGINAL registration date, exactly as
 * the backfill script would write it.
 */

import type { Sql } from '@/shared/db/client';
import type { CardType } from '@saome/shared/schemas/card';
import type { TemplateSettings } from '@saome/shared/schemas/card';
import type { PassValuesSnapshot } from '@saome/shared/schemas/passValues';
import type { PassEvent } from '@saome/shared/schemas/passValues';
import { passEventSchema, passValuesSnapshotSchema } from '@saome/shared/schemas/passValues';
import { buildInitialValues, reducePassValues } from '@saome/shared/logic/passValueCalculator';
import {
  formatPassValues,
  type PasscreatorPassValues,
} from '@saome/shared/logic/passFieldFormatter';
import { resolveExpiryRuleForCardType } from '@saome/shared/logic/passExpiry';
import { listPassEvents, type PassEventRow } from '../db/passEvents';
import { updatePassHolderPassValuesSnapshot } from '../db/passHolders';
import {
  applyPassEvent,
  isOneRegisteredPerHolderViolation,
  replayPassRuntimeState,
  type ApplyPassEventResult,
} from './passValueService';

export interface RegistrationRuntimeStateInput {
  /** The holder row id (`pass_holders.id`). */
  passHolderId: string;
  /** The template's card type (NULL = the template has no type yet). */
  cardType: CardType | null;
  /** The template's full `settings` JSONB. */
  settings: TemplateSettings | null | undefined;
  /**
   * The holder's purchased points (gift card). Read from the PERSISTED
   * row, never recomputed from the request — the purchase price is
   * frozen at registration time.
   */
  purchasedPoints?: number | null;
  /**
   * The PAID membership tier duration the holder bought
   * (`monthly` / `yearly`), read from their PERSISTED frozen tier
   * snapshot (`pass_holders.membership_tier_snapshot`).
   *
   * It lives on the HOLDER, not on the template: a template can offer
   * a monthly AND a yearly tier at once, and only the holder's
   * purchase decides when THEIR pass expires.
   */
  membershipDurationType?: 'monthly' | 'yearly' | null;
  /**
   * The holder's registration timestamp (ISO datetime). This is the
   * holder row's `created_at`, so the opening event keeps the
   * original registration time even when the holder registers again
   * later.
   */
  registeredAt: string;
}

export interface RegistrationRuntimeState {
  /** The opening event id in the ledger. */
  eventId: string;
  /** True when the event already existed (idempotent replay). */
  duplicate: boolean;
  /** The derived state (metrics + expiry). */
  snapshot: PassValuesSnapshot;
  /** The Passcreator payload for the FIRST issuance. */
  values: PasscreatorPassValues;
}

/**
 * Build the opening `registered` event for a holder.
 *
 * EXTRACTED so the backfill's dry-run report and the apply step
 * derive the event through the SAME function. The report therefore
 * shows exactly what the apply step would write — there is no second
 * implementation of "what a registration means" to drift.
 *
 * Pure: no I/O, no DB access. The caller decides when to persist it.
 */
export function buildRegistrationRuntimeEvent(
  input: RegistrationRuntimeStateInput,
): PassEvent {
  const registeredAt = input.registeredAt;
  const issuedOn = registeredAt.slice(0, 10);

  return buildInitialValues({
    // An unknown card type must not be treated as a gift card, so the
    // empty string is used instead of guessing a type.
    cardType: input.cardType ?? '',
    purchasedPoints: input.purchasedPoints ?? null,
    expiryRule: resolveExpiryRuleForCardType(
      input.cardType,
      input.settings,
      { durationType: input.membershipDurationType ?? null },
    ),
    issuedOn,
    at: registeredAt,
  });
}

/**
 * Ensure the holder has exactly one opening `registered` event and
 * return the Passcreator payload derived from the resulting snapshot.
 *
 * THE DB IS THE ARBITER (migration 029)
 *
 * The idempotency key `registered:<holderId>` is a CONVENTION, and a
 * convention can be broken (a replay path, a legacy row, a manual
 * insert). The ledger therefore ALSO carries a partial unique index
 * (`pass_events_one_registered_per_holder_idx`) that rejects a second
 * `registered` row for the same holder at the DATABASE level — with a
 * DIFFERENT idempotency key, which the `UNIQUE (pass_holder_id,
 * idempotency_key)` constraint (and therefore `appendPassEvent`'s
 * `ON CONFLICT` arbiter) cannot catch.
 *
 * That rejection arrives as SQLSTATE `23505` (`unique_violation`).
 * It is NOT a server error: it means "this holder already has their
 * opening event". So this function treats it as an IDEMPOTENT REPLAY:
 *
 *   - nothing is appended (the DB already refused the write),
 *   - the holder's EXISTING ledger is re-read and re-folded, so the
 *     snapshot reflects the opening fact that is already recorded
 *     (a rejected insert must never reset the holder's state),
 *   - `duplicate` is true, and the caller gets a normal result
 *     instead of a raw 500.
 *
 * A raw 500 here would mean "the Wallet balance got reset", which is
 * exactly the failure the index exists to prevent.
 *
 * ANY OTHER failure — a different constraint, a dropped connection, a
 * malformed payload — is re-thrown untouched. Only this one specific
 * violation is converted.
 *
 * @throws {Error} for every failure that is NOT the
 *         `pass_events_one_registered_per_holder_idx` unique violation.
 */
export async function ensureRegistrationRuntimeState(
  sql: Sql,
  input: RegistrationRuntimeStateInput,
): Promise<RegistrationRuntimeState> {
  const event = buildRegistrationRuntimeEvent(input);

  let applied: ApplyPassEventResult;
  try {
    applied = await applyPassEvent({
      sql,
      passHolderId: input.passHolderId,
      event,
      idempotencyKey: `registered:${input.passHolderId}`,
    });
  } catch (err) {
    // The DB refused a second `registered` row for this holder.
    if (!isOneRegisteredPerHolderViolation(err)) throw err;

    // Replay instead of append: re-read the ledger that already
    // exists and derive the state from it.
    const replayed = await replayPassRuntimeState(sql, input.passHolderId);
    applied = {
      eventId: replayed.eventId,
      duplicate: replayed.duplicate,
      snapshot: replayed.snapshot,
    };
  }

  const values = formatPassValues({
    cardType: input.cardType,
    snapshot: applied.snapshot,
    boundFieldKeys: [input.settings?.leftField, input.settings?.rightField],
  });

  return {
    eventId: applied.eventId,
    duplicate: applied.duplicate,
    snapshot: applied.snapshot,
    values,
  };
}
