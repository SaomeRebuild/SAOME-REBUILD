/**
 * Request zod schemas for the cards module.
 *
 * @module modules/cards/schemas/request
 * @description Zod schemas for card template CRUD endpoints.
 */

import { z } from 'zod';

// ===== Card Types =====

export const cardTypeSchema = z.enum([
  'stamp_card',
  'cashback_card',
  'reward_card',
  'membership_card',
  'discount_card',
  'coupon_card',
  'multipass',
  'gift_card',
]);

export type CardType = z.infer<typeof cardTypeSchema>;

// ===== Barcode Types =====

export const barcodeTypeSchema = z.enum(['qr_code', 'pdf_417']);

export type BarcodeType = z.infer<typeof barcodeTypeSchema>;

// ===== Currency =====

export const currencySchema = z.enum(['TWD', 'ZAR']);

export type Currency = z.infer<typeof currencySchema>;

// ===== Template Settings (JSONB) =====

/**
 * Template settings — mirrors TemplateSettings interface in db/templates.ts.
 * Flat structure, no nested objects.
 */
export const templateSettingsSchema = z.object({
  // Step 1
  name: z.string().optional(),
  cardType: cardTypeSchema.optional(),
  // Step 2
  barcodeType: barcodeTypeSchema.optional(),
  storeName: z.string().optional(),
  issuerName: z.string().optional(),
  passValidDays: z.number().int().positive().nullable().optional(),
  expiryDate: z.string().optional(), // ISO date string
  currency: currencySchema.optional(),
  // Step 3-4 (TBD)
  issuerLogo: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  holderName: z.string().optional(),
  cardSide: z.enum(['front', 'back']).optional(),
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
  name: z.string().optional(),
  /** Card type. Optional — user may start editing without selecting a type. */
  cardType: cardTypeSchema.optional(),
  settings: templateSettingsSchema.optional(),
});

export type CreateTemplatePayload = z.infer<typeof createTemplateSchema>;

/**
 * PUT /api/cards/:id — Update a template
 */
export const updateTemplateSchema = z.object({
  name: z.string().optional(),
  cardType: cardTypeSchema.optional(),
  settings: templateSettingsSchema.optional(),
  status: z.enum(['draft', 'published']).optional(),
});

export type UpdateTemplatePayload = z.infer<typeof updateTemplateSchema>;
