/**
 * passCardPreviewSlot — shared slot resolution for CardBuilder preview body
 * AND Template Library preview body.
 *
 * 2026-10-04 PR — Extracted from `PassCardPreviewBody.tsx` so that
 * `TemplateCardPreview.tsx` can use the SAME per-cardType logic when
 * rendering the user's saved-template library cards. Prior to this
 * extraction, the template library preview fell back to generic i18n
 * placeholders (e.g. `fieldPreview.memberLevel.value` = "金級" / "Gold")
 * even when the underlying `settings.membershipTiers[0].name` was
 * populated — see the regression context in the user feedback:
 *   "card type 的替換是依據卡種寫死的，例如 gift 就是寫死點數，
 *    你應該參照 card builder 的設計"
 *
 * What this module owns:
 *   - The full per-cardType branch tree that maps a `{field, cardType}`
 *     pair to a `{label, value}` preview slot.
 *   - The currency-driven `pointsToNextTier*` / `accumulatedSpend*` maps
 *     for cashback / discount cards.
 *   - The store-derived `discountTierBracket` formatting contract.
 *   - The `totalStamps` row-doubling (`stampGridRows × STAMPS_PER_ROW`).
 *   - The i18n-key defensive guard that returns `''` instead of leaking
 *     raw `fieldPreview.foo` paths when a translation is missing.
 *
 * What this module DOES NOT own:
 *   - The JSX layout (left/right columns, label-above-value) — that's a
 *     render-layer concern owned by `PassCardPreviewBody.tsx` /
 *     `TemplateCardPreview.tsx`.
 *   - Data source. `PassCardPreviewBody` reads tier names from
 *     `useCardBuilderStore`; `TemplateCardPreview` reads from
 *     `settings.membershipTiers[0].name` etc. Both call this helper
 *     with their own derived values.
 *   - i18n subscription. The `t` parameter is bound at the call site so
 *     per-card language isolation (TemplateCardPreview uses
 *     `i18n.getFixedT(lng, 'passCard')`) and per-render translator
 *     (PassCardPreviewBody uses `useTranslation('passCard')`) both
 *     compose cleanly.
 *
 * 4-layer conformance contract (Rule 019 § 4.1 layer 1 — single source of truth):
 *   - Branch order is identical to the original
 *     `PassCardPreviewBody.resolveSlot` function. The exhaustive branch
 *     list lives in the docblock above the function body below.
 *
 * Rule ref: this module lives inside the CardBuilderEditor folder, so
 * imports flow from the sibling `PassCardPreviewBody.tsx` (in-feature)
 * and the cross-feature `TemplateCardPreview.tsx` (TemplateCard folder).
 * TemplateCardPreview already imports `useCardBuilderStore` from this
 * folder, so the cross-feature boundary is established.
 */
import type { CardFieldKey } from '@saome/shared/constants/card-fields';
import type { CardType, Currency } from '@saome/shared/schemas/card';
import type { CouponDiscountType } from '@saome/shared/constants/coupon-card';
import type { MultipassRewardType } from '@saome/shared/constants/multipass-card';
import { CASHBACK_PREVIEW_AMOUNTS } from '@saome/shared/constants/cashbackPreviewAmounts';
import { DISCOUNT_PREVIEW_AMOUNTS } from '@saome/shared/constants/discountPreviewAmounts';
import {
  STAMPS_PER_ROW,
  type StampGridRows,
} from '../../../stampCard/StampGridPreview/StampGridPreview.types';

/**
 * Translator function signature. Matches react-i18next's `t` return shape
 * (the second arg is the interpolation params bag).
 *
 * The helper accepts a plain function rather than a hook return so the
 * caller can use either `useTranslation('passCard').t` (Hono chain) or
 * `i18n.getFixedT(lng, 'passCard')` (per-language isolation in
 * TemplateCardPreview). Both compose.
 */
export type PassCardSlotTranslator = (
  key: string,
  opts?: Record<string, unknown>,
) => string;

/**
 * Options for `resolveSlot`. Bundles the 14+ per-cardType fields into a
 * single typed object so the call site is self-documenting and the
 * helper's signature stays stable as we extend it.
 *
 * All optional fields default to `undefined` / `null` at the call site —
 * the helper itself uses sensible fallbacks (placeholder text, empty
 * string, etc.) when a field is missing. This matches the original
 * PassCardPreviewBody contract: empty store values ⇒ empty preview value
 * (no misleading placeholder text).
 */
export interface ResolveSlotOptions {
  /** Left/right field key. `null` / `undefined` ⇒ placeholder slot. */
  field: CardFieldKey | null | undefined;
  /** Stamp grid rows (1..4). Multiplied by STAMPS_PER_ROW for totalStamps. */
  stampGridRows?: StampGridRows;
  /** Current card type — drives per-cardType overrides. */
  cardType?: CardType | null;
  /** Stamp card only: live reward name from the editor (Step 6 reward-name input). */
  rewardName?: string;
  /** Reward card only: first reward tier name. */
  firstRewardTierName?: string;
  /** Cashback card only: first cashback tier name. */
  firstCashbackTierName?: string;
  /** Membership card only: first membership tier name. */
  firstMembershipTierName?: string;
  /** Discount card only: first discount tier name. */
  firstDiscountTierName?: string;
  /** Multipass card only: first multipass tier name (used by memberLevel slot). */
  firstMultipassTierName?: string;
  /** Discount tier bracket value (formatted "<percent>%" string). */
  discountTierBracket?: string;
  /** Coupon card only: discount type discriminator. */
  couponDiscountType?: CouponDiscountType;
  /** Coupon card only: amount_off value. */
  couponDiscountAmount?: number | null;
  /** Coupon card only: percent_off value. */
  couponDiscountPercent?: number | null;
  /** Coupon card only: live remaining count (Step 6 發券張數). */
  firstCouponRemainingCount?: number;
  /** Currency — drives the cashback + discount amount maps. */
  currency: Currency;
  /** Multipass card only: first tier reward type (drives multipassRewardContent). */
  firstMultipassRewardType?: MultipassRewardType | null;
  /** Multipass card only: first tier reward value (interpolated into amountFormat). */
  firstMultipassRewardValue?: number | null;
}

export interface ResolvedSlot {
  label: string;
  value: string;
}

/**
 * Resolve a preview slot's {label, value} pair given the field key + stamp
 * context + cardType.
 *
 * Branch order (regression-pinned — DO NOT REORDER without updating both
 * `PassCardPreviewBody.test.tsx` and `TemplateCardPreview.test.tsx`):
 *   1.  `!field`                                  → placeholder
 *                                                  (左欄位 / 右欄位)
 *   2.  `stamp_card + memberLevel`                → stamp override
 *                                                  (label = stampLabel,
 *                                                   value = rewardName ?? '')
 *   3.  `reward_card + memberLevel`               → reward override
 *                                                  (label = stampLabel,
 *                                                   value = firstRewardTierName ?? '')
 *   4.  `cashback_card + memberLevel`             → cashback override
 *                                                  (label = stampLabel,
 *                                                   value = firstCashbackTierName ?? '')
 *   5.  `membership_card + memberLevel`           → membership override
 *                                                  (label = default memberLevel.label,
 *                                                   value = firstMembershipTierName ?? '')
 *                                                  — RESTORED 2026-09-13, different label
 *                                                  from stamp/reward/cashback.
 *   6.  `multipass + memberLevel`                 → multipass override
 *                                                  (label = default memberLevel.label,
 *                                                   value = firstMultipassTierName ?? '')
 *                                                  — mirrors membership_card.
 *   7.  `discount_card + memberLevel`             → discount override
 *                                                  (label = discountLabel,
 *                                                   value = firstDiscountTierName ?? '')
 *                                                  — distinct label from stamp/reward/cashback/membership.
 *   8.  `coupon_card + couponRemainingCount`      → store-driven count via i18n
 *                                                  countFormat "{{count}}張" /
 *                                                  "{{count}} sheets"; falls back to
 *                                                  static demo when undefined.
 *   9.  `coupon_card + couponDiscount`            → store-driven amount / percent via i18n
 *                                                  amountFormatTWD/ZAR / percentFormat;
 *                                                  empty string when user hasn't entered yet.
 *  10.  `multipass + multipassCompleted`          → static demo "1次" / "1 time"
 *  11.  `multipass + multipassPointsToNextTier`   → static demo "2次集滿" / "2 to next"
 *  12.  `multipass + multipassRewardContent`      → store-driven via amountFormatTWD/ZAR /
 *                                                  percentFormat; empty string when null.
 *  13.  `discountTierBracket`                     → store-derived "X%" (NOT i18n,
 *                                                  NOT currency)
 *  14.  `totalStamps`                             → rows × STAMPS_PER_ROW interpolation
 *  15.  cashback amount fields                    → CASHBACK_PREVIEW_AMOUNTS[currency][field]
 *                                                  (currency-driven, like balance preview)
 *  16.  discount amount fields                    → DISCOUNT_PREVIEW_AMOUNTS[currency][field]
 *                                                  (currency-driven)
 *  17.  default                                 → `fieldPreview.{key}.label` + `.value`
 *                                                  (NO ZAR formatter — values are demo
 *                                                   data and are NOT currency-dependent)
 *
 * 2026-09-13 ZAR pollution fix — REMOVED regex-based formatter:
 *   Previously, the default branch applied a regex-based `R` prefix formatter
 *   to ALL `default` branch i18n values when `currency === 'ZAR'`. This
 *   caused wide-spread contamination of every non-amount field on every card
 *   type. Now the regex is GONE; the default branch reads
 *   `fieldPreview.{key}.value` as-is. Only the cashback/discount amount
 *   branches go through the currency-driven maps; everything else is
 *   currency-agnostic demo data.
 *
 * 2026-09-20 defensive guard:
 *   If `t()` returns the same string it was given (i.e. the translation
 *   key was not found in the locale), fall back to an empty string
 *   instead of leaking the raw i18n key path into the preview. This
 *   catches future schema drift where a new display field is added to
 *   the dropdown but its i18n entry is forgotten.
 */
export function resolveSlot(
  t: PassCardSlotTranslator,
  options: ResolveSlotOptions,
): ResolvedSlot {
  const {
    field,
    stampGridRows,
    cardType,
    rewardName,
    firstRewardTierName,
    firstCashbackTierName,
    firstMembershipTierName,
    firstDiscountTierName,
    firstMultipassTierName,
    discountTierBracket,
    couponDiscountType,
    couponDiscountAmount,
    couponDiscountPercent,
    firstCouponRemainingCount,
    currency,
    firstMultipassRewardType,
    firstMultipassRewardValue,
  } = options;

  if (!field) {
    return { label: t('fieldLabelLeft'), value: t('fieldLabelRight') };
  }

  // Stamp card override: the `memberLevel` slot becomes a "Reward" slot
  // (label = stampLabel) whose value reflects whatever the user typed in
  // the Step 6 reward-name input. Per user-confirmed UX, an empty
  // `rewardName` renders as an empty string rather than to the
  // demo "金級" / "Gold" string — this avoids showing a stale preview
  // before the user has typed anything.
  if (cardType === 'stamp_card' && field === 'memberLevel') {
    return {
      label: t('fieldPreview.memberLevel.stampLabel'),
      value: rewardName ?? '',
    };
  }

  // Reward card override: same label as stamp_card ("Reward"), but the
  // value source is the FIRST row of the Step 6 `rewardTiers` array
  // instead of a top-level string. Empty / undefined / no-tiers → empty
  // string (matches stamp_card empty-input UX).
  if (cardType === 'reward_card' && field === 'memberLevel') {
    return {
      label: t('fieldPreview.memberLevel.stampLabel'),
      value: firstRewardTierName ?? '',
    };
  }

  // Cashback card override: same label as stamp_card / reward_card ("Reward"),
  // but the value source is the FIRST row of the Step 6 `cashbackTiers` array.
  // Empty / undefined / no-tiers → empty string (matches stamp/reward UX).
  if (cardType === 'cashback_card' && field === 'memberLevel') {
    return {
      label: t('fieldPreview.memberLevel.stampLabel'),
      value: firstCashbackTierName ?? '',
    };
  }

  // Membership card override (2026-09-13, restored): the `memberLevel`
  // slot keeps its DEFAULT label ("會員等級" / "Member Level") — different
  // from stamp/reward/cashback which use stampLabel ("獎勵" / "Reward").
  // The value source is the FIRST row of the Step 6 `membershipTiers`
  // array. Empty / undefined / no-tiers → empty string (matches the
  // stamp/reward/cashback empty-input UX).
  //
  // 2026-10-04 PR — Used by TemplateCardPreview: when a saved
  // membership_card template is rendered in the library,
  // `firstMembershipTierName` is sourced from
  // `settings.membershipTiers[0].name` (not the editor store). This
  // makes the library preview match the editor preview 1:1.
  if (cardType === 'membership_card' && field === 'memberLevel') {
    return {
      label: t('fieldPreview.memberLevel.label'),
      value: firstMembershipTierName ?? '',
    };
  }

  // MultiPass override (2026-09-20): reuses the existing common
  // `memberLevel` key (no dedicated `multipassMemberLevel` is needed).
  // Mirrors the membership_card pattern above:
  //   label = default `fieldPreview.memberLevel.label`
  //   value = `firstMultipassTierName ?? ''`
  // Empty / undefined / no-tiers → empty string.
  if (cardType === 'multipass' && field === 'memberLevel') {
    return {
      label: t('fieldPreview.memberLevel.label'),
      value: firstMultipassTierName ?? '',
    };
  }

  // Discount card override (2026-09-18): the `memberLevel` slot uses a
  // DISTINCT label ("折扣等級" / "Discount Tier") — different from
  // stamp/reward/cashback (which use stampLabel "Reward") AND from
  // membership (which uses default `memberLevel.label`). The value
  // source is the FIRST row of the Step 6 `discountTiers` array
  // (same contract as cashback/membership).
  if (cardType === 'discount_card' && field === 'memberLevel') {
    return {
      label: t('fieldPreview.memberLevel.discountLabel'),
      value: firstDiscountTierName ?? '',
    };
  }

  // Coupon card branches (2026-09-19, refined 2026-09-20).
  // Placed BEFORE the `discountTierBracket` / `totalStamps` /
  //   cashback/discount amount branches because coupon branches are
  //   keyed by a cardType-specific check (`cardType === 'coupon_card'`)
  //   which is more specific than any key-only branch below.
  if (cardType === 'coupon_card' && field === 'couponRemainingCount') {
    // 2026-09-20: when `firstCouponRemainingCount` is a number, the
    // body composes the value via i18n `countFormat` ("{{count}}張" /
    // "{{count}} sheets") so the unit stays localised. When undefined
    // (i.e. `couponIssueCount === 1` at the editor level), the static
    // demo value "1張" / "1 sheet" surfaces instead.
    const value =
      firstCouponRemainingCount !== undefined
        ? t('fieldPreview.couponRemainingCount.countFormat', {
            count: firstCouponRemainingCount,
          })
        : t('fieldPreview.couponRemainingCount.value');
    return {
      label: t('fieldPreview.couponRemainingCount.label'),
      value,
    };
  }

  if (cardType === 'coupon_card' && field === 'couponDiscount') {
    // 2026-09-19 bug fix: read store values + interpolate into i18n
    // templates instead of using the hardcoded currency-driven map.
    // `couponDiscountType` decides which template to use.
    let value: string;
    if (couponDiscountType === 'amount_off') {
      if (couponDiscountAmount !== null && couponDiscountAmount !== undefined) {
        const formatKey =
          currency === 'ZAR'
            ? 'fieldPreview.couponDiscount.amountFormatZAR'
            : 'fieldPreview.couponDiscount.amountFormatTWD';
        value = t(formatKey, { amount: couponDiscountAmount });
      } else {
        value = '';
      }
    } else if (couponDiscountType === 'percent_off') {
      if (couponDiscountPercent !== null && couponDiscountPercent !== undefined) {
        value = t('fieldPreview.couponDiscount.percentFormat', {
          percent: couponDiscountPercent,
        });
      } else {
        value = '';
      }
    } else {
      value = '';
    }
    return {
      label: t('fieldPreview.couponDiscount.label'),
      value,
    };
  }

  // MultiPass amount branches (2026-09-20): placed after the coupon
  // branches and the memberLevel override cluster because they're keyed
  // by `cardType === 'multipass'` (no more specific than the coupon
  // branches). The multipass "Member Level" slot is NOT here — it
  // reuses the common `memberLevel` key via the override branch above.
  if (cardType === 'multipass' && field === 'multipassCompleted') {
    return {
      label: t('fieldPreview.multipassCompleted.label'),
      value: t('fieldPreview.multipassCompleted.value'),
    };
  }

  if (cardType === 'multipass' && field === 'multipassPointsToNextTier') {
    return {
      label: t('fieldPreview.multipassPointsToNextTier.label'),
      value: t('fieldPreview.multipassPointsToNextTier.value'),
    };
  }

  if (cardType === 'multipass' && field === 'multipassRewardContent') {
    let value = '';
    if (firstMultipassRewardType === 'amount_off' && firstMultipassRewardValue != null) {
      value =
        currency === 'ZAR'
          ? t('fieldPreview.multipassRewardContent.amountFormatZAR', {
              amount: firstMultipassRewardValue,
            })
          : t('fieldPreview.multipassRewardContent.amountFormatTWD', {
              amount: firstMultipassRewardValue,
            });
    } else if (
      firstMultipassRewardType === 'percent_off' &&
      firstMultipassRewardValue != null
    ) {
      value = t('fieldPreview.multipassRewardContent.percentFormat', {
        percent: firstMultipassRewardValue,
      });
    }
    return {
      label: t('fieldPreview.multipassRewardContent.label'),
      value,
    };
  }

  if (field === 'discountTierBracket') {
    return {
      label: t(`fieldPreview.${field}.label`),
      value: discountTierBracket ?? '',
    };
  }

  if (field === 'totalStamps') {
    // The user picks a row count (1..4); the displayed denominator is the
    // total stamp count = rows × STAMPS_PER_ROW. We pre-multiply here so
    // the i18n template stays simple (`'3/{{rows}}'`) and the geometry
    // contract is captured in code rather than in the translation string.
    const totalStamps = (stampGridRows ?? 1) * STAMPS_PER_ROW;
    return {
      label: t(`fieldPreview.${field}.label`),
      value: t(`fieldPreview.${field}.value`, { rows: totalStamps }),
    };
  }

  // Cashback amount branch (2026-09-13 ZAR pollution fix): the two
  // cashback-only display fields are currency-driven, NOT i18n-driven.
  if (
    field === 'pointsToNextTierCashback' ||
    field === 'accumulatedSpendCashback'
  ) {
    return {
      label: t(`fieldPreview.${field}.label`),
      value: CASHBACK_PREVIEW_AMOUNTS[currency][field],
    };
  }

  // Discount amount branch (2026-09-18): the two discount-only display
  // fields are currency-driven, NOT i18n-driven.
  if (
    field === 'pointsToNextTierDiscount' ||
    field === 'accumulatedSpendDiscount'
  ) {
    return {
      label: t(`fieldPreview.${field}.label`),
      value: DISCOUNT_PREVIEW_AMOUNTS[currency][field],
    };
  }

  // Default: read label + value from i18n fieldPreview.{key} verbatim.
  // 2026-09-20 defensive guard: if `t()` returns the same string it
  // was given, fall back to an empty string instead of leaking the raw
  // i18n key path into the preview.
  const label = t(`fieldPreview.${field}.label`);
  const value = t(`fieldPreview.${field}.value`);
  const safeLabel = label.startsWith('fieldPreview.') ? '' : label;
  const safeValue = value.startsWith('fieldPreview.') ? '' : value;
  return {
    label: safeLabel,
    value: safeValue,
  };
}

/**
 * Convenience helper for TemplateCardPreview.
 *
 * Derives all per-cardType tier-name overrides from the saved-template
 * `settings` blob. Used by the Template Library preview so the library
 * grid renders the SAME per-cardType body as the editor — no
 * placeholder text leaking when `settings.membershipTiers[0].name`
 * is populated.
 *
 * Returns the values needed to call `resolveSlot`. The caller still
 * passes `field` / `currency` / `cardType` / `stampGridRows` because
 * those come from either the user's selected fields or `settings` shape.
 *
 * 2026-10-04 PR — Bridges the editor store (live editing) and the
 * template library (read-only preview) so both share the per-cardType
 * override tree in `resolveSlot` above. The library does NOT have
 * access to `useCardBuilderStore` (each card is a separate template,
 * not a single in-progress editor session), so it sources everything
 * from `settings` directly.
 */
export interface TemplateSettingsLike {
  cardType?: CardType;
  barcodeType?: 'qr_code' | 'pdf_417';
  /** @deprecated unused by the helper — kept for type compat with the consumer. */
  stampGridRows?: StampGridRows;
  /** @deprecated unused by the helper — kept for type compat with the consumer. */
  stampIconId?: string;
  membershipTiers?: Array<{ name?: string }>;
  rewardTiers?: Array<{ name?: string }>;
  cashbackTiers?: Array<{ name?: string }>;
  discountTiers?: Array<{ name?: string; discountPercent?: number }>;
  multipassTiers?: Array<{ name?: string; rewardType?: MultipassRewardType | null; rewardValue?: number | null }>;
  /**
   * Coupon discount type. Matches the shared schema's
   * `.nullable().optional()` semantics — `null` means "user hasn't picked a
   * type yet"; `undefined` means "field not present in payload". The
   * resolveSlot `couponDiscount` branch treats `null` and `undefined`
   * the same way (renders an empty string).
   */
  couponDiscountType?: CouponDiscountType | null;
  couponDiscountAmount?: number | null;
  couponDiscountPercent?: number | null;
  couponIssueCount?: number;
  /** Card currency — drives cashback / discount / multipass amount branches. */
  currency?: Currency;
}

export function deriveTemplateOverrides(
  settings: TemplateSettingsLike | undefined,
): Omit<
  ResolveSlotOptions,
  'field' | 'stampGridRows' | 'cardType' | 'currency'
> {
  const rewardName = undefined; // stamp_card top-level name field doesn't exist on templates
  const firstRewardTierName = settings?.rewardTiers?.[0]?.name;
  const firstCashbackTierName = settings?.cashbackTiers?.[0]?.name;
  const firstMembershipTierName = settings?.membershipTiers?.[0]?.name;
  const firstDiscountTierName = settings?.discountTiers?.[0]?.name;
  const firstMultipassTierName = settings?.multipassTiers?.[0]?.name;
  const discountTierBracket = settings?.discountTiers?.[0]?.discountPercent != null
    ? `${settings.discountTiers[0].discountPercent}%`
    : '';
  // Coupon remaining count: surfaces when the user explicitly set
  // couponIssueCount to a non-default value (>= 1 with a real change).
  // The store seeds 1 (default); we mirror that contract — undefined
  // when couponIssueCount is undefined OR === 1 (so the demo static
  // value surfaces).
  const firstCouponRemainingCount =
    settings?.couponIssueCount !== undefined && settings.couponIssueCount !== 1
      ? settings.couponIssueCount
      : undefined;
  const firstMultipassRewardType = settings?.multipassTiers?.[0]?.rewardType ?? null;
  const firstMultipassRewardValue = settings?.multipassTiers?.[0]?.rewardValue ?? null;

  return {
    rewardName,
    firstRewardTierName,
    firstCashbackTierName,
    firstMembershipTierName,
    firstDiscountTierName,
    firstMultipassTierName,
    discountTierBracket,
    couponDiscountType: settings?.couponDiscountType ?? undefined,
    couponDiscountAmount: settings?.couponDiscountAmount,
    couponDiscountPercent: settings?.couponDiscountPercent,
    firstCouponRemainingCount,
    firstMultipassRewardType,
    firstMultipassRewardValue,
  };
}

// ─── Header right-slot resolver (2026-10-05) ──────────────────────────────
//
// Per-cardType rules that govern which 2-line preview block (or default
// pill) replaces the right side of the card header. The branch tree mirrors
// `PassCardPreviewHeader.tsx`:
//   - membership_card    → member expiry preview  ("會員到期日" / "∞")
//   - discount_card      → discount expiry preview  ("有效期限")
//   - coupon_card        → coupon expiry preview    ("有效期限")
//   - stamp_card / reward_card / cashback_card / multipass
//                        → balance preview          ("餘額")
//   - gift_card          → gift points preview      ("點數" / "2363點")
//   - null / undefined   → default pill (rounded-full, t('defaultCardType'))
//
// The editor (`PassCardPreviewHeader`) and the library
// (`TemplateCardPreview`) BOTH need this branch tree — the editor reads
// from `useCardBuilderStore`; the library reads from the saved
// `settings` blob. The shared helper accepts a flat inputs bag so both
// callers can pre-extract their respective values without coupling the
// helper to either store.
//
// Why a separate helper (vs inline duplicate):
//   - Single source of truth for the per-cardType branch order. Drift
//     between editor + library preview was the 2026-10-05 user feedback
//     ("這裡沒有被卡片模板的Header fields替換，每個卡片有自己的Header
//     fields規則" — library showed a generic "Membership Card" pill
//     while editor correctly showed the member-expiry block).
//   - Date math (today + N days) and locale-driven formatting
//     (`YYYY.MM.DD` zh-TW / `MM.DD.YYYY` en) are encapsulated here so
//     the editor doesn't have to reimplement them.

import { BALANCE_PREVIEW_AMOUNTS } from '@saome/shared/constants/balancePreview';
import { GIFT_POINTS_PREVIEW_VALUE } from '@saome/shared/constants/gift-card';

/** Hardcoded fallback expiry used by `membership_card` when `hasExpiry=true`
 *  but `expiryDate` is empty (membership cards hide step2's expiry fields by
 *  design — see `membership_card_conditional_ui_hide` plan). Matches the
 *  same constant in `PassCardPreviewHeader.tsx`. */
const DEFAULT_EXPIRY_DATE = '2027-10-23';

/** Card types whose right-slot is replaced by the balance preview block.
 *  Mirrors `BALANCE_PREVIEW_CARD_TYPES` in `PassCardPreviewHeader.tsx`. */
const BALANCE_HEADER_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'stamp_card',
  'reward_card',
  'cashback_card',
  'multipass',
]);

/**
 * Discriminated union: either a default pill OR a 2-line preview block.
 * Callers branch on `kind` to render the appropriate JSX.
 */
export type HeaderRightSlot =
  | { kind: 'pill'; label: string }
  | { kind: 'preview'; label: string; value: string; testId: string };

/** Inputs bag for `resolveHeaderRightSlot`. All fields are optional
 *  except `cardType` (which can be `null`) and `currency` (used by
 *  balance cards). Callers extract these from their respective data
 *  source (editor store vs saved settings) before invoking the helper. */
export interface HeaderRightSlotInputs {
  /** Card type from settings / store. `null` / `undefined` ⇒ pill branch. */
  cardType: CardType | null | undefined;
  /** `membership_card` only: whether the membership has an expiry. */
  hasExpiry?: boolean;
  /** `membership_card` + `coupon_card`: ISO `YYYY-MM-DD` expiry date string. */
  expiryDate?: string;
  /** `discount_card` only: N days from today (mutually exclusive with
   *  `discountSpecificExpiryDate` at the field-handler level). */
  discountCustomExpiryDays?: number | null;
  /** `discount_card` only: absolute expiry date (mutually exclusive with
   *  `discountCustomExpiryDays`). */
  discountSpecificExpiryDate?: string | null;
  /** `coupon_card` only: N days from today (Step 2 card-level field). */
  passValidDays?: number | null;
  /** Balance / discount / multipass preview amount — driven by the
   *  card-level currency selection. */
  currency: Currency;
  /** Locale code for date formatting (zh-TW: YYYY.MM.DD, en: MM.DD.YYYY).
   *  Defaults to empty string (en-style MM.DD.YYYY) when omitted. */
  locale?: string;
}

/**
 * Locale-driven `YYYY-MM-DD` → display format helper.
 *
 *   zh-TW: `2027-10-23` → `2027.10.23`
 *   en:    `2027-10-23` → `10.23.2027`
 *
 * Returns the input verbatim when it doesn't match `YYYY-MM-DD` —
 * defensive against malformed input from the store / DB.
 */
export function formatExpiryDateForHeader(
  isoDate: string,
  locale: string,
): string {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  const isZhLocale = (locale ?? '').startsWith('zh');
  if (isZhLocale) return `${year}.${month}.${day}`;
  return `${month}.${day}.${year}`;
}

/**
 * Compute the discount-card expiry value: today + N days when
 * `discountCustomExpiryDays` is set; otherwise the absolute date.
 * Returns `—` (em-dash) when both are null (theoretical — Step 6
 * requires one of them).
 */
function computeDiscountExpiryValue(
  inputs: HeaderRightSlotInputs,
): string {
  const {
    discountCustomExpiryDays,
    discountSpecificExpiryDate,
    locale = '',
  } = inputs;
  if (discountCustomExpiryDays !== null && discountCustomExpiryDays !== undefined) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + discountCustomExpiryDays);
    const yyyy = future.getFullYear();
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');
    return formatExpiryDateForHeader(`${yyyy}-${mm}-${dd}`, locale);
  }
  if (discountSpecificExpiryDate) {
    return formatExpiryDateForHeader(discountSpecificExpiryDate, locale);
  }
  return '—';
}

/**
 * Compute the coupon-card expiry value: today + N days when
 * `passValidDays` is set; otherwise the absolute date. Falls back to
 * `∞` (infinity) when both are empty — coupons have no implied
 * expiry, mirroring membership's `hasExpiry=false` UX.
 */
function computeCouponExpiryValue(
  inputs: HeaderRightSlotInputs,
): string {
  const { passValidDays, expiryDate, locale = '' } = inputs;
  if (passValidDays !== null && passValidDays !== undefined) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + passValidDays);
    const yyyy = future.getFullYear();
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');
    return formatExpiryDateForHeader(`${yyyy}-${mm}-${dd}`, locale);
  }
  if (expiryDate) {
    return formatExpiryDateForHeader(expiryDate, locale);
  }
  return '∞';
}

/**
 * Resolve the right-slot of the card header. The branch order mirrors
 * `PassCardPreviewHeader.tsx` so the editor + library preview are
 * visually consistent.
 *
 * Branch order (regression-pinned — DO NOT REORDER):
 *   1. `membership_card`        → member expiry preview
 *   2. `discount_card`          → discount expiry preview
 *   3. `coupon_card`            → coupon expiry preview
 *   4. `stamp_card / reward_card / cashback_card / multipass`
 *                                → balance preview (currency-driven)
 *   5. `gift_card`              → gift points preview (hardcoded value)
 *   6. `null` / `undefined`     → default pill (`t('defaultCardType')`)
 *
 * Returns a discriminated union (`{kind: 'pill'} | {kind: 'preview'}`)
 * so the caller can branch on `kind` cleanly.
 */
export function resolveHeaderRightSlot(
  t: PassCardSlotTranslator,
  inputs: HeaderRightSlotInputs,
): HeaderRightSlot {
  const { cardType, hasExpiry, expiryDate, currency, locale = '' } = inputs;

  // 1. membership_card → member expiry
  if (cardType === 'membership_card') {
    const value = hasExpiry
      ? formatExpiryDateForHeader(expiryDate || DEFAULT_EXPIRY_DATE, locale)
      : '∞';
    return {
      kind: 'preview',
      label: t('memberExpiry.label'),
      value,
      testId: 'member-expiry-preview',
    };
  }

  // 2. discount_card → discount expiry
  if (cardType === 'discount_card') {
    return {
      kind: 'preview',
      label: t('discountExpiry.label'),
      value: computeDiscountExpiryValue(inputs),
      testId: 'discount-expiry-preview',
    };
  }

  // 3. coupon_card → coupon expiry
  if (cardType === 'coupon_card') {
    return {
      kind: 'preview',
      label: t('couponExpiry.label'),
      value: computeCouponExpiryValue(inputs),
      testId: 'coupon-expiry-preview',
    };
  }

  // 4. balance cards → balance preview (currency-driven)
  if (
    cardType !== null &&
    cardType !== undefined &&
    BALANCE_HEADER_CARD_TYPES.has(cardType)
  ) {
    return {
      kind: 'preview',
      label: t('balancePreview.label'),
      value: BALANCE_PREVIEW_AMOUNTS[currency],
      testId: 'balance-preview',
    };
  }

  // 5. gift_card → gift points preview (hardcoded)
  if (cardType === 'gift_card') {
    return {
      kind: 'preview',
      label: t('giftPointsPreview.label'),
      value: GIFT_POINTS_PREVIEW_VALUE,
      testId: 'gift-points-preview',
    };
  }

  // 6. null / undefined → default pill
  return {
    kind: 'pill',
    label: t('defaultCardType'),
  };
}