/**
 * Template settings — membershipSettings section.
 *
 * @module shared/schemas/card/templateSettings/membership
 * @description Part of the flat `templates.settings` JSONB schema.
 *
 * Composed into the single flat object by `templateSettings/index.ts`.
 * The field definitions are copied verbatim from the former
 * `packages/shared/schemas/card.ts` — do not reorder.
 */

import { z } from 'zod';

import {
  MAX_MEMBERSHIP_TIERS,
  MAX_REWARDS_PER_TIER,
  TIER_NAME_MAX_LENGTH,
  REWARD_LABEL_MAX_LENGTH,
  REWARD_VALUE_MAX_LENGTH,
  COST_MIN,
  MEMBERSHIP_EXPIRY_MODES,
  CUSTOM_EXPIRY_DAYS_MIN,
  CUSTOM_EXPIRY_DAYS_MAX,
} from '../../../constants/membership-card';

export const membershipSettingsSchema = z.object({
  // ===== Step 6 — Membership 卡 (2026-09-13, membership_card only) =====
  // Mirrors mu-plugins membership-tier structure (see SAOME-Email-Engine
  // membership-tier handling). The simplest Step 6 sub-module after cashback:
  // each tier is a paid/free membership level with optional duration +
  // cost + per-tier 會員獎勵 sub-rows.
  //
  // Card-wide `hasExpiry` toggle (added 2026-09-13): all tiers share the
  // same expiry setting. When false, durationType / monthlyCost / yearlyCost
  // are hidden from the UI but the underlying schema still accepts them
  // (they're optional). When true, each tier must have a non-null
  // durationType + a corresponding non-negative cost.
  //
  // Per-tier 會員獎勵 sub-rows: up to MAX_REWARDS_PER_TIER=5 per tier. Each
  // row is a {label, value} pair (same shape as Step 4 back fields / links).
  //
  // Differs structurally from stamp_card / reward_card / cashback_card:
  //   - NO earningMode switch (membership has no point accrual — the
  //     member either pays or doesn't).
  //   - NO rewardType / rewardValue (the "reward" of a membership tier
  //     IS the per-tier 會員獎勵 sub-rows, not a flat value).
  //   - NO threshold field (membership tiers are independent levels,
  //     not cumulative thresholds).
  //
  // Cross-references:
  //   - packages/shared/constants/membership-card.ts (single source of truth)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.membership_card)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * Card-wide expiry toggle (2026-09-13). When `false` (default), the
   * membership tier has no expiry (e.g. lifetime VIP). When `true`, each
   * tier must specify `durationType` (monthly / yearly) + the corresponding
   * cost. Frontend store: `setHasExpiry(false)` ALSO clears all per-tier
   * `durationType` / `monthlyCost` / `yearlyCost` so no stale data leaks.
   */
  hasExpiry: z.boolean().optional(),
  /**
   * Membership tier array (????5 ??per MAX_MEMBERSHIP_TIERS).
   * Each tier carries name + durationType + monthlyCost + yearlyCost +
   * lifetimeCost + rewards (per-tier 會員獎勵 sub-rows, up to MAX_REWARDS_PER_TIER=5).
   *
   * Cost fields are mutually exclusive based on the card-wide `hasExpiry` toggle:
   *   - hasExpiry=true  → monthlyCost / yearlyCost are meaningful (lifetimeCost ignored).
   *   - hasExpiry=false → lifetimeCost is meaningful (monthlyCost / yearlyCost ignored).
   * The store's `setHasExpiry(false)` clears durationType but PRESERVES costs;
   * `setHasExpiry(true)` keeps the existing lifetimeCost value but it will be hidden
   * by the editor (defensive: never silently drops user-entered data).
   */
  membershipTiers: z
    .array(
      z.object({
        /** ?????? (?? "VIP", "??????"). Required, 1-40 chars. */
        name: z.string().min(1).max(TIER_NAME_MAX_LENGTH),
        /** ???????. null = ???????? card-wide hasExpiry=true ??????. */
        durationType: z
          .enum(['monthly', 'yearly'])
          .nullable()
          .optional(),
        /** 月費. 0 = 免費. null = 未填. Ignored in lifetime mode (hasExpiry=false). */
        monthlyCost: z.number().min(COST_MIN).nullable().optional(),
        /** 月費. 0 = 免費. null = 未填. Ignored in lifetime mode (hasExpiry=false). */
        yearlyCost: z.number().min(COST_MIN).nullable().optional(),
        /**
         * ??????? (??? card-wide hasExpiry=false ??????.
         * 0 = 免費. null = 未填.
         * Tenants use this field to sell the right to a lifetime tier
         * (one-time purchase). Hidden by the editor when hasExpiry=true.
         * 2026-09-13 新增: 與 monthlyCost / yearlyCost 互斥 — 由 card-wide
         * `hasExpiry` 決定哪組欄位生效.
         */
        lifetimeCost: z.number().min(COST_MIN).nullable().optional(),
        /** ?????? sub-rows (????5 ??per MAX_REWARDS_PER_TIER). */
        rewards: z
          .array(
            z.object({
              /** Sub-row label (e.g. "專屬優惠"). 1-20 chars. */
              label: z.string().min(1).max(REWARD_LABEL_MAX_LENGTH),
              /** Sub-row value (e.g. URL or text). 1-80 chars. */
              value: z.string().min(1).max(REWARD_VALUE_MAX_LENGTH),
            }),
          )
          .max(MAX_REWARDS_PER_TIER)
          .optional(),
      }),
    )
    .max(MAX_MEMBERSHIP_TIERS)
    .optional(),
  // ===== Step 6 — Free Membership Card expiry (2026-09-14) =====
  // 免費會員卡（isPaid=false）專用的卡片級期限欄位。付費會員卡使用
  // `durationType` + `monthlyCost` / `yearlyCost` ??????????????????????  //
  // ???????
  // - ???? durationType (monthly/yearly) + ??? cost = ???????????????
  // - ????? ???? N ??????? OR ???????????????????????
  //
  // Mirrors:
  //   - packages/shared/constants/membership-card.ts (MEMBERSHIP_EXPIRY_MODES ??
  //   - apps/backend/src/modules/cards/schemas/request.ts (backend mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts::TemplateSettings (interface)
  /**
   * ????????????????????2026-09-14, ?????isPaid=false??
   * - 'custom_days': ???? N ?????????? membershipCustomExpiryDays??   * - 'specific_date': ??????????????membershipSpecificExpiryDate, ISO YYYY-MM-DD??   * null = ????????? hasExpiry=true ?????? hasExpiry=false ???????????????   */
  membershipExpiryMode: z.enum(MEMBERSHIP_EXPIRY_MODES).nullable().optional(),
  /**
   * ???????????????membershipExpiryMode === 'custom_days' ?????????   * ??? [CUSTOM_EXPIRY_DAYS_MIN=1, CUSTOM_EXPIRY_DAYS_MAX=3650??0???]??   * null = ?????   */
  membershipCustomExpiryDays: z
    .number()
    .int()
    .min(CUSTOM_EXPIRY_DAYS_MIN)
    .max(CUSTOM_EXPIRY_DAYS_MAX)
    .nullable()
    .optional(),
  /**
   * ????????????????membershipExpiryMode === 'specific_date' ?????????   * ISO YYYY-MM-DD ????null = ?????   * ??????min=today????? setter ???zod ?????????   */
  membershipSpecificExpiryDate: z.string().nullable().optional(),
});
