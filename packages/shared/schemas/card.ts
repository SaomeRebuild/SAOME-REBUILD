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
  // ===== Step 4 — 卡片資訊 (2026-09-04) =====
  // Description shown in PassCardPreviewBack Section 1. Required by UI but
  // left optional here so zod doesn't reject empty drafts mid-edit; the UI
  // enforces DESCRIPTION_MAX_LENGTH + non-empty via isStep4Valid().
  description: z.string().max(200).optional(),
  // Back fields shown in PassCardPreviewBack Section 4. Flat array of
  // { label, value } pairs; PassKit convention is one Label + Value per row.
  // Length min/max is enforced by UI store (BACK_FIELDS_MIN/MAX), not zod,
  // to keep schema focused on per-field validity (Rule 019 § 4.1).
  backFields: z
    .array(
      z.object({
        label: z.string().max(40),
        value: z.string().max(80),
      }),
    )
    .optional(),
  // Links shown in PassCardPreviewBack Section 5. PassKit's `links` field is
  // a separate dedicated render area distinct from `backFields`; they are
  // not interchangeable. URL validation is performed by shared/logic/links.ts
  // in the UI layer; zod only enforces max length per field (URLs can be
  // long — 2048 is the PassKit limit per pass field).
  links: z
    .array(
      z.object({
        label: z.string().max(40),
        value: z.string().max(2048),
      }),
    )
    .optional(),
  // ===== Step 5 — 地理位置 + 推播訊息 (2026-09-05, refactored 2026-09-06) =====
  // Passcreator API-aligned fields:
  //   - `locationsDisabled`: boolean toggle. Passcreator uses this to
  //     decide whether geolocation is enabled at all. When `true` the
  //     editor collapses Step 5 and clears locations + locationsMaxDistance.
  //   - `initialMessage`: push-notification body (optional).
  //   - `locationsMaxDistance`: pass-level notification radius in meters
  //     (renamed 2026-09-06 from `notificationRadius` to align with Passcreator).
  //     `null` means "use pass-type default" (Apple Wallet decides based
  //     on card type).
  //   - `locations`: array of { name, latitude, longitude, relevantText }
  //     (added relevantText 2026-09-06; lat/lng are now REQUIRED).
  initialMessage: z.string().max(50).optional(),
  locationsDisabled: z.boolean().optional(),
  locationsMaxDistance: z
    .number()
    .int()
    .min(100)
    .max(1000)
    .nullable()
    .optional(),
  locations: z
    .array(
      z.object({
        // Per-row `name` is required (user-facing label). Length cap of 40
        // matches LOCATION_NAME_MAX_LENGTH in
        // shared/constants/card-back-fields.ts.
        name: z.string().min(1).max(40),
        // lat / lng are now REQUIRED (2026-09-06 refactor). Previously
        // optional because the editor allowed empty rows; the Step 5
        // toggle + `validateAllLocations({requireMinOne: true})` now
        // enforces non-null values at the schema layer.
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        // relevantText is the lock-screen message shown when the user
        // arrives at this location (Apple Wallet pkpass `relevantText`).
        // Optional, ≤ 100 chars, null when not set.
        relevantText: z.string().max(100).nullable().optional(),
      }),
    )
    .max(10)
    .optional(),
  // ===== Step 5 — Locations max distance (2026-09-06 rename) =====
  // DEPRECATED 2026-09-06: kept as `.optional()` for backward-compat reads
  // (Migration 017 renames DB rows from `notificationRadius` →
  // `locationsMaxDistance`). New writes should use `locationsMaxDistance`.
  // The backend silently accepts incoming `notificationRadius` but does
  // not echo it back; frontend `loadSettings` falls back to
  // `notificationRadius` if `locationsMaxDistance` is missing (defensive).
  notificationRadius: z
    .number()
    .int()
    .min(100)
    .max(1000)
    .nullable()
    .optional(),
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
