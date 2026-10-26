/**
 * Template settings — rewardSettings section.
 *
 * @module shared/schemas/card/templateSettings/reward
 * @description Part of the flat `templates.settings` JSONB schema.
 *
 * Composed into the single flat object by `templateSettings/index.ts`.
 * The field definitions are copied verbatim from the former
 * `packages/shared/schemas/card.ts` — do not reorder.
 */

import { z } from 'zod';

export const rewardSettingsSchema = z.object({
  // ===== Step 6 — REWARD 卡 (2026-09-09, reward_card only) =====
  // Mirrors mu-plugins `SAOME-Points-Engine/modules/cards/reward-card.php` earning mode
  // and `SAOME-Passcreator-Engine/modules/passcreator-reward-card.php` tier structure.
  //
  // 2026-09-09 mixed refactor: `earningMode` is card-wide (one mode per card),
  // but `pointsPerVisit` / `pointsPerSpendAmount` / `pointsPerSpendPoints`
  // are PER-TIER (inside each `rewardTiers[*]` entry). Rationale: the earning
  // mode (visits vs spend) is a card-level policy; the earn rate (e.g.
  // 1 visit = 1 point vs 1 visit = 2 points) can differ per tier.
  //
  // rewardTiers: 最多 5 組級距（每組含 name / threshold / rewardType / rewardValue /
  // maxDiscountAmount / pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints??  //
  // Cross-references:
  //   - packages/shared/constants/reward-card.ts (single source of truth)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.reward_card)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * 整張卡片的點數累積方式 (2026-09-09, top-level).
   * one mode per card: based_on_points (自訂條件) / based_on_visits (拜訪) /
   * based_on_spending (消費). null = 未選.
   * Drives which of `pointsPerVisit` / `pointsPerSpend*` per-tier fields are
   * meaningful; switching modes via `setEarningMode` clears all per-tier
   * earn fields so no stale data leaks across modes.
   */
  earningMode: z
    .enum(['based_on_points', 'based_on_visits', 'based_on_spending'])
    .nullable()
    .optional(),
  /**
   * 獎勵級距陣列（最多 5 組）.
   * 每個 tier 包含 reward rule (name + threshold + rewardType + rewardValue +
   * maxDiscountAmount) + 對應 earning mode 的 earn rate fields
   * (pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints).
   *
   * 2026-09-09: `earningMode` ??per-tier ??? top-level??   * Per-tier fields now only carry the earn rate (not the mode itself).
   */
  rewardTiers: z
    .array(
      z.object({
        /** ?????? (?? "1000?????0%" ??"500?????0??). */
        name: z.string().min(1).max(40),
        /** ??????? ????? N ????????? */
        threshold: z.number().int().min(1),
        /** ??????: amount_off (???????) / percent_off (?????????. */
        rewardType: z.enum(['amount_off', 'percent_off']),
        /** ????? amount_off ??????; percent_off ???????? */
        rewardValue: z.number().positive(),
        /** ???????????(??percent_off ?????? null = ??????. */
        maxDiscountAmount: z.number().min(0).nullable().optional(),
        /**
         * 基於拜訪門檻（僅 card-wide earningMode === 'based_on_visits' 時使用）:
         * 此 tier 每 N 次拜訪獲得的點數. null = 未填.
         * 2026-09-09: ??? per-tier?????tier ??????? earn rate???         */
        pointsPerVisit: z.number().int().min(1).nullable().optional(),
        /**
         * 基於消費門檻（僅 card-wide earningMode === 'based_on_spending' 時使用）:
         * ??tier ?????N ?????M ?? null = ???.
         * 2026-09-09: 保留 per-tier.
         */
        pointsPerSpendAmount: z.number().positive().nullable().optional(),
        /**
         * 基於消費門檻（僅 card-wide earningMode === 'based_on_spending' 時使用）:
         * ??tier ??????????? null = ???.
         * 2026-09-09: 保留 per-tier.
         */
        pointsPerSpendPoints: z.number().int().min(1).nullable().optional(),
      }),
    )
    .max(5)
    .optional(),
});
