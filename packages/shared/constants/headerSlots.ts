/**
 * Header slot specification — single source of truth for the Pass header.
 *
 * @module shared/constants/headerSlots
 * @description One table that answers, for every card type:
 *   - WHICH semantic value occupies the Pass header right slot
 *     (the "header kind")
 *   - WHICH Passcreator field key carries it
 *   - WHICH `data-testid` the frontend preview renders it under
 *
 * WHY this file exists (2026-10-24):
 *
 * Before this module, the header right-slot rule was duplicated in FOUR
 * places, each with its own copy of the same branch tree:
 *
 *   1. `packages/shared/i18n/fieldLabels.zh-TW.ts::headerField` —
 *      per-cardType `{ key, label }` map (zh-TW)
 *   2. `packages/shared/i18n/fieldLabels.en.ts::headerField` —
 *      per-cardType `{ key, label }` map (en)
 *   3. `apps/frontend/.../CardPreview/passCardPreviewSlot.ts::resolveHeaderRightSlot`
 *      — the library/editor slot resolver
 *   4. `apps/frontend/.../CardPreview/PassCardPreviewHeader.tsx` —
 *      the editor header component (5 separate Sets + 5 type guards +
 *      its own date math + its own now-removed expiry-date formatter)
 *
 * Any change to "which card type shows which header value" had to be
 * applied 4 times, and forgetting one produced a silent divergence
 * between the editor preview and the deployed Passcreator pass.
 *
 * This module collapses the STRUCTURAL half of that rule (which kind,
 * which key, which test id) into one table. The LOCALIZED half (the
 * label text per kind per language) lives in
 * `packages/shared/i18n/fieldLabels.{zh-TW,en}.ts`, keyed by
 * `HeaderSlotKind` — because label text is a translation concern, not a
 * structural one.
 *
 * The 8 card types partition into 5 header kinds:
 *
 *   ┌────────────────────┬─────────────────┬───────────────────┐
 *   │ cardType           │ kind            │ Passcreator key   │
 *   ├────────────────────┼─────────────────┼───────────────────┤
 *   │ membership_card    │ member_expiry   │ memberExpiry      │
 *   │ discount_card      │ discount_expiry │ discountExpiry    │
 *   │ coupon_card        │ coupon_expiry   │ couponExpiry      │
 *   │ stamp_card         │ balance         │ balance           │
 *   │ reward_card        │ balance         │ balance           │
 *   │ cashback_card      │ balance         │ balance           │
 *   │ multipass          │ balance         │ balance           │
 *   │ gift_card          │ gift_points     │ giftPoints        │
 *   └────────────────────┴─────────────────┴───────────────────┘
 *
 * Rule references:
 *   - Rule 023 § Shared Package 邊界 — structural constants belong in
 *     `packages/shared/constants/` so both frontend and backend read
 *     the same table (the backend pushes `headerFields[0].key` to
 *     Passcreator; the frontend renders the matching preview slot).
 *   - Rule 019 § D.3 — the Passcreator field key IS a contract; one
 *     table, one source.
 *   - Rule 024 § Mobile Future-Proof — pure data, no DOM, no platform API.
 *
 * @see packages/shared/i18n/fieldLabels.ts::getHeaderField
 * @see apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/passCardPreviewSlot.ts
 */

import type { CardType } from '../schemas/card';

/**
 * The semantic kind of value that occupies a card's header right slot.
 *
 * This is the vocabulary the whole Pass runtime value model is built
 * on: the header kind determines WHICH runtime metric (balance vs
 * points vs expiry) the slot displays, and therefore which state field
 * the formatter reads.
 *
 * Note the deliberate absence of a generic `balance` kind that mixes
 * currency and points: `balance` (currency-ish, for stamp/reward/
 * cashback/multipass) and `gift_points` (point count, for gift cards)
 * are separate kinds precisely so a gift-card point balance can never
 * be rendered into a currency slot or vice versa (see the "gift points
 * 不得與 currency balance 互換" rule in the Phase 2 test matrix).
 */
export type HeaderSlotKind =
  | 'member_expiry'
  | 'discount_expiry'
  | 'coupon_expiry'
  | 'balance'
  | 'gift_points';

/**
 * The metadata for one header kind.
 *
 * Shared by every card type that maps to this kind — that is the whole
 * point of the two-level table: `balance` is described ONCE, so the
 * four balance card types cannot drift apart on key / test id / type.
 */
export interface HeaderSlotKindSpec {
  /**
   * The stable Passcreator field key.
   *
   * This is the identifier the template push writes into
   * `fields.headerFields[0].key` and the `{KeyName}` cross-reference
   * placeholder. It MUST be locale-invariant — a template pushed in
   * zh-TW and one pushed in en must resolve to the SAME slot.
   */
  passcreatorKey: string;
  /**
   * The `data-testid` the frontend preview renders this slot under.
   *
   * Kept here (rather than inline in the component) so the frontend
   * preview and the shared slot resolver can never disagree about the
   * selector — a mismatch would make the selector-based regression
   * tests silently pass against the wrong element.
   */
  testId: string;
  /**
   * The `passCard` i18n namespace key that carries the slot LABEL.
   *
   * The label is resolved by the caller through `t(...)` so the same
   * slot can be rendered with a fixed language (template library uses
   * the template's stored `settings.language`).
   */
  labelKey: string;
  /**
   * Semantic type of the value (drives the Passcreator `fields[].type`
   * and the runtime formatter's number-vs-string decision).
   */
  valueType: 'number' | 'date';
}

/**
 * The 5 header kinds, each described exactly once.
 *
 * Keyed by kind so the per-kind LABEL lives in one place per locale
 * (`packages/shared/i18n/fieldLabels.{zh-TW,en}.ts::headerLabels`).
 */
export const HEADER_SLOT_KIND_SPECS: Record<HeaderSlotKind, HeaderSlotKindSpec> = {
  member_expiry: {
    passcreatorKey: 'memberExpiry',
    testId: 'member-expiry-preview',
    labelKey: 'memberExpiry.label',
    valueType: 'date',
  },
  discount_expiry: {
    passcreatorKey: 'discountExpiry',
    testId: 'discount-expiry-preview',
    labelKey: 'discountExpiry.label',
    valueType: 'date',
  },
  coupon_expiry: {
    passcreatorKey: 'couponExpiry',
    testId: 'coupon-expiry-preview',
    labelKey: 'couponExpiry.label',
    valueType: 'date',
  },
  balance: {
    passcreatorKey: 'balance',
    testId: 'balance-preview',
    labelKey: 'balancePreview.label',
    valueType: 'number',
  },
  gift_points: {
    passcreatorKey: 'giftPoints',
    testId: 'gift-points-preview',
    labelKey: 'giftPointsPreview.label',
    valueType: 'number',
  },
};

/**
 * The canonical cardType → header kind table.
 *
 * This is the SINGLE place where "which card type shows which header
 * value" is written down. Adding a 9th card type requires exactly one
 * new row here (plus its label in the two locale files); the frontend
 * preview and the backend template push both derive from this table.
 *
 * Typed as `Record<CardType, HeaderSlotKind>` (not `Partial<...>`) so
 * TypeScript fails the build if a new card type is added to the schema
 * without a corresponding header row — that is the machine-checked
 * drift guard for the old 4-way duplication.
 */
export const HEADER_SLOTS: Record<CardType, HeaderSlotKind> = {
  membership_card: 'member_expiry',
  discount_card: 'discount_expiry',
  coupon_card: 'coupon_expiry',
  stamp_card: 'balance',
  reward_card: 'balance',
  cashback_card: 'balance',
  multipass: 'balance',
  gift_card: 'gift_points',
};

/**
 * Look up the full header slot spec (kind + key + test id) for a card type.
 *
 * Returns `null` for `null` / `undefined` / unknown card types — the
 * caller renders the default "pill" branch in that case. This mirrors
 * the pre-existing `getHeaderField(null, ...) === null` contract so
 * the Passcreator template push still emits an empty
 * `headerFields[]` array for a template whose card type is not yet set.
 */
export function getHeaderSlot(
  cardType: CardType | null | undefined,
): { kind: HeaderSlotKind; spec: HeaderSlotKindSpec } | null {
  if (!cardType) return null;
  // Own-property lookup — NOT a plain `HEADER_SLOTS[cardType]` read.
  // A plain bracket read resolves prototype-chain keys ('toString',
  // 'constructor', '__proto__', 'hasOwnProperty') to Object.prototype
  // members, which are truthy. That would yield a "kind" whose spec is
  // `undefined`, and the caller's `spec.labelKey` / `spec.testId` read
  // would throw. The retired `shouldShowXxxPreview()` guards used
  // `Set.has()`, which returned false for EVERY unknown string; this
  // lookup keeps the same safety for arbitrary card type strings.
  if (!Object.prototype.hasOwnProperty.call(HEADER_SLOTS, cardType)) return null;
  const kind = HEADER_SLOTS[cardType];
  if (!kind) return null;
  return { kind, spec: HEADER_SLOT_KIND_SPECS[kind] };
}

/**
 * The distinct header kinds, in declaration order.
 *
 * Used by the i18n locale files to type their per-kind label maps
 * (a `Record<HeaderSlotKind, string>` — every kind MUST have a label
 * in every locale, enforced by the drift test).
 */
export const HEADER_SLOT_KINDS: readonly HeaderSlotKind[] = [
  'member_expiry',
  'discount_expiry',
  'coupon_expiry',
  'balance',
  'gift_points',
] as const;
