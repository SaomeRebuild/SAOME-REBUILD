/**
 * Membership tier snapshot derivation — one place that turns a
 * template's tier list into the frozen snapshot persisted on a
 * holder row.
 *
 * @module shared/logic/membershipTier
 * @description The snapshot (`public.pass_holders.membership_tier_snapshot`,
 * JSONB) is the authoritative record of WHICH membership tier a holder
 * joined and WHAT they paid for it. It is frozen at registration time
 * so a later tenant edit to the tier list cannot rewrite the history
 * of an existing holder's receipt.
 *
 * WHY THIS IS SERVER-DERIVED (not client-supplied)
 *
 * The tier list lives in the template's own
 * `settings.membershipTiers[]`. The client only ever says WHICH tier
 * it picked (`selectedTierIndex`); it never says what that tier is
 * called or what it costs. Deriving the snapshot here means:
 *
 *   - a client cannot name a tier the tenant never offered;
 *   - a client cannot quote a price the tenant never set;
 *   - the persisted snapshot always equals the template's state at
 *     registration time, even if the tenant edited the tiers while
 *     the public page was open.
 *
 * This mirrors the gift-card rule (`shared/logic/giftCardPurchase.ts`
 * — the backend re-derives the amount, the client never proposes a
 * price).
 *
 * THE FREE-CARD CASE
 *
 * A free membership card (`isPaid === false`) still has exactly ONE
 * tier, and that tier still has a NAME — the tenant fills it in via
 * the Step 6 free-card editor. What a free card does NOT have is a
 * billing cycle (`durationType`) or a price (`paidAmount`). So the
 * free card resolves to a snapshot with `durationType: null` and
 * `paidAmount: null` but a real `name`.
 *
 * Rule references:
 *   - Rule 019 § 4.1 — the shared package owns the contract; the
 *     backend mirrors it, never re-implements it.
 *   - Rule 023 — pure business logic lives in `shared/`, so a React
 *     Native app can reuse it verbatim.
 *   - Rule 024 — no web-only APIs here (no `window`, no `document`,
 *     no `localStorage`).
 */

import type { Currency } from '../schemas/card';
import type { MembershipTierSnapshot } from '../types/passHolder';

/**
 * The billing cycle a tier is sold on.
 *
 * `null` means "no cycle" — a free membership card, or a tier the
 * tenant has not finished configuring. It is NOT a third billing
 * option, so it never selects a cost field.
 */
export type MembershipTierDurationType = 'monthly' | 'yearly' | null;

/**
 * A tier as it appears in `templates.settings.membershipTiers[]`.
 *
 * Every field is optional / `unknown` because the value arrives as
 * raw JSONB: the column is opaque, so the shape is only a hint. The
 * reader below validates each field defensively.
 */
export interface MembershipTierSource {
  name?: unknown;
  durationType?: unknown;
  monthlyCost?: unknown;
  yearlyCost?: unknown;
}

/**
 * Whether the holder BOUGHT a billing cycle.
 *
 * - `'paid'`  — the holder picked a tier with a monthly / yearly
 *   cycle. The cycle and its price come from the tier.
 * - `'free'`  — the holder joined a free membership card. There is no
 *   cycle and no price, so both are recorded as null REGARDLESS of
 *   what the tier row still carries.
 */
export type MembershipTierSnapshotMode = 'paid' | 'free';

/** The tier list as it arrives from the template's JSONB settings. */
export type MembershipTierSourceList = unknown;

/**
 * Read a tier's billing cycle defensively.
 *
 * An unrecognised value (e.g. `'weekly'` from a hand-edited
 * settings blob) degrades to `null` — "no cycle" — rather than
 * guessing. Guessing would silently pick a cost field and quote the
 * wrong price.
 */
function readDurationType(raw: unknown): MembershipTierDurationType {
  if (raw === 'monthly') return 'monthly';
  if (raw === 'yearly') return 'yearly';
  return null;
}

/**
 * Read a cost defensively.
 *
 * A non-numeric value (e.g. the string `'200'` from a hand-edited
 * settings blob) is treated as "not filled in" → `null`. It is NOT
 * coerced, because coercing would let a malformed blob decide the
 * price.
 */
function readCost(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw;
}

/**
 * Derive the frozen tier snapshot for a membership card holder.
 *
 * @param args.tiers    - The template's `settings.membershipTiers[]`
 *                        (raw JSONB — read defensively).
 * @param args.index    - 0-based index of the tier the holder joined.
 * @param args.currency - The template's currency (TWD / ZAR).
 * @param args.mode     - `'paid'` for a paid membership card (the
 *                        holder bought a cycle), `'free'` for a free
 *                        membership card (the holder joined for free).
 * @returns The frozen snapshot, or `null` when the tier cannot be
 *          resolved (index out of range, malformed entry, or a tier
 *          with a blank name — a blank tier is not a tier).
 */
export function resolveMembershipTierSnapshot(args: {
  tiers: MembershipTierSourceList;
  index: number;
  currency: Currency;
  mode: MembershipTierSnapshotMode;
}): MembershipTierSnapshot | null {
  const { tiers, index, currency, mode } = args;

  if (!Array.isArray(tiers)) return null;
  if (!Number.isInteger(index) || index < 0 || index >= tiers.length) {
    return null;
  }

  const entry = tiers[index];
  if (typeof entry !== 'object' || entry === null) return null;
  const tier = entry as MembershipTierSource;

  const name = typeof tier.name === 'string' ? tier.name.trim() : '';
  if (!name) return null;

  // A FREE membership card has no purchase, so it has no cycle and no
  // price — even if the tier still carries stale values from a
  // previous PAID state (switching a card paid → free in the editor
  // does not clear the per-tier durationType / costs). Reading those
  // stale values would persist a phantom billing cycle on a card the
  // holder never paid for.
  if (mode === 'free') {
    return { index, name, durationType: null, paidAmount: null, currency };
  }

  const durationType = readDurationType(tier.durationType);

  // The cost field follows the billing cycle. With no cycle there is
  // no price to quote (an unconfigured tier).
  const paidAmount =
    durationType === 'monthly'
      ? readCost(tier.monthlyCost)
      : durationType === 'yearly'
        ? readCost(tier.yearlyCost)
        : null;

  return {
    index,
    name,
    durationType,
    paidAmount,
    currency,
  };
}

/**
 * Read the tier name out of a persisted snapshot.
 *
 * The snapshot is free-form JSONB, so it is read defensively — the
 * same posture as
 * `shared/logic/passExpiry.ts::membershipDurationTypeFromSnapshot`.
 * A malformed value degrades to `null` (no member level to show)
 * rather than throwing inside a registration flow.
 *
 * @param snapshot - The raw JSONB value (`unknown`).
 * @returns         - The tier name, or `null`.
 */
export function membershipTierNameFromSnapshot(snapshot: unknown): string | null {
  if (typeof snapshot !== 'object' || snapshot === null) return null;
  const name = (snapshot as { name?: unknown }).name;
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}
