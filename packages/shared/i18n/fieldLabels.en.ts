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
  // ===== Passcreator `headerFields[0]` per-cardType mapping (2026-10-11) =====
  // English mirror of `fieldLabels.zh-TW.ts::headerField`. See that file
  // for the full architecture doc (why `headerField` is FIXED per
  // cardType, why it lives here vs `previewPill`, drift guard details).
  //
  // Per-cardType rules (must mirror `passCardPreviewSlot.ts::resolveHeaderRightSlot`):
  //   - membership_card                  → {key: 'memberExpiry',    label: 'Member Expiry'}
  //   - discount_card                    → {key: 'discountExpiry',  label: 'Expiry Date'}
  //   - coupon_card                      → {key: 'couponExpiry',    label: 'Expiry Date'}
  //   - stamp_card / reward_card /
  //     cashback_card / multipass        → {key: 'balance',         label: 'Balance'}
  //   - gift_card                        → {key: 'giftPoints',      label: 'Points'}
  //
  // Drift guard: the `label` values here MUST equal the editor's
  // `passCard.en.ts::{memberExpiry,discountExpiry,couponExpiry,
  // balancePreview,giftPointsPreview}.label`. The conformance test
  // `fieldLabels.test.ts::locale-vs-passCard headerField` enforces
  // this. (Rule 023 § 翻譯書寫紀律 — en labels are pure ASCII.)
  //
  // Typing: same as zh-TW — `Partial<Record<CardType, …>>` keeps
  // the two locales shape-compatible.
  headerField: {
    membership_card: { key: 'memberExpiry',   label: 'Member Expiry' },
    discount_card:   { key: 'discountExpiry', label: 'Expiry Date' },
    coupon_card:     { key: 'couponExpiry',   label: 'Expiry Date' },
    stamp_card:      { key: 'balance',        label: 'Balance' },
    reward_card:     { key: 'balance',        label: 'Balance' },
    cashback_card:   { key: 'balance',        label: 'Balance' },
    multipass:       { key: 'balance',        label: 'Balance' },
    gift_card:       { key: 'giftPoints',     label: 'Points' },
  } as Partial<Record<CardType, { key: string; label: string }>>,
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
  // 2026-10-11 — drift fix.
  //   Previously `discountExpiry` was `'Valid Until'` and `couponExpiry`
  //   was `'Valid Until'`, which drifted from `passCard.en.ts` (the
  //   editor's source of truth: `'Expiry Date'`). The drift was
  //   invisible because `getPreviewPillLabels` had no callers in the
  //   frontend code (the editor reads `passCard.en.ts` directly via
  //   `t('discountExpiry.label')`). Now corrected: the strings here
  //   must equal the corresponding `passCard.en.ts` blocks so the
  //   `previewPill-vs-headerField` drift guard stays green.
  previewPill: {
    balance: 'Balance',
    memberExpiry: 'Member Expiry',
    discountExpiry: 'Expiry Date',
    couponExpiry: 'Expiry Date',
    giftPoints: 'Points',
  },
};

export type FieldLabelsEn = typeof en;
