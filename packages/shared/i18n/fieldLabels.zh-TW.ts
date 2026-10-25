/**
 * Field labels — zh-TW locale.
 *
 * @module shared/i18n/fieldLabels.zh-TW
 *
 * Pin the labels that flow into the Passcreator `headerFields[].label` /
 * `primaryFields[].label` / `secondaryFields[].label` slots, plus the
 * editor-side slot names / back-side labels / defaults / preview pill
 * labels. The frontend `passCard.zh-TW.ts` SPREADS this module so the
 * editor preview uses the exact same strings the backend push writes
 * to Passcreator. Drift between editor and deployed pass becomes a
 * compile error (Rule 023 § flat key namespace).
 *
 * Source of truth: this file. Mirrored to:
 *   - apps/frontend/src/i18n/locales/passCard.zh-TW.ts (preview UI)
 *   - apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts::step3.fieldsSection.fields (dropdown UI)
 *
 * Adding a new CardFieldKey requires:
 *   1. `CARD_FIELD_KEYS` in packages/shared/constants/card-fields.ts
 *   2. `fieldLabels.<key>` here AND in fieldLabels.en.ts
 *   3. `cardEditor.{zh-TW,en}.ts::step3.fieldsSection.fields.<key>` (frontend dropdown)
 *   4. `passCard.{zh-TW,en}.ts::fieldPreview.<key>` (frontend preview)
 *   The drift test in `fieldLabels.test.ts` will fail if 1/2 mismatch.
 */

import type { CardFieldKey } from '../constants/card-fields';
import type { CardType } from '../schemas/card';
import type { HeaderSlotKind } from '../constants/headerSlots';

export const zhTW = {
  // Slot names (Step 3 left / right dropdown labels)
  slotNames: {
    left: '左欄位',
    right: '右欄位',
  },
  // ===== Passcreator `headerFields[0]` per-cardType label (2026-10-24 refactor) =====
  // The Apple Wallet `headerField` is the small label shown at the top of
  // the pass (above the primary field). It is **FIXED per cardType** —
  // NOT driven by Step 3's `settings.leftField`. The tenant sees this
  // label in the Step 1 card-type preview (via `PassCardPreviewHeader`)
  // the moment they pick a card type, and the deployed pass carries the
  // SAME label.
  //
  // Per-kind rules (the cardType → kind mapping lives in
  // `packages/shared/constants/headerSlots.ts::HEADER_SLOTS`):
  //   - member_expiry    (membership_card)  → '會員到期日'
  //   - discount_expiry  (discount_card)    → '有效期限'
  //   - coupon_expiry    (coupon_card)      → '有效期限'
  //   - balance          (stamp / reward / cashback / multipass) → '餘額'
  //   - gift_points      (gift_card)        → '點數'
  //
  // 2026-10-24 — this block used to be a per-cardType
  // `Partial<Record<CardType, {key, label}>>` map, which duplicated the
  // cardType→kind mapping that ALSO lived in the shared header-slot
  // spec and in two frontend resolvers. It is now keyed by KIND only;
  // the cardType→kind mapping has exactly one home
  // (`packages/shared/constants/headerSlots.ts`).
  //
  // Drift guard: the `label` values here MUST equal the editor's
  // `passCard.zh-TW.ts::{memberExpiry,discountExpiry,couponExpiry,
  // balancePreview,giftPointsPreview}.label`. The conformance test
  // `fieldLabels.test.ts::locale-vs-passCard headerField` enforces
  // this by reading the editor i18n file at test time and asserting
  // equality.
  //
  // Typing: `Record<HeaderSlotKind, string>` (not `as const`) so the
  // zh-TW and en locales have the SAME shape — only the values
  // differ. `as const` would lock each entry to a literal type and
  // the two locales would no longer be assignable to the same
  // `FieldLabels` interface, breaking the drift test's `LOCALES`
  // array. Same convention as `memberLevelOverrides`.
  headerLabels: {
    member_expiry:   '會員到期日',
    discount_expiry: '有效期限',
    coupon_expiry:   '有效期限',
    balance:         '餘額',
    gift_points:     '點數',
  } satisfies Record<HeaderSlotKind, string>,
  // Field labels (Step 3 dropdown options, AND Passcreator field labels)
  fieldLabels: {
    phone: '電話',
    email: 'E-mail',
    memberLevel: '會員等級',
    birthday: '生日',
    visitCount: '拜訪次數',
    memberName: '會員姓名',
    // Stamp-only
    availableRewards: '可用獎勵',
    totalStamps: '總印章數',
    stampsRemaining: '還差幾個章',
    // Reward-only
    pointsToNextTier: '到下一階還差',
    currentPoints: '已累積點數',
    // Cashback-only
    pointsToNextTierCashback: '到下個層級還差',
    accumulatedSpendCashback: '已累積消費',
    // Discount-only
    pointsToNextTierDiscount: '到下一級還差',
    discountTierBracket: '折扣級距',
    accumulatedSpendDiscount: '累積消費',
    // Coupon-only
    couponRemainingCount: '剩餘張數',
    couponDiscount: '折扣優惠',
    // Multipass-only
    multipassCompleted: '累積已滿',
    multipassPointsToNextTier: '到下個等級還差',
    multipassRewardContent: '獎勵內容',
  } satisfies Record<CardFieldKey, string>,
  // 2026-10-11 — cardType-aware `memberLevel` overrides used by both
  // the editor Step 3 dropdown (`Step3CardFields::resolveOptionLabelKey`
  // → `cardEditor.zh-TW.ts::step3.fieldsSection.fields.memberLevelStamp`
  // / `memberLevelDiscount`) and the backend Passcreator push
  // (`passTemplateMapping.ts` reads from this same source).
  //
  // Why this lives here instead of duplicating into `cardEditor.zh-TW.ts`:
  // the editor's existing `memberLevelStamp` / `memberLevelDiscount`
  // i18n keys are the user-facing source, but they are inaccessible to
  // the backend (backend modules cannot import the frontend's
  // `i18n/index.ts`). The Passcreator push needs the SAME strings from
  // a module the backend can import — `@saome/shared/i18n/fieldLabels`.
  //
  // Drift guarantee: the values below MUST equal
  // `cardEditor.zh-TW.ts::step3.fieldsSection.fields.memberLevelStamp`
  // and `…memberLevelDiscount`. The conformance test
  // `fieldLabels.test.ts::locale-vs-cardEditor` enforces this.
  //
  // Typing: we use `Partial<Record<CardType, string>>` (not `as const`)
  // so the zh-TW and en locales have the SAME shape — only the values
  // differ. `as const` would lock each entry to a literal type
  // (e.g. `stamp_card: '獎勵'`) and the two locales would no longer
  // be assignable to the same `FieldLabels` interface, breaking the
  // drift test's `LOCALES` array.
  memberLevelOverrides: {
    // stamp / reward / cashback 三種卡都用「獎勵」（per
    // Step3CardFields::resolveOptionLabelKey 的 2026-09-10 stamp 規則 +
    // 2026-09-09 reward 規則 + 2026-09-12 cashback 規則），都對應
    // cardEditor.zh-TW.ts::step3.fieldsSection.fields.memberLevelStamp。
    stamp_card: '獎勵',
    reward_card: '獎勵',
    cashback_card: '獎勵',
    // discount 獨立 key（per 2026-09-18 折扣卡 Step 3 dropdown override），
    // 對應 cardEditor.zh-TW.ts::step3.fieldsSection.fields.memberLevelDiscount。
    // 不沿用 memberLevelStamp — 語意是「折扣等級」不是「獎勵」。
    discount_card: '折扣等級',
  } as Partial<Record<CardType, string>>,
  // Back-side labels (Step 4)
  backSide: {
    title: '卡片資訊',
    hint: '依據 Apple 終端使用者授權協議，每張 Wallet 票卡皆須包含聯絡資訊。請填寫電子郵件地址或電話號碼，以便持卡人聯繫您。',
    addField: '新增欄位',
    removeField: '移除',
    labelPlaceholder: '標籤（選填）',
    valuePlaceholder: '內容（必填）',
    required: '每一組的內容為必填',
    minOne: '至少需要一組背面欄位',
    maxReached: '最多 10 組背面欄位',
  },
  // Editor defaults (empty-card placeholders)
  defaults: {
    cardType: '卡片',
    issuerName: '未命名卡片',
    cardName: '未命名卡片',
  },
  // 2026-10-24 — the `previewPill` block was REMOVED. It duplicated the
  // `headerLabels` content verbatim (a drift test enforced they stayed
  // equal), so it was a second copy of the same 5 strings waiting to
  // drift. `getPreviewPillLabels()` now derives the pill labels from
  // `headerLabels` — see `packages/shared/i18n/fieldLabels.ts`.
};

export type FieldLabelsZhTW = typeof zhTW;
