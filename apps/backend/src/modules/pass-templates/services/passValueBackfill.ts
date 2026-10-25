/**
 * Pass runtime value BACKFILL — orchestration service.
 *
 * @module modules/pass-templates/services/passValueBackfill
 * @description Gives pre-existing pass holders the runtime value state
 * they were missing when the event ledger shipped.
 *
 * THE PROBLEM
 *
 * `public.pass_events` shipped with migration 028 (2026-10-24). Every
 * holder registered BEFORE that date has:
 *
 *   - no `registered` event in their ledger
 *   - `pass_values_snapshot = NULL` on their row
 *
 * The snapshot column is NULLABLE on purpose (NULL = "no runtime
 * values yet", a different state from "all-zero runtime values"), but
 * it also means those holders have no runtime state at all — their
 * Wallet pass still shows an empty balance.
 *
 * WHY THIS IS A SEPARATE SERVICE (and not part of the register flow)
 *
 * The register flow handles the FORWARD path: a holder registers
 * today, and the opening state is derived at that moment. The backfill
 * handles the RETROSPECTIVE path: a holder registered weeks ago needs
 * the state they WOULD have received on their registration day. Mixing
 * the two would put a "repair legacy rows" branch in the hot
 * registration path — where a mistake affects a live user.
 *
 * WHY THE DERIVATION IS NOT RE-IMPLEMENTED HERE
 *
 * The backfill calls `ensureRegistrationRuntimeState` — the SAME
 * service the live registration flow calls. That service uses the
 * shared calculator (`buildInitialValues`) and the shared reducer
 * (`reducePassValues`), so a backfilled holder's snapshot is
 * byte-identical to what a fresh registration would have produced.
 *
 * A backfill that computed its own values would be a SECOND
 * definition of "what a registration means" — and the two would
 * diverge the first time a Scanner event landed on one of them.
 *
 * IDEMPOTENCE
 *
 * Each holder's opening event carries the key `registered:{holderId}`
 * — the same key the live flow uses. The ledger's UNIQUE constraint
 * turns a duplicate insert into a no-op, so:
 *
 *   - re-running the backfill is safe (the second run reports
 *     `duplicate: true` for every holder and skips them)
 *   - a holder who registers AGAIN after the backfill also gets a
 *     no-op (whichever ran first wins)
 *
 * NO PASSCREATOR PATCH
 *
 * This service takes NO `env` argument and does NOT import the
 * Passcreator client. It only writes the ledger + the snapshot.
 * Bulk-PATCHing production wallet passes is a separate, explicitly
 * verified operation: the plan requires one controlled pass to be
 * synced and read-back-verified BEFORE any batch re-push is even
 * considered. Silently PATCHing 46 production passes as a side
 * effect of a data repair would be exactly the kind of unverified
 * production mutation this project has been bitten by before.
 *
 * DRY-RUN FIRST
 *
 * `planPassRuntimeValueBackfill` produces the report with NO writes.
 * `backfillPassRuntimeValues` performs the writes. They are separate
 * entry points so the report can be reviewed before anything changes.
 *
 * Rule references:
 *   - Rule 006 § verification — dry-run before apply.
 *   - Rule 000 Part B.4 — SQL in `db/`, orchestration here.
 *   - Rule 032 § 1 — the JSONB payload is validated by the shared
 *     schema before it reaches SQL (inside `applyPassEvent`).
 *
 * @see apps/backend/src/modules/pass-templates/services/passRegistrationService.ts
 * @see apps/backend/src/modules/pass-templates/db/passHolders.ts
 * @see runs/decisions/2026-10-24-pass-runtime-value-model.md
 */

import type { Sql } from '@/shared/db/client';
import { listPassHoldersMissingRuntimeValues } from '../db/passHolders';
import { findPublicTemplateById } from '../db/templates';
import {
  buildRegistrationRuntimeEvent,
  ensureRegistrationRuntimeState,
} from './passRegistrationService';
import { membershipDurationTypeFromSnapshot } from '@saome/shared/logic/passExpiry';

/**
 * One line of the backfill dry-run report.
 *
 * This is what an operator reads BEFORE running the apply step, so it
 * answers the questions that matter: which holder, what card type, what
 * opening balance would they get, and would they expire.
 */
export interface PassRuntimeValueBackfillPlanEntry {
  /** `pass_holders.id`. */
  passHolderId: string;
  /** `pass_holders.template_id`. */
  templateId: string;
  /**
   * The template's card type. `null` when the template has no card
   * type yet (a draft) — such a holder opens with all-zero metrics
   * and no expiry, which is the safe fallback.
   */
  cardType: string | null;
  /**
   * The opening gift-card balance the holder would receive (0 for
   * every non-gift card type).
   */
  giftPoints: number;
  /**
   * The expiry date the holder would receive (`null` = never
   * expires), anchored on their ORIGINAL registration date.
   */
  expiryDate: string | null;
  /** The holder's email — for the operator's eyeball check. */
  email: string;
}

/** The result of the apply step. */
export interface PassRuntimeValueBackfillResult {
  /** How many holders received a NEW opening event. */
  applied: number;
  /** How many holders were skipped (already had the event). */
  skipped: number;
  /** Per-holder failures (a missing template, an invalid payload). */
  errors: Array<{ passHolderId: string; message: string }>;
}

/**
 * Normalize a timestamp into an ISO datetime string.
 */
function toIsoTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Build the dry-run report for the runtime-value backfill.
 *
 * Performs NO writes. For each holder that would be processed, it
 * derives — through the SAME shared calculator the live registration
 * flow uses — the opening metrics and expiry the holder would get.
 *
 * @param sql - postgres.js instance.
 * @returns   - One entry per holder that needs a backfill.
 */
export async function planPassRuntimeValueBackfill(
  sql: Sql,
): Promise<PassRuntimeValueBackfillPlanEntry[]> {
  const holders = await listPassHoldersMissingRuntimeValues(sql);
  const plan: PassRuntimeValueBackfillPlanEntry[] = [];

  for (const holder of holders) {
    const template = await findPublicTemplateById(sql, holder.template_id);
    if (!template) {
      // The template row is gone (hard-deleted). Such a holder has no
      // card type, no expiry rule and no gift-card points — they open
      // with all-zero metrics and no expiry.
      plan.push({
        passHolderId: holder.id,
        templateId: holder.template_id,
        cardType: null,
        giftPoints: 0,
        expiryDate: null,
        email: holder.email,
      });
      continue;
    }

    // The gift-card opening balance is the PURCHASED points — read
    // from the persisted row, never recomputed from the template
    // (the price is frozen at registration time).
    const isGiftCard = template.card_type === 'gift_card';
    const giftPoints =
      isGiftCard && typeof holder.purchased_points === 'number'
        ? holder.purchased_points
        : 0;

    plan.push({
      passHolderId: holder.id,
      templateId: holder.template_id,
      cardType: template.card_type,
      giftPoints,
      expiryDate: deriveExpiryDate(template, holder),
      email: holder.email,
    });
  }

  return plan;
}

/**
 * Derive the expiry date a holder would receive.
 *
 * Delegates to the SHARED event builder — the same one the apply step
 * uses — so the report shows exactly what the apply step would write.
 */
function deriveExpiryDate(
  template: NonNullable<Awaited<ReturnType<typeof findPublicTemplateById>>>,
  holder: {
    id: string;
    created_at: Date | string;
    purchased_points?: number | null;
    membership_tier_snapshot?: unknown;
  },
): string | null {
  const event = buildRegistrationRuntimeEvent({
    passHolderId: holder.id ?? '',
    cardType: template.card_type,
    settings: template.settings,
    purchasedPoints: holder.purchased_points ?? null,
    // Paid membership only — the tier duration the holder bought,
    // read from their PERSISTED frozen tier snapshot.
    membershipDurationType: membershipDurationTypeFromSnapshot(
      holder.membership_tier_snapshot,
    ),
    registeredAt: toIsoTimestamp(holder.created_at),
  });

  // The builder always produces a `registered` event (it is the only
  // event it can produce) — the narrowing is here because
  // `PassEvent` is a discriminated union.
  if (event.type !== 'registered') return null;

  return event.payload.expiryDate;
}

/**
 * Backfill the runtime value state for every holder that is missing it.
 *
 * Each holder gets exactly ONE `registered` event (idempotency key
 * `registered:{holderId}`) plus the derived snapshot. No Passcreator
 * calls are made.
 *
 * A holder whose template row is missing, or whose event payload
 * fails the shared schema, is recorded in `errors` and the backfill
 * CONTINUES with the next holder — one bad row must not abort the
 * whole repair.
 *
 * @param sql - postgres.js instance.
 * @returns   - The applied / skipped / errored tallies.
 */
export async function backfillPassRuntimeValues(
  sql: Sql,
): Promise<PassRuntimeValueBackfillResult> {
  const holders = await listPassHoldersMissingRuntimeValues(sql);
  const result: PassRuntimeValueBackfillResult = {
    applied: 0,
    skipped: 0,
    errors: [],
  };

  for (const holder of holders) {
    const template = await findPublicTemplateById(sql, holder.template_id);
    if (!template) {
      result.skipped += 1;
      result.errors.push({
        passHolderId: holder.id,
        message: `Template ${holder.template_id} not found — cannot derive the opening state`,
      });
      continue;
    }

    try {
      const outcome = await ensureRegistrationRuntimeState(sql, {
        passHolderId: holder.id,
        cardType: template.card_type,
        settings: template.settings,
        purchasedPoints: holder.purchased_points ?? null,
        // Paid membership only — the tier duration the holder bought,
        // read from their PERSISTED frozen tier snapshot.
        membershipDurationType: membershipDurationTypeFromSnapshot(
          holder.membership_tier_snapshot,
        ),
        // The anchor is the holder's ORIGINAL registration time — not
        // "now" — so the backfilled expiry matches what they would
        // have received on their registration day.
        registeredAt: toIsoTimestamp(holder.created_at),
      });

      if (outcome.duplicate) {
        // The event already existed (a concurrent re-registration, or
        // a previous backfill run). The snapshot was still rebuilt
        // from the ledger, so the state is correct either way.
        result.skipped += 1;
      } else {
        result.applied += 1;
      }
    } catch (err) {
      result.skipped += 1;
      result.errors.push({
        passHolderId: holder.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
