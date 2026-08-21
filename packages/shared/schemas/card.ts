/**
 * Card Template Schemas
 *
 * @module shared/schemas/card
 * @description Zod schemas for card builder templates.
 *
 * This file is the SINGLE SOURCE OF TRUTH for card template types.
 * Both frontend and backend MUST import from here.
 *
 * Card Types: stamp_card | cashback_card | reward_card | membership_card | discount_card | coupon_card | multipass | gift_card
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

// ===== Template Status =====

export const templateStatusSchema = z.enum(['draft', 'published']);

export type TemplateStatus = z.infer<typeof templateStatusSchema>;

// ===== Template Settings (JSONB) =====

/**
 * Template settings stored in JSONB.
 * Flat structure — NOT nested.
 *
 * Step 1 fields: name, cardType
 * Step 2 fields: barcodeType, storeName, issuerName, passValidDays, expiryDate, currency
 * Step 3-4 fields: TBD (backgroundColor, textColor, etc.)
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
  expiryDate: z.string().optional(),
  currency: currencySchema.optional(),
  // Step 3-4 (TBD)
  issuerLogo: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  holderName: z.string().optional(),
  cardSide: z.enum(['front', 'back']).optional(),
});

export type TemplateSettings = z.infer<typeof templateSettingsSchema>;

// ===== Template DTO =====

export const templateDtoSchema = z.object({
  id: z.string().uuid(),
  status: templateStatusSchema,
  name: z.string(),
  cardType: cardTypeSchema,
  settings: templateSettingsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type TemplateDto = z.infer<typeof templateDtoSchema>;

// ===== API Payloads =====

/**
 * POST /api/cards — Create a new template draft
 */
export const createTemplateSchema = z.object({
  name: z.string().optional(),
  cardType: cardTypeSchema,
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
  status: templateStatusSchema.optional(),
});

export type UpdateTemplatePayload = z.infer<typeof updateTemplateSchema>;
