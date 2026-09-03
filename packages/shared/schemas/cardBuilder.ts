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
  }),
  gift_card: z.object({}),
  membership_card: z.object({}),
  /**
   * Multi-pass card shares the stamp grid extension with stamp_card (both
   * render the same `<StampGridPreview>` in the preview strip). Mirrors
   * `shared/templateSettingsSchema.stampGridRows / stampIconId`.
   * Stamp grid feature 2026-09-04.
   */
  multipass: z.object({
    stampGridRows: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    stampIconId: z.string().optional(),
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
