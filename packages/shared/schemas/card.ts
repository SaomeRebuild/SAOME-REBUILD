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
import { CARD_FIELD_KEYS } from '../constants/card-fields';

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

// ===== Card Display Fields (Step 3 — "顯示欄位" selector) =====

/**
 * Card face fields that can be assigned to the left/right slots.
 *
 * The list is sourced from `@saome/shared/constants/card-fields` (CARD_FIELD_KEYS)
 * so adding/removing a key only requires updating one constant. Both the
 * frontend `<Step3CardFields>` selector and the backend `templateSettingsSchema`
 * derive their enum from this single source.
 *
 * Card-type-dependent extensions (e.g. `pointBalance` for stamp_card) are
 * deferred to a future plan; this enum ships with the six base fields shared
 * by every card type (see step3_card_fields_selector_baffa936.plan.md).
 */
export const cardFieldKeySchema = z.enum([...CARD_FIELD_KEYS]);

// ===== Barcode Types =====

export const barcodeTypeSchema = z.enum(['qr_code', 'pdf_417']);

export type BarcodeType = z.infer<typeof barcodeTypeSchema>;

// ===== Currency =====

export const currencySchema = z.enum(['TWD', 'ZAR']);

export type Currency = z.infer<typeof currencySchema>;

// ===== Template Status =====

export const templateStatusSchema = z.enum(['draft', 'published', 'abandoned']);

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
  /**
   * Push-notification icon (R2 key, per shared/constants/card-images.ts § 5.7 contract).
   * Stored as a string like `{tenantId}/{templateId}/icon.png` — see CARD_IMAGE_KEYS.icon.
   * Phase 5 of IconUploader plan (2026-08-31): added to support MediaAssetUploader variant="icon".
   */
  iconImage: z.string().optional(),
  /**
   * Background image (R2 key) — reserved for next BackgroundUploader plan.
   * Schema entry added now so future BackgroundUploader does not need a schema migration.
   */
  backgroundImage: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  holderName: z.string().optional(),
  cardSide: z.enum(['front', 'back']).optional(),
  // ===== Step 3 — 顯示欄位 (left/right slot fields) =====
  // Step 3 plan 2026-09-04: two side-by-side native <select> dropdowns for
  // the card face. The user picks one field per slot (left/right). Card-type-
  // dependent additions/removals are deferred; current values are the six
  // base fields shared by every card type (see CARD_FIELD_KEYS in
  // packages/shared/constants/card-fields.ts).
  leftField: cardFieldKeySchema.optional(),
  rightField: cardFieldKeySchema.optional(),
  // Membership card extension
  isPaid: z.boolean().optional(),
  // ===== Step 3 — Stamp grid (集點印章) =====
  // Stamp grid feature (2026-09-04): rendered on `stamp_card` and `multipass`
  // card types only. The grid is rows × 5 columns; `stampGridRows` constrains
  // rows to 1..4. `stampIconId` references the icon manifest's id field
  // (see apps/frontend/src/assets/icons/stamps/manifest.ts).
  stampGridRows: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .optional(),
  stampIconId: z.string().optional(),
});

export type TemplateSettings = z.infer<typeof templateSettingsSchema>;

// ===== Template DTO =====

export const templateDtoSchema = z.object({
  id: z.string().uuid(),
  status: templateStatusSchema,
  name: z.string(),
  /** Card type. NULL = user has not selected a type yet. */
  cardType: cardTypeSchema.optional(),
  settings: templateSettingsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TemplateDto = z.infer<typeof templateDtoSchema>;

// ===== API Payloads =====

/**
 * POST /api/cards — Create a new template draft
 *
 * id is optional: if provided, it is used as the template UUID (client-generated
 * so we can redirect to the editor immediately). If omitted, the DB generates one.
 */
export const createTemplateSchema = z.object({
  /** Client-generated UUID for immediate redirect. */
  id: z.string().uuid().optional(),
  name: z.string().optional(),
  /** Card type. NULL = user has not selected a type yet (orphan draft). */
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
  status: templateStatusSchema.optional(),
});

export type UpdateTemplatePayload = z.infer<typeof updateTemplateSchema>;
