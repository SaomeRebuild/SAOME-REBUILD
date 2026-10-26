/**
 * Template settings — multipassSettings section.
 *
 * @module shared/schemas/card/templateSettings/multipass
 * @description Part of the flat `templates.settings` JSONB schema.
 *
 * Composed into the single flat object by `templateSettings/index.ts`.
 * The field definitions are copied verbatim from the former
 * `packages/shared/schemas/card.ts` — do not reorder.
 */

import { z } from 'zod';

import {
  MAX_MULTIPASS_TIERS,
  MULTIPASS_TIER_NAME_MAX_LENGTH,
  MULTIPASS_STAMPS_NEEDED_MIN,
  MULTIPASS_STAMPS_NEEDED_MAX,
  MULTIPASS_STAMPS_PER_VISIT_MIN,
  MULTIPASS_STAMPS_PER_SPEND_MIN,
  MULTIPASS_ACCRUAL_MODES,
} from '../../../constants/multipass-card';

export const multipassSettingsSchema = z.object({
  // ===== Step 6 — Multipass 卡 (2026-09-19, Rule 019 § 4.1, multipass only) =====
  // Mirrors `shared/templateSettingsSchema.multipassTiers`.
  // Multipass card has UP TO 5 tiers; each tier carries name +
  // stampsNeeded + rewardType + rewardValue. Differs structurally from
  // stamp_card's single reward: stampsNeeded = 0 represents "?????  // ?????? (immediate reward on download). stampsNeeded is
  // COMPLETELY DECOUPLED from the Step 3 stamp grid (stampGridRows × 5)
  // — multipass cards may stack stamps across multiple physical
  // cards. Backend zod caps stampsNeeded at 999 purely as a safety
  // valve against typos (e.g. user types 99999).
  //
  // Cross-references:
  //   - packages/shared/constants/multipass-card.ts (single source of truth — bounds)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.multipass)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * Multipass ??tier ??? (????MAX_MULTIPASS_TIERS=5 ??.
   * 每個 tier 自帶 name + stampsNeeded + rewardType + rewardValue.
   *
   * stampsNeeded:
   *   - 0 = ???????????????immediate reward on download)
   *   - 1..999 = ???????????????zod ???????   * ??Step 3 stamp grid ??????multipass ??????????????????????
   */
  multipassTiers: z
    .array(
      z.object({
        /** Tier name shown on the pass (e.g. "新戶禮", "VIP 回饋"). 1-40 chars. */
        name: z.string().min(1).max(MULTIPASS_TIER_NAME_MAX_LENGTH),
        /** Stamps required to unlock this tier reward. 0 = welcome gift; 1..999 = design choice. */
        stampsNeeded: z
          .number()
          .int()
          .min(MULTIPASS_STAMPS_NEEDED_MIN)
          .max(MULTIPASS_STAMPS_NEEDED_MAX),
        /** Reward type. Mirrors stamp_card rewardType. null when user hasn't picked. */
        rewardType: z.enum(['amount_off', 'percent_off']).nullable().optional(),
        /** Discount amount (amount_off) or percentage integer 1-100 (percent_off). null when unselected. */
        rewardValue: z.number().positive().nullable().optional(),
        // ★ PR-6 (2026-09-20) per-tier 最高折抵金額 — 對齊 stamp_card.maxDiscountAmount.
        // 0 = ?????? 1..MAX_DISCOUNT_AMOUNT_MAX = ??????. null = ??? (= ??????.
        // ???? rewardType === 'percent_off' ???????,amount_off ????????????
        maxDiscountAmount: z.number().min(0).nullable().optional(),
        // ★ PR-5 新增 per-tier 門檻欄位 — 對齊 stamp_card card-wide
        // stampsPerVisitCount / stampsPerSpendAmount 等欄位的 per-tier 變體.
        // ??: stamp_card ??4 ????????? card-wide ???,Multipass ??        // ??? per-tier (??????? ?????????????tier ?????        // ????????????.
        /**
         * 來訪門檻拜訪次數 (multipassAccrualMode === 'per_visit').
         * integer ≥ 1. null = 未填.
         */
        perVisitCount: z
          .number()
          .int()
          .min(MULTIPASS_STAMPS_PER_VISIT_MIN)
          .nullable()
          .optional(),
        /** 來訪門檻獲得蓋章數. integer ≥ 1. null = 未填. */
        perVisitStamps: z.number().int().min(1).nullable().optional(),
        /** 消費門檻消費金額. positive number ≥ MULTIPASS_STAMPS_PER_SPEND_MIN=0.01. null = 未填. */
        perSpendAmount: z
          .number()
          .positive()
          .min(MULTIPASS_STAMPS_PER_SPEND_MIN)
          .nullable()
          .optional(),
        /** 來訪門檻獲得蓋章數. integer ≥ 1. null = 未填. */
        perSpendStamps: z.number().int().min(1).nullable().optional(),
      }),
    )
    .max(MAX_MULTIPASS_TIERS)
    .optional(),
  /**
   * 卡片層級 multipass 蓋章方式 (2026-09-20 PR-5, multipass only).
   * ??? stamp_card.stampAccrualMode (??settings ??card-wide).
   * Mirrors `shared/templateSettingsSchema.stampAccrualMode` (Rule 019 § 4.1).
   * null = 未填.
   *
   * Cross-references:
   *   - packages/shared/constants/multipass-card.ts (MULTIPASS_ACCRUAL_MODES)
   *   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.multipass.multipassAccrualMode)
   *   - apps/backend/src/modules/cards/schemas/request.ts (backend mirror)
   *   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
   */
  multipassAccrualMode: z.enum(MULTIPASS_ACCRUAL_MODES).nullable().optional(),
});
