/**
 * Template settings — couponSettings section.
 *
 * @module shared/schemas/card/templateSettings/coupon
 * @description Part of the flat `templates.settings` JSONB schema.
 *
 * Composed into the single flat object by `templateSettings/index.ts`.
 * The field definitions are copied verbatim from the former
 * `packages/shared/schemas/card.ts` — do not reorder.
 */

import { z } from 'zod';

import {
  COUPON_AMOUNT_MIN,
  COUPON_PERCENT_MIN,
  COUPON_PERCENT_MAX,
  COUPON_ISSUE_COUNT_MIN,
} from '../../../constants/coupon-card';

export const couponSettingsSchema = z.object({
  // ===== Step 6 — Coupon 卡 (2026-09-19, coupon_card only) =====
  // Single flat rule (one coupon = one discount value). Unlike discount_card
  // which is tiered-cumulative-spend → percentage, coupon card has NO tier
  // list — just one discount type + value + issue count.
  //
  // The user picks BETWEEN amount_off and percent_off via a radio group
  // (mutually exclusive — switching type clears the other value field).
  // `couponIssueCount` is card-level: how many coupons to issue per
  // redemption transaction (??1, no upper cap per user decision).
  //
  // Cross-references:
  //   - packages/shared/constants/coupon-card.ts (single source of truth)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * ???????????? amount_off = ????????couponDiscountAmount ??????
   * percent_off = % ???????couponDiscountPercent ??????
   * ??? type ??value ?????????????????store setter ???????
   */
  couponDiscountType: z.enum(['amount_off', 'percent_off']).nullable().optional(),
  /**
   * ??????????????? ??? couponDiscountType === 'amount_off' ??????
   * ???/???????? rewardType=amount_off ??rewardValue ?????
   * ????COUPON_AMOUNT_MIN=1. ????????user decision 2026-09-19??
   * null = 未填.
   */
  couponDiscountAmount: z.number().min(COUPON_AMOUNT_MIN).nullable().optional(),
  /**
   * ?????% ?????? ??? couponDiscountType === 'percent_off' ??????
   * 整數 ∈ [COUPON_PERCENT_MIN, COUPON_PERCENT_MAX].
   * null = 未填.
   */
  couponDiscountPercent: z
    .number()
    .int()
    .min(COUPON_PERCENT_MIN)
    .max(COUPON_PERCENT_MAX)
    .nullable()
    .optional(),
  /**
   * ????????????????????? ??? ??COUPON_ISSUE_COUNT_MIN.
   * ????????user decision 2026-09-19??
   * Default = 1.
   */
  couponIssueCount: z.number().int().min(COUPON_ISSUE_COUNT_MIN).optional(),
});
