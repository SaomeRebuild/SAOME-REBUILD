/**
 * Request zod schemas for the cards module.
 *
 * @module modules/cards/schemas/request
 * @description Card template CRUD request contracts.
 *
 * This module used to hold a 579-line hand-maintained mirror of
 * `packages/shared/schemas/card.ts`. That mirror was the exact failure mode
 * Rule 019 § 1 calls out: two copies of one contract that drift silently.
 * It already had — a real behavioural divergence where the backend required
 * `multipassTiers[].perSpendAmount >= 0.01` while the shared schema only
 * required `> 0`.
 *
 * The schema now lives in exactly one place — `packages/shared/schemas/card/`
 * — and this module is a pure re-export of it. The import path
 * (`../schemas/request`) and every exported symbol are unchanged, so no
 * caller needs to know the mirror is gone.
 *
 * Layer mapping (Rule 019 § 4.1):
 *   - Layer 1 — `packages/shared/schemas/card/` (zod source of truth)
 *   - Layer 2 — this file (re-export; identity, not a copy)
 *   - Layer 3 — `apps/backend/src/modules/cards/db/templates.ts`
 *   - Layer 4 — `apps/backend/src/modules/cards/services/cardService.ts`
 */

// ===== Enum contracts =====

export { cardTypeSchema } from '@saome/shared/schemas/card';
export type { CardType } from '@saome/shared/schemas/card';
export { barcodeTypeSchema } from '@saome/shared/schemas/card';
export type { BarcodeType } from '@saome/shared/schemas/card';
export { currencySchema } from '@saome/shared/schemas/card';
export type { Currency } from '@saome/shared/schemas/card';
export { languageSchema } from '@saome/shared/schemas/card';
export type { CardLanguage } from '@saome/shared/schemas/card';
export { templateStatusSchema } from '@saome/shared/schemas/card';
export type { TemplateStatus } from '@saome/shared/schemas/card';
export { cardFieldKeySchema } from '@saome/shared/schemas/card';

// ===== Template Settings (JSONB) =====

/**
 * Template settings — the flat `templates.settings` JSONB payload.
 *
 * Re-exported from the shared schema so the backend parses exactly what the
 * frontend validates. Kept under the historical local name so existing
 * imports (`../schemas/request`) keep working.
 */
export { templateSettingsSchema } from '@saome/shared/schemas/card';
export type { TemplateSettings } from '@saome/shared/schemas/card';

// ===== Request Payloads =====

/**
 * POST /api/cards — Create a new template draft
 *
 * cardType is nullable: a draft can be created without selecting a card type yet.
 * The orphan draft will have card_type = NULL in the DB.
 */
export { createTemplateSchema } from '@saome/shared/schemas/card';
export type { CreateTemplatePayload } from '@saome/shared/schemas/card';

/**
 * PUT /api/cards/:id — Update a template
 */
export { updateTemplateSchema } from '@saome/shared/schemas/card';
export type { UpdateTemplatePayload } from '@saome/shared/schemas/card';
