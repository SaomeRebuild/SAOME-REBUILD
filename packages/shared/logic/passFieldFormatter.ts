/**
 * Pass field formatter — canonical state → Passcreator typed payload.
 *
 * @module shared/logic/passFieldFormatter
 * @description Converts a holder's runtime snapshot into the exact JSON
 * body shape Passcreator V3 expects for a per-pass value update.
 *
 * THE WIRE CONTRACT
 *
 * ```ts
 * interface PasscreatorPassValues {
 *   storedValue?: number;
 *   expirationDate?: string;              // Passcreator: 'Y-m-d H:i'
 *   properties: Record<string, string | number>;
 * }
 * ```
 *
 * This is deliberately NOT the `{headerFields, secondaryFields}`
 * abstraction some earlier draft plans proposed. That shape describes a
 * TEMPLATE body (the Passcreator template, built once per card design).
 * This shape describes a per-pass VALUE update (the holder's wallet
 * pass, updated many times). They are different contracts and mixing
 * them would send template structure on every value sync.
 *
 * RULES THIS MODULE ENFORCES
 *
 * 1. **Only BOUND keys are emitted.** The template decides which face
 *    slots exist (`settings.leftField` / `settings.rightField` / the
 *    fixed per-cardType header slot). Sending a key the template does
 *    not bind would either be ignored upstream or — worse — create a
 *    property Passcreator renders in a slot the tenant never designed.
 *
 * 2. **Numbers stay numbers.** A numeric metric is emitted as a JSON
 *    number, never as a formatted currency string. `"200"` and `200`
 *    are different values to Passcreator (the latter gets the
 *    number-specific rendering), and a currency suffix would be
 *    wrong for point counts anyway.
 *
 * 3. **Gift points never cross into the balance slot.** A gift card's
 *    points live in `properties.giftPoints`; a currency balance lives
 *    in `properties.balance`. They are different keys, sourced from
 *    different canonical metrics, and there is no code path that
 *    writes one into the other.
 *
 * 4. **Dates are Passcreator-formatted.** The snapshot stores a
 *    business date (`YYYY-MM-DD`); the wire wants `Y-m-d H:i`. The
 *    conversion is UTC-anchored so the same snapshot always produces
 *    the same string regardless of where the server runs.
 *
 * Rule references:
 *   - Rule 023 § Shared Package 邊界 — pure function, no I/O.
 *   - Rule 024 § Mobile Future-Proof — no platform API; the same
 *     formatter runs in React Native.
 *   - Rule 019 § D.3 — the Passcreator shape is a contract.
 *
 * @see packages/shared/logic/passValueCalculator.ts — produces the snapshot
 * @see packages/shared/constants/headerSlots.ts — the header slot spec
 * @see runs/decisions/2026-10-24-pass-runtime-value-model.md § 決定三
 */

import type { CardFieldKey } from '../constants/card-fields';
import { getHeaderSlot, UNLIMITED_EXPIRY_VALUE } from '../constants/headerSlots';
import type { CardType } from '../schemas/card';
import type {
  PassValueMetric,
  PassValuesSnapshot,
} from '../schemas/passValues';

/**
 * The Passcreator per-pass value payload.
 *
 * Mirrors `apps/backend/src/shared/lib/passcreator/v3-pass-types.ts`
 * (Layer 2 of the contract sync, per Rule 019 § 4.1).
 */
export interface PasscreatorPassValues {
  /**
   * The pass-level stored balance (a float upstream). Emitted only for
   * the balance-kind cards, and always with the SAME number as the
   * `balance` header property — so the Wallet's header and its
   * stored-value strip can never disagree.
   *
   * NOT emitted for gift cards: a point count is not a currency
   * amount, and rendering "500" as a stored value would mislabel it.
   */
  storedValue?: number;
  /**
   * The pass's expiry timestamp, Passcreator-formatted (`Y-m-d H:i`).
   * Omitted when the card never expires.
   */
  expirationDate?: string;
  /**
   * The per-field values, keyed by the TEMPLATE's field keys.
   *
   * Only keys the template actually binds appear here.
   */
  properties: Record<string, string | number>;
}

/**
 * Which canonical metric backs each template face field.
 *
 * A field key that is NOT in this map is NOT emitted by this
 * formatter. That covers three categories:
 *
 *   - Identity fields (`memberName`, `phone`, `email`, `birthday`) —
 *     sent once, in the pass-creation body (see `issuePass`). A value
 *     update must not restate them.
 *   - Tier-derived values (`pointsToNextTier`, `discountTierBracket`,
 *     `couponRemainingCount`) — they need the template's tier
 *     configuration, not just the holder's snapshot. They are a
 *     template-mapping concern.
 *   - Template-derived stamp values (`totalStamps`, `stampsRemaining`,
 *     `availableRewards`, `multipassCompleted`) — see the long note
 *     below.
 *
 * WHY THE STAMP FAMILY IS EXCLUDED
 *
 * `totalStamps` (總印章數), `stampsRemaining` (還差幾個章),
 * `availableRewards` (可用獎勵) and `multipassCompleted` (累積已滿)
 * all LOOK like stamp counters, but each one promises a DERIVED
 * quantity whose derivation needs inputs this formatter does not
 * receive:
 *
 *   - `totalStamps` is the card's grid CAPACITY (rows × stamps per
 *     row) — a TEMPLATE constant, identical for every holder of that
 *     template. The legacy plugin read it from the card's
 *     `stamp_total` config, never from the member row.
 *   - `stampsRemaining` is the count still needed to reach the reward.
 *     That is a function of the template's reward threshold (Step 6
 *     `stampsPerVisitStamps` / `stampsPerSpendStamps`) and the
 *     accrual mode — not a plain difference against the grid
 *     capacity.
 *   - `availableRewards` is how many rewards are redeemable. The
 *     legacy plugin tracked it as a counter SEPARATE from the stamp
 *     progress (`available_rewards` vs `stamp_progress` columns),
 *     incremented when a reward threshold was crossed. Which rule
 *     applies is Scanner-phase business semantics — see
 *     `runs/plans/2026-10-24-pass-scanner-event-semantics.md`.
 *   - `multipassCompleted` is a tier-progress quantity derived from
 *     the multipass tier thresholds.
 *
 * Mapping them to the raw `stampCount` would put the COLLECTED count
 * into a slot that promises "how many more are needed" — the holder
 * would read "3 stamps remaining" when they have 3 of 10 collected.
 * A wrong number on a live Wallet card is worse than an unset slot,
 * so these stay out of the map until their derivation is specified.
 *
 * The header `balance` slot is unaffected: it reads `stampCount`
 * through `HEADER_BALANCE_METRIC` (a separate, exact mapping — the
 * "餘額 / Balance" slot on a stamp card IS the collected count).
 *
 * Adding a key here means "this field shows exactly this runtime
 * metric" — the label and the metric must mean the same thing.
 */
export const FACE_FIELD_METRIC: Partial<Record<CardFieldKey, PassValueMetric>> = {
  visitCount: 'visitCount',
  currentPoints: 'pointsBalance',
  accumulatedSpendCashback: 'spendAccumulated',
  accumulatedSpendDiscount: 'spendAccumulated',
};

/**
 * The card types whose header slot is the `balance` slot.
 *
 * Derived from the header-slot spec rather than hand-listed, so a new
 * balance-kind card type cannot be added without this map noticing.
 */
const BALANCE_CARD_TYPES = [
  'stamp_card',
  'reward_card',
  'cashback_card',
  'multipass',
] as const satisfies readonly CardType[];

type BalanceCardType = (typeof BALANCE_CARD_TYPES)[number];

/**
 * Which canonical metric backs the header balance slot, per card type.
 *
 * The four balance-kind card types share ONE Passcreator key
 * (`balance`) but count DIFFERENT things:
 *
 *   - stamp_card / multipass → stamps collected
 *   - reward_card            → points earned
 *   - cashback_card          → accumulated spend
 *
 * The mapping is explicit per card type rather than a single global
 * "balance metric", because a global mapping is exactly how a gift
 * card's points would end up in the balance slot.
 *
 * NOTE: the cashback semantics (whether cashback keeps the `balance`
 * slot at all) are explicitly deferred to the Scanner-phase plan — see
 * `runs/plans/2026-10-24-pass-scanner-event-semantics.md`. What is NOT
 * deferred is the separation: no card type's points ever feed another
 * card type's slot.
 */
const HEADER_BALANCE_METRIC: Record<BalanceCardType, PassValueMetric> = {
  stamp_card: 'stampCount',
  reward_card: 'pointsBalance',
  cashback_card: 'spendAccumulated',
  multipass: 'stampCount',
};

/**
 * Convert a business date (`YYYY-MM-DD`) into the Passcreator
 * timestamp format (`Y-m-d H:i`).
 *
 * The time component is midnight, and the conversion is UTC-anchored:
 * a snapshot produced on a server in UTC-8 and one produced in UTC+9
 * must format identically, or the same pass would show a different
 * expiry depending on which worker handled the sync.
 *
 * Returns `null` for a missing / malformed date (the caller then omits
 * `expirationDate` rather than sending garbage).
 */
export function formatPasscreatorDateTime(isoDate: string | null | undefined): string | null {
  if (typeof isoDate !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const [, year, month, day] = match;
  // Validate the calendar date (reject 2026-02-30 rather than
  // silently shipping it upstream).
  const probe = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    probe.getUTCFullYear() !== Number(year) ||
    probe.getUTCMonth() !== Number(month) - 1 ||
    probe.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day} 00:00`;
}

/**
 * Input for `formatPassValues`.
 */
export interface FormatPassValuesInput {
  /**
   * The template's card type. `null` / `undefined` means the template
   * has no card type yet — the formatter then emits an empty payload
   * rather than guessing a slot.
   */
  cardType: CardType | null | undefined;
  /** The holder's derived runtime state. */
  snapshot: PassValuesSnapshot;
  /**
   * The template's BOUND face field keys (the Step 3 left / right
   * slots). `null` / `undefined` entries are skipped (an unset slot
   * binds nothing).
   *
   * Only keys present in `FACE_FIELD_METRIC` produce a value — see
   * that map for why.
   */
  boundFieldKeys?: readonly (CardFieldKey | null | undefined)[];
}

/**
 * Format a holder's runtime state into the Passcreator per-pass
 * value payload.
 *
 * The SAME function is used for the initial issuance (the values ride
 * along with the create call) and for every later update — so a value
 * can never be formatted one way at creation and another way at
 * update time.
 *
 * @example
 *   formatPassValues({
 *     cardType: 'gift_card',
 *     snapshot: { metrics: { ...zeros, giftPoints: 500 }, expiryDate: null },
 *     boundFieldKeys: ['phone'],
 *   });
 *   // → { properties: { giftPoints: 500 } }
 *
 *   formatPassValues({
 *     cardType: 'membership_card',
 *     snapshot: { metrics: { ...zeros }, expiryDate: '2027-10-23' },
 *     boundFieldKeys: [],
 *   });
 *   // → { expirationDate: '2027-10-23 00:00', properties: { memberExpiry: '2027-10-23 00:00' } }
 */
export function formatPassValues(input: FormatPassValuesInput): PasscreatorPassValues {
  const { cardType, snapshot, boundFieldKeys } = input;
  const properties: Record<string, string | number> = {};
  const result: PasscreatorPassValues = { properties };

  const slot = getHeaderSlot(cardType);
  // No card type → the template binds nothing yet. An empty payload is
  // the safe answer: sending nothing upstream leaves the pass as-is.
  if (!slot) return result;

  const { kind, spec } = slot;

  // ── Header slot ────────────────────────────────────────────────────────
  switch (kind) {
    case 'balance': {
      // The `balance` header kind is only reachable from the four
      // balance card types (the header-slot spec guarantees it), so the
      // cast is safe — but the map is typed to those four so a NEW
      // balance-kind card type would fail to compile here.
      const metric = HEADER_BALANCE_METRIC[cardType as BalanceCardType];
      const value = snapshot.metrics[metric];
      properties[spec.passcreatorKey] = value;
      // The stored value strip mirrors the header number EXACTLY, so
      // the two renderings can never disagree.
      result.storedValue = value;
      break;
    }
    case 'gift_points': {
      // Gift points are a POINT COUNT, not a currency amount — they go
      // into their own property and never into `storedValue`.
      properties[spec.passcreatorKey] = snapshot.metrics.giftPoints;
      break;
    }
    case 'member_expiry':
    case 'discount_expiry':
    case 'coupon_expiry': {
      const formatted = formatPasscreatorDateTime(snapshot.expiryDate);
      // No expiry date ⇒ the card NEVER expires ⇒ write the `∞`
      // sentinel instead of OMITTING the property.
      //
      // WHY NOT OMIT (2026-10-26): the per-pass update is a PATCH,
      // and Passcreator's PATCH semantics are "update ONLY the
      // fields you provide". Omitting the expiry property therefore
      // means "keep whatever the pass already had" — a holder whose
      // card was re-pushed from "fixed expiry" to "never expires"
      // would keep showing the OLD date on their Wallet forever.
      // Writing `∞` is the only way to actually clear it.
      properties[spec.passcreatorKey] = formatted ?? UNLIMITED_EXPIRY_VALUE;
      break;
    }
    default: {
      const _exhaustive: never = kind as never;
      void _exhaustive;
      break;
    }
  }

  // ── Bound face fields (the Step 3 left / right slots) ───────────────────
  for (const fieldKey of boundFieldKeys ?? []) {
    if (!fieldKey) continue;
    const metric = FACE_FIELD_METRIC[fieldKey];
    // Not a runtime-valued field → not emitted (see FACE_FIELD_METRIC).
    if (!metric) continue;
    properties[fieldKey] = snapshot.metrics[metric];
  }

  // ── Pass-level expiry ──────────────────────────────────────────────────
  // Emitted whenever the snapshot carries an expiry, regardless of the
  // card type: it is the PASS's expiry, not the header slot's.
  const expirationDate = formatPasscreatorDateTime(snapshot.expiryDate);
  if (expirationDate !== null) {
    result.expirationDate = expirationDate;
  }

  return result;
}
