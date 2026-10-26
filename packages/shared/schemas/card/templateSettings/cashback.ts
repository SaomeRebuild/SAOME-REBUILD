/**
 * Template settings — cashbackSettings section.
 *
 * @module shared/schemas/card/templateSettings/cashback
 * @description Part of the flat `templates.settings` JSONB schema.
 *
 * Composed into the single flat object by `templateSettings/index.ts`.
 * The field definitions are copied verbatim from the former
 * `packages/shared/schemas/card.ts` — do not reorder.
 */

import { z } from 'zod';

export const cashbackSettingsSchema = z.object({
  // ===== Step 6 — Cashback 卡 (2026-09-11, cashback_card only) =====
  // Mirrors mu-plugins cashback-tier structure. The simplest of the Step 6
  // sub-modules: each tier is a flat rule of "cumulative spend → cashback %",
  // with NO earning-mode switch and NO point accrual (the result IS a
  // percentage discount).
  //
  // Differs from reward_card structurally:
  //   - No "earningMode" field (cashback is always spend-driven).
  //   - No "rewardType / rewardValue" (cashback is always a percentage).
  //   - No "maxDiscountAmount" (cashback is a direct % rebate, not a cap'd
  //     discount).
  //   - thresholdSpend = 0 IS a legitimate "default tier" (everyone qualifies
  //     without needing to accumulate spending). This is intentional and
  //     distinguishes cashback from reward_card where threshold > 0 always.
  //
  // Cross-references:
  //   - packages/shared/constants/cashback-card.ts (single source of truth)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.cashback_card)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * ?????????????? (????5 ??.
   * 每個 tier 包含 name + thresholdSpend + cashbackPercent.
   *
   * 排序由前端 store 負責（thresholdSpend ASC，threshold=0 在最前）;
   * ??????????????????????????   */
  cashbackTiers: z
    .array(
      z.object({
        /** ?????????? (?? "VIP", "??????"). Required. */
        name: z.string().min(1).max(40),
        /** 累積消費門檻 (in store currency units). 0 = 預設 tier, 人人享有. */
        thresholdSpend: z.number().min(0),
        /** ????%?? ??? [1, 100]. */
        cashbackPercent: z.number().int().min(1).max(100),
      }),
    )
    .max(5)
    .optional(),
});
