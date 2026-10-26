/**
 * Template settings — baseSettings section.
 *
 * @module shared/schemas/card/templateSettings/base
 * @description Part of the flat `templates.settings` JSONB schema.
 *
 * Composed into the single flat object by `templateSettings/index.ts`.
 * The field definitions are copied verbatim from the former
 * `packages/shared/schemas/card.ts` — do not reorder.
 */

import { z } from 'zod';

import {
  cardTypeSchema,
  barcodeTypeSchema,
  currencySchema,
  languageSchema,
  cardFieldKeySchema,
} from '../enums';

export const baseSettingsSchema = z.object({
  // Step 1
  cardType: cardTypeSchema.optional(),
  // Step 2
  barcodeType: barcodeTypeSchema.optional(),
  /**
   * Logo Text — the text shown on the pass header (next to the issuer
   * logo). Semantic swap 2026-09-13: previously stored in the SQL column
   * `templates.name` under the misleading key `name`; migration 018
   * swapped it into `settings.logoText`. The Card Name (pass record name,
   * NOT shown in preview) now lives in the SQL column `templates.name`.
   */
  logoText: z.string().optional(),
  issuerName: z.string().optional(),
  passValidDays: z.number().int().positive().nullable().optional(),
  expiryDate: z.string().optional(),
  currency: currencySchema.optional(),
  /**
   * Card display language. Controls which language the card fields are
   * translated into when sent to Passcreator (deferred — not implemented
   * yet). Per-card property (not per-tenant) so different cards in the
   * same tenant can serve different language audiences.
   * 2026-09-18 Step 2: added for Passcreator future integration.
   */
  language: languageSchema.optional(),
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
  // (Migration 017 renames DB rows from `notificationRadius` ??  // `locationsMaxDistance`). New writes should use `locationsMaxDistance`.
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
