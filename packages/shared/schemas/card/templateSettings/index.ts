/**
 * Flat template settings schema (the `templates.settings` JSONB payload).
 *
 * @module shared/schemas/card/templateSettings
 * @description The single flat settings object, composed from the
 * per-section schemas in this directory.
 *
 * The schema is FLAT — NOT nested (Rule 019 § 4.1). Sections are
 * composed with `.extend()` in the original field order so the resulting
 * `.shape` key order matches the former single-object definition.
 */

import { z } from 'zod';
import { tableCardSettingsSchema } from '../tableCard';
import { baseSettingsSchema } from './base';
import { stampSettingsSchema } from './stamp';
import { giftCardSettingsSchema } from './giftCard';
import { rewardSettingsSchema } from './reward';
import { membershipSettingsSchema } from './membership';
import { cashbackSettingsSchema } from './cashback';
import { discountSettingsSchema } from './discount';
import { couponSettingsSchema } from './coupon';
import { multipassSettingsSchema } from './multipass';

// ===== Template Settings (JSONB) =====

/**
 * Template settings stored in JSONB.
 * Flat structure — NOT nested.
 *
 * Step 1 fields: cardType (also held in SQL column `templates.card_type`),
 *                logoText (the text shown on the pass header — visually
 *                rendered in PassCardPreviewHeader next to the issuer logo).
 *                Card Name itself lives in the SQL column `templates.name`,
 *                NOT in this JSONB blob.
 * Step 2 fields: barcodeType, logoText, issuerName, passValidDays, expiryDate, currency
 * Step 3-4 fields: TBD (backgroundColor, textColor, etc.)
 */

export const templateSettingsSchema = baseSettingsSchema
  .extend(stampSettingsSchema.shape)
  .extend(giftCardSettingsSchema.shape)
  .extend(rewardSettingsSchema.shape)
  .extend(membershipSettingsSchema.shape)
  .extend(cashbackSettingsSchema.shape)
  .extend(discountSettingsSchema.shape)
  .extend(couponSettingsSchema.shape)
  .extend(multipassSettingsSchema.shape)
  .extend({
    // ===== Step 7 ??????????(2026-09-27) =====
    // Reference the separately-exported schema above so consumers can also
    // use it standalone for client-side validation (Rule 032 ? 2).
    tableCard: tableCardSettingsSchema.optional(),
  });

/**
 * The canonical TypeScript shape of the `templates.settings` JSONB.
 *
 * Derived from `templateSettingsSchema` (the Zod source of truth) so
 * the backend DB row, the service layer, and the shared schema can
 * never drift. Before this export, every backend consumer hand-wrote
 * a narrow `settings` interface — the pass-templates module's version
 * listed only six fields, so a service that needed `leftField` /
 * `rightField` / expiry settings had nowhere to read them from
 * (Rule 019 § 2 — the DB row must mirror the schema).
 */
export type TemplateSettings = z.infer<typeof templateSettingsSchema>;
