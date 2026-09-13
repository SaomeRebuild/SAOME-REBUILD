/**
 * CardBuilder Schemas
 *
 * @module shared/schemas/cardBuilder
 * @description Zod schemas for CardBuilder Step 2 — barcode type and store name (Base fields shared by all card types)
 */

import { z } from 'zod';

// ===== Barcode（所有卡種共用）=====
export const barcodeTypeSchema = z.enum(['qr_code', 'pdf_417']);
export type BarcodeType = z.infer<typeof barcodeTypeSchema>;

// ===== Barcode 圖片 URL（static asset path）=====
export const BARCODE_IMAGES = {
  qr_code: '/images/barcode-qr.png',
  pdf_417: '/images/barcode-pdf417.png',
} as const satisfies Record<BarcodeType, string>;

// ===== Extension Pattern：每個卡種的專屬欄位 =====

// Base（所有卡種都要）
// 2026-09-13 swap: storeName → logoText. The semantic meaning of this field
// is "Logo Text" (the text shown on the pass header), NOT the pass/store name.
// The Card Name (pass record name) lives in the SQL column `templates.name`.
export const baseCardSettingsSchema = z.object({
  logoText: z.string().min(1),
});

// ===== Per-card Extensions（等待商業邏輯確認後填入）=====
export const cardTypeExtensions = {
  // TODO: 根據商業邏輯填入每個卡種的專屬欄位
  stamp_card: z.object({
    /**
     * Stamp grid — rows × 5 columns. Mirrors
     * `shared/templateSettingsSchema.stampGridRows` (Rule 019 § 4.1 layer 2).
     * Stamp grid feature 2026-09-04.
     */
    stampGridRows: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    /**
     * Stamp icon manifest id. Mirrors `shared/templateSettingsSchema.stampIconId`.
     */
    stampIconId: z.string().optional(),
    // ===== Step 6 — 集點卡邏輯 (2026-09-07) =====
    // Mirrors `shared/templateSettingsSchema.stampAccrualMode / rewardName /
    // rewardType / rewardValue / maxDiscountAmount`. Stamp card is the first
    // card type with a Step 6 sub-module (see `Step6CardLogic` dispatcher).
    stampAccrualMode: z.enum(['per_stamp', 'per_visit', 'per_spend']).optional(),
    rewardName: z.string().max(40).optional(),
    rewardType: z.enum(['amount_off', 'percent_off']).optional(),
    rewardValue: z.number().positive().optional(),
    maxDiscountAmount: z.number().min(0).nullable().optional(),
    // ===== Step 6 — Accrual thresholds (2026-09-07) =====
    stampsPerVisitCount: z.number().int().min(1).nullable().optional(),
    stampsPerVisitStamps: z.number().int().min(1).nullable().optional(),
    stampsPerSpendAmount: z.number().positive().nullable().optional(),
    stampsPerSpendStamps: z.number().int().min(1).nullable().optional(),
  }),
  gift_card: z.object({}),
  /**
   * Membership card (會員卡) — Step 6 Membership 卡實作 (2026-09-13).
   *
   * Differs structurally from stamp_card / reward_card / cashback_card:
   *   - Card-wide `hasExpiry` toggle (none / with expiry). When false, the
   *     tier has no expiry (lifetime membership). When true, each tier
   *     specifies durationType (monthly / yearly) + corresponding cost.
   *   - membershipTiers: up to MAX_MEMBERSHIP_TIERS=5 tiers. Each tier
   *     carries name + durationType + monthlyCost + yearlyCost +
   *     per-tier 會員獎勵 sub-rows (up to MAX_REWARDS_PER_TIER=5).
   *   - NO earningMode (no point accrual).
   *   - NO rewardType / rewardValue (the "reward" is the per-tier rewards
   *     sub-rows, not a flat value).
   *   - NO threshold (tiers are independent levels, not cumulative).
   *
   * Mirrors `shared/templateSettingsSchema.membershipTiers` (Rule 019 §
   * 4.1 layer 1).
   */
  membership_card: z.object({
    // ===== Step 6 — 會員卡邏輯 (2026-09-13) =====
    /** Card-wide expiry toggle. false = lifetime, true = monthly/yearly. */
    hasExpiry: z.boolean().optional(),
    /** 會員等級陣列 (最多 5 組). */
    membershipTiers: z
      .array(
        z.object({
          /** 等級名稱. Required, 1-40 chars. */
          name: z.string().min(1).max(40),
          /** 月/年卡單選. null = 未設定. */
          durationType: z.enum(['monthly', 'yearly']).nullable().optional(),
          /** 月費. 0 = 免費. null = 未填. */
          monthlyCost: z.number().min(0).nullable().optional(),
          /** 年費. 0 = 免費. null = 未填. */
          yearlyCost: z.number().min(0).nullable().optional(),
          /** 會員獎勵 sub-rows (最多 5 組). */
          rewards: z
            .array(
              z.object({
                label: z.string().min(1).max(20),
                value: z.string().min(1).max(80),
              }),
            )
            .max(5)
            .optional(),
        }),
      )
      .max(5)
      .optional(),
  }),
  /**
   * Reward card (獎勵卡) — Step 6 REWARD 卡實作 (2026-09-09).
   * Differs from stamp_card:
   *   - earningMode: based_on_points / based_on_visits / based_on_spending
   *   - pointsPerVisit: points earned per visit
   *   - pointsPerSpend*: points earned per spend amount
   *   - rewardTiers: array of up to 5 reward tiers (vs stamp's single reward)
   *
   * Mirrors mu-plugins `SAOME-Points-Engine/modules/cards/reward-card.php`
   * and `SAOME-Passcreator-Engine/modules/passcreator-reward-card.php`.
   */
  reward_card: z.object({
    // ===== Step 6 — 獎勵卡邏輯 (2026-09-09) =====
    /** 累積方式: 基於點數 / 基於拜訪 / 基於消費. */
    earningMode: z.enum(['based_on_points', 'based_on_visits', 'based_on_spending']).optional(),
    /** 基於拜訪: 每次拜訪獲得多少點. */
    pointsPerVisit: z.number().int().min(1).nullable().optional(),
    /** 基於消費: 每消費多少元. */
    pointsPerSpendAmount: z.number().positive().nullable().optional(),
    /** 基於消費: 每次獲得多少點. */
    pointsPerSpendPoints: z.number().int().min(1).nullable().optional(),
    /** 獎勵級距陣列 (最多 5 組). */
    rewardTiers: z
      .array(
        z.object({
          name: z.string().min(1).max(40),
          threshold: z.number().int().min(1),
          rewardType: z.enum(['amount_off', 'percent_off']),
          rewardValue: z.number().positive(),
          maxDiscountAmount: z.number().min(0).nullable().optional(),
        }),
      )
      .max(5)
      .optional(),
  }),
  /**
   * Cashback card (現金回饋卡) — Step 6 Cashback 卡實作 (2026-09-11).
   * Simplest of the Step 6 sub-modules: each tier is a flat rule of
   * "cumulative spend → cashback %". No earning-mode switch and no point
   * accrual (the result IS a percentage discount).
   *
   * Differs from reward_card structurally:
   *   - No "earningMode" (cashback is always spend-driven).
   *   - No "rewardType / rewardValue / maxDiscountAmount" — cashback is a
   *     direct % rebate.
   *   - thresholdSpend = 0 IS a legitimate "default tier" (everyone
   *     qualifies without needing to accumulate spending).
   *
   * Mirrors mu-plugins cashback-tier structure. See
   * `packages/shared/constants/cashback-card.ts` for bounds and
   * `shared/templateSettingsSchema.cashbackTiers` for full schema.
   */
  cashback_card: z.object({
    // ===== Step 6 — 現金回饋卡邏輯 (2026-09-11) =====
    /** 現金回饋級距陣列 (最多 5 組). */
    cashbackTiers: z
      .array(
        z.object({
          /** 回饋等級名稱. Required. */
          name: z.string().min(1).max(40),
          /** 累積消費門檻. 0 = 預設 tier, 人人享有. */
          thresholdSpend: z.number().min(0),
          /** 回饋%數, 整數 [1, 100]. */
          cashbackPercent: z.number().int().min(1).max(100),
        }),
      )
      .max(5)
      .optional(),
  }),
  multipass: z.object({
    stampGridRows: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    stampIconId: z.string().optional(),
    // ===== Step 6 — 集點卡邏輯 (2026-09-07, multipass 共用) =====
    stampAccrualMode: z.enum(['per_stamp', 'per_visit', 'per_spend']).optional(),
    rewardName: z.string().max(40).optional(),
    rewardType: z.enum(['amount_off', 'percent_off']).optional(),
    rewardValue: z.number().positive().optional(),
    maxDiscountAmount: z.number().min(0).nullable().optional(),
    // ===== Step 6 — Accrual thresholds (2026-09-07, multipass 共用) =====
    stampsPerVisitCount: z.number().int().min(1).nullable().optional(),
    stampsPerVisitStamps: z.number().int().min(1).nullable().optional(),
    stampsPerSpendAmount: z.number().positive().nullable().optional(),
    stampsPerSpendStamps: z.number().int().min(1).nullable().optional(),
  }),
} as const;

export type CardType = keyof typeof cardTypeExtensions;

// ===== Dynamic Schema 组合 =====
// 根據 cardType 動態取得對應的 Schema
export function getCardSettingsSchema(cardType: CardType) {
  const extension = cardTypeExtensions[cardType] ?? z.object({});
  return baseCardSettingsSchema.merge(extension);
}

// ===== Step 2 完整 Schema（含 Barcode，預設通用版）=====
export const step2CardSettingsSchema = z.object({
  barcodeType: barcodeTypeSchema.default('qr_code'),
  // cardType-specific fields via getCardSettingsSchema(cardType)
});

export type Step2CardSettings = z.infer<typeof step2CardSettingsSchema>;
