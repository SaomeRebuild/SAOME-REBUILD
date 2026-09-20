/**
 * PreviewWrapper — 包裝層 Props
 *
 * Wraps PassCardPreview inside PhoneFrame (optional). The wrapper currently
 * only forwards card props to the preview; the icon image is consumed
 * independently by MediaAssetUploader/Preview (128×128) which reads from
 * the same Zustand store.
 */

import type { PassCardPreviewProps } from '../CardPreview/PassCardPreview.types';
import type { BarcodeType } from '@saome/shared/schemas/cardBuilder';
import type { CardFieldKey } from '@saome/shared/constants/card-fields';
import type { StampGridRows } from '@/components/business/stampCard/StampGridPreview';

export interface PreviewWrapperProps {
  /** 卡片名稱 */
  name: string;
  /** 卡片類型 */
  cardType?: PassCardPreviewProps['cardType'];
  /** 發卡機構標誌 */
  issuerLogo?: string;
  /** 卡片背景圖（可選，R2 URL）*/
  backgroundImage?: string;
  /** 卡片背景色 */
  backgroundColor?: string;
  /** 卡片文字色 */
  textColor?: string;
  /** 顯示的面 */
  side?: 'front' | 'back';
  /** 持有人名稱 */
  holderName?: string;
  /** Barcode 格式 */
  barcodeType?: BarcodeType;
  /** 是否顯示手機框架 */
  showPhoneFrame?: boolean;
  /**
   * 左欄位選取的 field key（null = 顯示 placeholder）。
   * 對應 templateSettings.leftField（DB 層）；傳遞給 PassCardPreview。
   */
  leftField?: CardFieldKey | null;
  /**
   * 右欄位選取的 field key（null = 顯示 placeholder）。
   * 對應 templateSettings.rightField（DB 層）；傳遞給 PassCardPreview。
   */
  rightField?: CardFieldKey | null;
  /**
   * 集點印章：行數（1..4）。對應 templateSettings.stampGridRows。
   * 與 cardType + stampIconId 共同決定 strip 是否 render StampGridPreview。
   * Stamp grid feature 2026-09-04。
   */
  stampGridRows?: StampGridRows;
  /**
   * 集點印章：icon manifest id（例如 'bell'）。對應 templateSettings.stampIconId。
   * 空字串或 undefined 時，strip 維持既有 CreditCard icon + name 渲染。
   * Stamp grid feature 2026-09-04。
   */
  stampIconId?: string;
  /**
   * Live reward name from the editor store (Step 6 `step6-reward-name`
   * input). Forwarded to PassCardPreviewBody so the `memberLevel` slot
   * surfaces as a "獎勵" preview with this value when cardType is
   * `stamp_card` (2026-09-10 stamp card member-level → reward refactor).
   */
  rewardName?: string;
  /**
   * First reward tier name from the editor store (Step 6
   * `rewardTiers[0].name`). Forwarded to PassCardPreviewBody so the
   * `memberLevel` slot surfaces as a "獎勵" preview with this value when
   * cardType is `reward_card`. Differs from `rewardName` only in the data
   * source: reward_card reads the first row of the multi-tier array instead
   * of a top-level string. Empty / undefined / no-tiers → empty string in
   * the preview (matches stamp_card empty-input UX).
   * (2026-09-10 reward card member-level → reward refactor extension.)
   */
  firstRewardTierName?: string;
  /**
   * First cashback tier name from the editor store (Step 6
   * `cashbackTiers[0].name`). Forwarded to PassCardPreviewBody so the
   * `memberLevel` slot surfaces as a "獎勵" preview with this value when
   * cardType is `cashback_card`. Differs from `rewardName` /
   * `firstRewardTierName` only in the data source: cashback_card uses a
   * multi-tier structure. (2026-09-12.)
   */
  firstCashbackTierName?: string;
  /**
   * 2026-09-13 membership card — 會員獎勵 sub-rows from the first
   * membership tier (`membershipTiers[0].rewards`). Forwarded to
   * PassCardPreviewBack as Section 1.5.
   */
  membershipTiersRewards?: ReadonlyArray<{ label: string; value: string }>;
  /**
   * 2026-09-18 discount card — First discount tier name from the editor
   * store (Step 6 `discountTiers[0].name`). Forwarded to
   * PassCardPreviewBody so the `memberLevel` slot surfaces as a
   * "折扣等級" preview with this value when cardType is `discount_card`.
   * Optional — when omitted / empty / no-tiers, the preview renders an
   * empty string (matches stamp/reward/cashback/membership empty-input
   * UX).
   *
   * Mirrors the `firstCashbackTierName` / `firstMembershipTierName`
   * pattern: each card type reads the FIRST tier's name from its own
   * multi-tier array.
   */
  firstDiscountTierName?: string;
  /**
   * 2026-09-19 coupon card — Number of coupons to render for the
   * `couponRemainingCount` preview slot. Forwarded to PassCardPreviewBody
   * which interpolates it into i18n `couponRemainingCount.countFormat`
   * template (e.g. "5張" / "5 sheets"). Mirrors the `firstXxxTierName`
   * family for future coupon lifecycle wiring.
   *
   * 2026-09-20 type change: was `string` (the preview bridged
   * `String(couponIssueCount)` directly into the value slot, which lost
   * the i18n unit suffix and rendered bare digits like "5"). Now
   * `number | undefined` so the body can compose the unit via i18n.
   * When omitted / undefined, body falls back to the i18n static demo
   * value "1張" / "1 sheet" (matching the phone / email / visitCount
   * static-demo pattern).
   */
  firstCouponRemainingCount?: number;
  /**
   * 2026-09-19 coupon card — Discount type discriminator from the editor
   * store (`couponDiscountType`). Forwarded to PassCardPreviewBody;
   * body uses it to choose between the currency-driven map and the
   * store-driven percent template. Optional — body reads from store as
   * fallback (so we don't always need to thread this through).
   */
  couponDiscountType?: import('@saome/shared/constants/coupon-card').CouponDiscountType;
  /**
   * 2026-09-19 coupon card — Cash discount amount from the editor store.
   * Currently not rendered directly in the preview (the discount slot
   * uses currency-driven defaults for amount_off); reserved for future
   * per-template override.
   */
  couponDiscountAmount?: number | null;
  /**
   * 2026-09-19 coupon card — Percent discount (1-100) from the editor
   * store. Forwarded to PassCardPreviewBody so the `couponDiscount`
   * slot renders `<percent>%折扣` when couponDiscountType is percent_off.
   */
  couponDiscountPercent?: number | null;
  /**
   * 2026-09-20 multipass card — First multipass tier reward type from the
   * editor store (Step 6 `multipassTiers[0].rewardType`). Forwarded to
   * PassCardPreviewBody so the `multipassRewardContent` slot can render
   * amount_off → amountFormatTWD/ZAR or percent_off → percentFormat.
   */
  firstMultipassRewardType?: import('@saome/shared/constants/multipass-card').MultipassRewardType | null;
  /**
   * 2026-09-20 multipass card — First multipass tier reward value from the
   * editor store (Step 6 `multipassTiers[0].rewardValue`). Interpolated
   * into the amountFormatTWD / amountFormatZAR / percentFormat i18n template
   * for the `multipassRewardContent` preview slot.
   */
  firstMultipassRewardValue?: number | null;
  /**
   * 2026-09-20 multipass card — First multipass tier name from the editor
   * store (Step 6 `multipassTiers[0].name`). Surfaced as the preview
   * `value` for the COMMON `memberLevel` slot when `cardType === 'multipass'`
   * (PassCardPreviewBody applies the multipass override branch — mirrors
   * the `membership_card` pattern). The label uses the default
   * `fieldPreview.memberLevel.label` ("會員等級" / "Member Level"), NOT
   * `stampLabel` — multipass is a tier-identity card.
   *
   * Optional — when omitted / undefined / when `multipassTiers` is empty,
   * the preview renders an empty value (matches stamp/reward/cashback/
   * membership empty-input UX).
   *
   * Note: the original 2026-09-20 implementation used a dedicated
   * `multipassMemberLevel` CardFieldKey + a `fieldPreview.multipassMemberLevel`
   * translation. After 2026-09-20 review, the dedicated key was found
   * redundant: the common `memberLevel` slot already exists in the
   * dropdown (its `hideOnCardTypes: ['coupon_card']` does NOT exclude
   * multipass), and mirroring the `membership_card` override pattern
   * keeps the label semantic consistent. Removed the dedicated key.
   */
  firstMultipassTierName?: string;
  /**
   * 2026-09-13 membership card — boolean flag indicating the card is a
   * paid membership card. Gates:
   *   - PassCardPreviewStrip: switch to UserIcon + label/value pair
   *     (replaces default icon + name).
   *   - PassCardPreviewBack: gate 會員獎勵 Section 1.5 visibility.
   * Set by CardBuilderEditorPreview from `store.isPaid && cardType === 'membership_card'`.
   */
  isMembership?: boolean;
  /**
   * 卡片描述（背面 Section 1）。對應 templateSettings.description。
   * Step 4 card-info 2026-09-04。
   */
  description?: string;
  /**
   * 背面欄位（背面 Section 4）。對應 templateSettings.backFields。
   * Step 4 card-info 2026-09-04。
   */
  backFields?: ReadonlyArray<{ label: string; value: string }>;
  /**
   * 專屬連結（背面 Section 5）。對應 templateSettings.links。
   * Step 4 card-info 2026-09-04。
   */
  links?: ReadonlyArray<{ label: string; value: string }>;
}
