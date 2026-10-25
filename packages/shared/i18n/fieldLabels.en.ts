/**
 * Field labels — en locale.
 *
 * @module shared/i18n/fieldLabels.en
 *
 * English mirror of `fieldLabels.zh-TW.ts`. See that file for the full
 * architecture doc; the drift test (`fieldLabels.test.ts`) ensures
 * both locales have identical key sets.
 *
 * Source of truth: `fieldLabels.zh-TW.ts` (zh-TW was authored first
 * because the SAOME tenant is a Taiwan shop). The drift test catches
 * any divergence at the key-set level; the value-level check
 * (different languages MUST render different strings) is a separate
 * test case to guard against accidental en/zh convergence.
 */

import type { CardFieldKey } from '../constants/card-fields';
import type { CardType } from '../schemas/card';
import type { HeaderSlotKind } from '../constants/headerSlots';

export const en = {
  slotNames: {
    left: 'Left Field',
    right: 'Right Field',
  },
  // ===== Passcreator `headerFields[0]` per-cardType label (2026-10-24 refactor) =====
  // English mirror of `fieldLabels.zh-TW.ts::headerLabels`. See that file
  // for the full architecture doc (why the label is FIXED per cardType,
  // why the cardType→kind mapping now lives in
  // `packages/shared/constants/headerSlots.ts`, drift guard details).
  //
  // Per-kind rules (the cardType → kind mapping lives in
  // `packages/shared/constants/headerSlots.ts::HEADER_SLOTS`):
  //   - member_expiry    (membership_card)  → 'Member Expiry'
  //   - discount_expiry  (discount_card)    → 'Expiry Date'
  //   - coupon_expiry    (coupon_card)      → 'Expiry Date'
  //   - balance          (stamp / reward / cashback / multipass) → 'Balance'
  //   - gift_points      (gift_card)        → 'Points'
  //
  // Drift guard: the `label` values here MUST equal the editor's
  // `passCard.en.ts::{memberExpiry,discountExpiry,couponExpiry,
  // balancePreview,giftPointsPreview}.label`. The conformance test
  // `fieldLabels.test.ts::locale-vs-passCard headerField` enforces
  // this. (Rule 023 § 翻譯書寫紀律 — en labels are pure ASCII.)
  //
  // Typing: same as zh-TW — `Record<HeaderSlotKind, string>` keeps
  // the two locales shape-compatible.
  headerLabels: {
    member_expiry:   'Member Expiry',
    discount_expiry: 'Expiry Date',
    coupon_expiry:   'Expiry Date',
    balance:         'Balance',
    gift_points:     'Points',
  } satisfies Record<HeaderSlotKind, string>,
  fieldLabels: {
    phone: 'Phone',
    email: 'Email',
    memberLevel: 'Member Level',
    birthday: 'Birthday',
    visitCount: 'Visit Count',
    memberName: 'Member Name',
    availableRewards: 'Available Rewards',
    totalStamps: 'Total Stamps',
    stampsRemaining: 'Stamps Remaining',
    pointsToNextTier: 'Points to Next Tier',
    currentPoints: 'Current Points',
    pointsToNextTierCashback: 'Amount to Next Tier',
    accumulatedSpendCashback: 'Accumulated Spending',
    pointsToNextTierDiscount: 'Amount to Next Tier',
    discountTierBracket: 'Discount Tier Bracket',
    accumulatedSpendDiscount: 'Accumulated Spending',
    couponRemainingCount: 'Remaining Count',
    couponDiscount: 'Discount Offer',
    multipassCompleted: 'Cumulative',
    multipassPointsToNextTier: 'To Next Tier',
    multipassRewardContent: 'Reward',
  } satisfies Record<CardFieldKey, string>,
  // 2026-10-11 — cardType-aware `memberLevel` overrides. See the
  // `fieldLabels.zh-TW.ts` doc above for the full architecture. Values
  // here MUST equal `cardEditor.en.ts::step3.fieldsSection.fields.
  // memberLevelStamp` and `…memberLevelDiscount`. The conformance test
  // `fieldLabels.test.ts::locale-vs-cardEditor` enforces the drift guard.
  //
  // The English wording "Reward" (stamp / reward / cashback) and
  // "Discount Tier" (discount) match the per-cardType semantic shifts
  // documented in `Step3CardFields::resolveOptionLabelKey`.
  //
  // Typing: same as zh-TW — `Partial<Record<CardType, string>>` keeps
  // the two locales shape-compatible (see fieldLabels.zh-TW.ts).
  memberLevelOverrides: {
    stamp_card: 'Reward',
    reward_card: 'Reward',
    cashback_card: 'Reward',
    discount_card: 'Discount Tier',
  } as Partial<Record<CardType, string>>,
  backSide: {
    title: 'Card Info',
    hint: 'Per Apple\'s end-user license agreement, every Wallet pass must include contact information. Please provide an email address or phone number so cardholders can reach you.',
    addField: 'Add field',
    removeField: 'Remove',
    labelPlaceholder: 'Label (optional)',
    valuePlaceholder: 'Value (required)',
    required: 'Each entry must have a value',
    minOne: 'At least one back-side field is required',
    maxReached: 'Up to 10 back-side fields',
  },
  defaults: {
    cardType: 'Card',
    issuerName: 'Untitled Card',
    cardName: 'Untitled Card',
  },
  // 2026-10-24 — the `previewPill` block was REMOVED. It duplicated the
  // `headerLabels` content verbatim (a drift test enforced they stayed
  // equal), so it was a second copy of the same 5 strings waiting to
  // drift. `getPreviewPillLabels()` now derives the pill labels from
  // `headerLabels` — see `packages/shared/i18n/fieldLabels.ts`.
  //
  // (Historical note: the 2026-10-11 drift fix that corrected
  // `discountExpiry` / `couponExpiry` from 'Valid Until' to
  // 'Expiry Date' is now structurally impossible — there is only one
  // copy of these strings left, in `headerLabels`.)
};

export type FieldLabelsEn = typeof en;
