/**
 * Card template enums and display-field selectors.
 *
 * @module shared/schemas/card/enums
 * @description Primitive enumerations shared by every card template:
 * card type, barcode type, currency, language, template status, and the
 * card display-field selector.
 *
 * Part of the card schema contract (Rule 019 § 4.1) — frontend and
 * backend MUST import from `shared/schemas/card`.
 */

import { z } from 'zod';
import { CARD_FIELD_KEYS } from '../../constants/card-fields';

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
 * Stamp-card-specific keys (`availableRewards`, `totalStamps`,
 * `stampsRemaining`) are valid values for every card type at the schema
 * level (the enum is global), but the editor UI hides them when the user
 * picks a non-stamp card type — see `CardFieldGroup` in card-fields.ts and
 * the filter logic in `Step3CardFields/index.tsx`. Stored values are not
 * cleared on card-type churn (the conditional filter only affects the
 * dropdown options, not the store roundtrip).
 *
 * Card-type-dependent extensions beyond the 3 stamp keys are deferred to a
 * future plan; this enum ships with the six base common fields plus the
 * three stamp-only fields (see step3_card_fields_selector_baffa936.plan.md).
 */
export const cardFieldKeySchema = z.enum([...CARD_FIELD_KEYS]);

// ===== Barcode Types =====

export const barcodeTypeSchema = z.enum(['qr_code', 'pdf_417']);

export type BarcodeType = z.infer<typeof barcodeTypeSchema>;

// ===== Currency =====

export const currencySchema = z.enum(['TWD', 'ZAR']);

export type Currency = z.infer<typeof currencySchema>;

// ===== Card Language =====

export const languageSchema = z.enum(['zh-TW', 'en']);
export type CardLanguage = z.infer<typeof languageSchema>;

// ===== Template Status =====

export const templateStatusSchema = z.enum(['draft', 'published', 'abandoned']);

export type TemplateStatus = z.infer<typeof templateStatusSchema>;
