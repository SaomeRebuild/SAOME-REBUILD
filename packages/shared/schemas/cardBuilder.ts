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
export const baseCardSettingsSchema = z.object({
  storeName: z.string().min(1),
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
  membership_card: z.object({}),
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
