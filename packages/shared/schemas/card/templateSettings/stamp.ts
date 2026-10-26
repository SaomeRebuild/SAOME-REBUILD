/**
 * Template settings — stampSettings section.
 *
 * @module shared/schemas/card/templateSettings/stamp
 * @description Part of the flat `templates.settings` JSONB schema.
 *
 * Composed into the single flat object by `templateSettings/index.ts`.
 * The field definitions are copied verbatim from the former
 * `packages/shared/schemas/card.ts` — do not reorder.
 */

import { z } from 'zod';

export const stampSettingsSchema = z.object({
  // ===== Step 6 — 卡片邏輯 (2026-09-07, stamp_card / multipass only) =====
  // Mirrors mu-plugins `_stamp_accrual_type` + `_stamp_reward_tiers_json`
  // (collapsed into a single tier — the active reward; mu-plugins stores
  // an array, but SAOME-REBUILD stores a single tier to keep the editor
  // simple and match the single-reward user spec 2026-09-07).
  //
  // Field-level limits live in `@saome/shared/constants/stamp-card`:
  //   - ACCRUAL_MODES / REWARD_TYPES: the enum values
  //   - REWARD_NAME_MAX_LENGTH = 40: matches PassCreator `title` cap
  //   - REWARD_VALUE bounds differ by `rewardType`:
  //       amount_off → > 0 (currency-agnostic number)
  //       percent_off → [1, 100] integer percentage
  //   - MAX_DISCOUNT_AMOUNT_MIN = 0; null means "??????
  //
  // Cross-references:
  //   - packages/shared/constants/stamp-card.ts (single source of truth)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.stamp_card / .multipass)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * 蓋章模式: per_stamp (手動蓋章) / per_visit (來訪蓋章) / per_spend (消費蓋章).
   * Mirrors mu-plugins `_stamp_accrual_type` (camelCased to align with TS convention).
   * `.nullable().optional()` — null = not set (frontend store uses null for "unselected").
   */
  stampAccrualMode: z.enum(['per_stamp', 'per_visit', 'per_spend']).nullable().optional(),
  /**
   * ?????? (?? "10????????? ??"$10 off coupon"). Max REWARD_NAME_MAX_LENGTH=40.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].name`.
   */
  rewardName: z.string().max(40).optional(),
  /**
   * 獎勵類型: 訂單折抵現金 (amount_off) / 訂單折抵百分比 (percent_off).
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].reward_type`.
   * `.nullable().optional()` — null = not set (frontend store uses null for "unselected").
   */
  rewardType: z.enum(['amount_off', 'percent_off']).nullable().optional(),
  /**
   * 折抵金額 (amount_off) 或百分比整數 (percent_off).
   * Bound check is performed by `setRewardValue` setter (拒絕 ≤ 0);
   * zod uses `.positive()` as a backend double-check.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].reward_value`.
   */
  rewardValue: z.number().positive().nullable().optional(),
  /**
   * ???????????(??percent_off ????????? null = ??????.
   * zod `.nullable()` matches store's `number | null` shape (null = no ceiling).
   * Always validated as ≥ MAX_DISCOUNT_AMOUNT_MIN=0 by `setMaxDiscountAmount`.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].max_discount_amount`.
   */
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  /**
   * ?????????per_visit ??????????????N ????????? M ???????   * stampsPerVisitCount = N??????????stampsPerVisitStamps = M??????????   * 2026-09-07 ??????   */
  stampsPerVisitCount: z.number().int().min(1).nullable().optional(),
  stampsPerVisitStamps: z.number().int().min(1).nullable().optional(),
  /**
   * ?????????per_spend ?????????????????N ??????? M ???????   * stampsPerSpendAmount = N??????????stampsPerSpendStamps = M??????????   * 2026-09-07 ??????   */
  stampsPerSpendAmount: z.number().positive().nullable().optional(),
  stampsPerSpendStamps: z.number().int().min(1).nullable().optional(),
});
