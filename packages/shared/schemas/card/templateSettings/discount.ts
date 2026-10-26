/**
 * Template settings — discountSettings section.
 *
 * @module shared/schemas/card/templateSettings/discount
 * @description Part of the flat `templates.settings` JSONB schema.
 *
 * Composed into the single flat object by `templateSettings/index.ts`.
 * The field definitions are copied verbatim from the former
 * `packages/shared/schemas/card.ts` — do not reorder.
 */

import { z } from 'zod';

export const discountSettingsSchema = z.object({
  // ===== Step 6 — Discount 卡 (2026-09-18, discount_card only) =====
  // Mirrors mu-plugins cashback-tier structure but semantically
  // represents a DISCOUNT (reduces purchase price) rather than
  // CASHBACK (refund after purchase). Same shape as cashbackTiers;
  // the percent field is `discountPercent` instead of `cashbackPercent`.
  //
  // Cross-references:
  //   - packages/shared/constants/discount-card.ts (single source of truth)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * ????????? (????5 ??.
   * 每個 tier 包含 name + thresholdSpend + discountPercent.
   *
   * 排序由前端 store 負責（thresholdSpend ASC，threshold=0 在最前）;
   * ??????????????????????????   */
  discountTiers: z
    .array(
      z.object({
        /** ????????? (?? "????", "VIP"). Required. */
        name: z.string().min(1).max(40),
        /** 累積消費門檻 (in store currency units). 0 = 預設 tier, 人人享有. */
        thresholdSpend: z.number().min(0),
        /** ???%?? ??? [1, 100]. */
        discountPercent: z.number().int().min(1).max(100),
      }),
    )
    .max(5)
    .optional(),
  // ===== Step 6 — Discount 卡 expiry (2026-09-18, discount_card only) =====
  // Optional card-level expiry. Mirrors membership expiry pattern:
  // two nullable fields, mutually exclusive at the field handler level,
  // no card-wide toggle (no `hasDiscountExpiry` field).
  //
  // Both are nullable; null = no expiry (matches cashback card behavior).
  //
  // Cross-references:
  //   - packages/shared/constants/discount-card.ts (bounds)
  /**
   * ?????????????? ??? [DISCOUNT_CUSTOM_EXPIRY_DAYS_MIN=1,
   * DISCOUNT_CUSTOM_EXPIRY_DAYS_MAX=3650 (10 ??].
   * ??discountSpecificExpiryDate ???field handler ???????
   * null = ??? = ?????
   */
  discountCustomExpiryDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .nullable()
    .optional(),
  /**
   * 折扣卡指定到期日. ISO YYYY-MM-DD 字串.
   * ??discountCustomExpiryDays ???field handler ???????
   * null = ??? = ?????
   */
  discountSpecificExpiryDate: z.string().nullable().optional(),
});
