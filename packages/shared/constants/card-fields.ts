/**
 * Card display fields — single source of truth for selectable card face fields.
 *
 * @module shared/constants/card-fields
 * @description Fields that can be displayed on a card face (left/right slots).
 * Shared by:
 *   - Frontend Step 3 "顯示欄位" selector:
 *     apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/
 *   - Shared templateSettingsSchema: packages/shared/schemas/card.ts
 *   - Backend mirror: apps/backend/src/modules/cards/schemas/request.ts
 *
 * Plan: step3_card_fields_selector_baffa936.plan.md
 *
 * Step 1 card type may add/remove options in future plans; this file ships
 * only the six common fields used by every card type. The `as const` array
 * is the single source of truth — both the zod enum (in card.ts) and the
 * CARD_FIELDS array (here) must be kept in sync.
 */

/**
 * Canonical field keys. Order is user-visible in the dropdown.
 *
 * IMPORTANT: Adding a new key requires syncing:
 *   1. cardFieldKeySchema in packages/shared/schemas/card.ts
 *   2. TemplateSettings.leftField/rightField interface (apps/backend/.../db/templates.ts)
 *   3. i18n step3.fieldsSection.fields.{key} in cardEditor.{zh-TW,en}.ts
 *   4. CARD_FIELDS entry below
 */
export const CARD_FIELD_KEYS = [
  'phone',
  'email',
  'memberLevel',
  'birthday',
  'visitCount',
  'memberName',
] as const;

export type CardFieldKey = (typeof CARD_FIELD_KEYS)[number];

export interface CardFieldDefinition {
  key: CardFieldKey;
  /** i18n key path inside the 'cardEditor' namespace */
  labelKey: string;
}

/**
 * UI-order iteration source. Keep this aligned with CARD_FIELD_KEYS.
 *
 * The `labelKey` is intentionally a relative path inside the 'cardEditor'
 * namespace — consumers must call `t(field.labelKey)` with the namespace
 * pre-bound via `useTranslation('cardEditor')`. Using a relative path keeps
 * the namespace boundary explicit at the call site (no `cardEditor.` prefix
 * baked into the constant, which would cause double-prefix drift under
 * rule 023 § Namespace Naming).
 */
export const CARD_FIELDS: readonly CardFieldDefinition[] = [
  { key: 'phone', labelKey: 'step3.fieldsSection.fields.phone' },
  { key: 'email', labelKey: 'step3.fieldsSection.fields.email' },
  { key: 'memberLevel', labelKey: 'step3.fieldsSection.fields.memberLevel' },
  { key: 'birthday', labelKey: 'step3.fieldsSection.fields.birthday' },
  { key: 'visitCount', labelKey: 'step3.fieldsSection.fields.visitCount' },
  { key: 'memberName', labelKey: 'step3.fieldsSection.fields.memberName' },
];
