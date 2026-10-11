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

export const en = {
  slotNames: {
    left: 'Left Field',
    right: 'Right Field',
  },
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
  previewPill: {
    balance: 'Balance',
    memberExpiry: 'Member Expiry',
    discountExpiry: 'Valid Until',
    couponExpiry: 'Valid Until',
    giftPoints: 'Points',
  },
};

export type FieldLabelsEn = typeof en;
