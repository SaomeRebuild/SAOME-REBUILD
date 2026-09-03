/**
 * Request zod schemas for the cards module.
 *
 * @module modules/cards/schemas/request
 * @description Zod schemas for card template CRUD endpoints.
 *
 * Card-type enums (cardTypeSchema, barcodeTypeSchema, currencySchema, templateStatusSchema)
 * are re-exported from @saome/shared/schemas/card — the single source of truth.
 * We import them under local aliases so this module can use them in z.object()
 * AND re-export them for other modules.
 */

import { z } from 'zod';
import {
  cardTypeSchema as sharedCardTypeSchema,
  barcodeTypeSchema as sharedBarcodeTypeSchema,
  currencySchema as sharedCurrencySchema,
  templateStatusSchema as sharedTemplateStatusSchema,
  cardFieldKeySchema as sharedCardFieldKeySchema,
} from '@saome/shared/schemas/card';

// Re-export for consumers of this module
export { cardTypeSchema } from '@saome/shared/schemas/card';
export type { CardType } from '@saome/shared/schemas/card';
export { barcodeTypeSchema } from '@saome/shared/schemas/card';
export type { BarcodeType } from '@saome/shared/schemas/card';
export { currencySchema } from '@saome/shared/schemas/card';
export type { Currency } from '@saome/shared/schemas/card';
export { templateStatusSchema } from '@saome/shared/schemas/card';
export type { TemplateStatus } from '@saome/shared/schemas/card';
export { cardFieldKeySchema } from '@saome/shared/schemas/card';

// ===== Template Settings (JSONB) =====

/**
 * Template settings — mirrors TemplateSettings interface in db/templates.ts.
 * Flat structure, no nested objects.
 */
export const templateSettingsSchema = z.object({
  // Step 1
  name: z.string().optional(),
  cardType: sharedCardTypeSchema.optional(),
  // Step 2
  barcodeType: sharedBarcodeTypeSchema.optional(),
  storeName: z.string().optional(),
  issuerName: z.string().optional(),
  passValidDays: z.number().int().positive().nullable().optional(),
  expiryDate: z.string().optional(), // ISO date string
  currency: sharedCurrencySchema.optional(),
  // Step 3-4 (TBD)
  issuerLogo: z.string().optional(),
  /**
   * Push-notification icon (R2 key) — mirrors shared templateSettingsSchema.iconImage.
   * Phase 5 of IconUploader plan (2026-08-31).
   */
  iconImage: z.string().optional(),
  /**
   * Background image (R2 key) — reserved for next BackgroundUploader plan.
   * Mirrors shared templateSettingsSchema.backgroundImage.
   */
  backgroundImage: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  holderName: z.string().optional(),
  cardSide: z.enum(['front', 'back']).optional(),
  // ===== Step 3 — 顯示欄位 (Rule 019 § 4.1, layer 2 of 4) =====
  // Mirrors `shared/templateSettingsSchema.leftField / rightField`.
  // Step 3 plan 2026-09-04: see packages/shared/schemas/card.ts for source.
  leftField: sharedCardFieldKeySchema.optional(),
  rightField: sharedCardFieldKeySchema.optional(),
  // Membership card extension
  isPaid: z.boolean().optional(),
  // ===== Step 3 — Stamp grid (Rule 019 § 4.1, layer 2 of 4) =====
  // Mirrors `shared/templateSettingsSchema.stampGridRows / stampIconId`.
  // Stamp grid feature 2026-09-04: stamp_card + multipass only.
  stampGridRows: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .optional(),
  stampIconId: z.string().optional(),
});

export type TemplateSettings = z.infer<typeof templateSettingsSchema>;

// ===== Request Payloads =====

/**
 * POST /api/cards — Create a new template draft
 *
 * cardType is nullable: a draft can be created without selecting a card type yet.
 * The orphan draft will have card_type = NULL in the DB.
 */
export const createTemplateSchema = z.object({
  /** UUID. Client-generated so we can redirect immediately after creation. */
  id: z.string().uuid().optional(),
  name: z.string().optional(),
  /** Card type. Optional — user may start editing without selecting a type. */
  cardType: sharedCardTypeSchema.optional(),
  settings: templateSettingsSchema.optional(),
});

export type CreateTemplatePayload = z.infer<typeof createTemplateSchema>;

/**
 * PUT /api/cards/:id — Update a template
 */
export const updateTemplateSchema = z.object({
  name: z.string().optional(),
  cardType: sharedCardTypeSchema.optional(),
  settings: templateSettingsSchema.optional(),
  status: sharedTemplateStatusSchema.optional(),
});

export type UpdateTemplatePayload = z.infer<typeof updateTemplateSchema>;
