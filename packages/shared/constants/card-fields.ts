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
 * Field group — controls where the option is shown in the editor UI.
 *
 *   - 'common' : every card type sees this option in the Step 3 left/right
 *                field selector (phone, email, member level, etc).
 *   - 'stamp'  : only cardType ∈ {stamp_card, multipass} sees this option.
 *                Stamp-specific data (point balance, stamp progress, etc.)
 *                is meaningless on non-stamp cards, so these options are
 *                hidden rather than rendered as a confusing placeholder.
 *   - 'reward' : only cardType === 'reward_card' sees this option.
 *                Reward-specific data (points to next tier, current point
 *                balance) is meaningless on non-reward cards.
 *
 * The `group` discriminator is the single source of truth for the
 * conditional filter: `Step3CardFields` reads `group` and filters
 * declaratively, so adding a new field requires editing only this file.
 */
export type CardFieldGroup = 'common' | 'stamp' | 'reward' | 'cashback';

/**
 * Canonical field keys. Order is user-visible in the dropdown for common
 * keys; stamp-group keys are appended after the common keys (and only shown
 * when cardType ∈ {stamp_card, multipass}); reward-group keys are appended
 * last (only shown when cardType === 'reward_card').
 *
 * IMPORTANT: Adding a new key requires syncing:
 *   1. cardFieldKeySchema in packages/shared/schemas/card.ts (auto-derived
 *      from this array via `z.enum([...CARD_FIELD_KEYS])`)
 *   2. TemplateSettings.leftField/rightField interface (apps/backend/.../db/templates.ts)
 *   3. i18n step3.fieldsSection.fields.{key} in cardEditor.{zh-TW,en}.ts
 *   4. CARD_FIELDS entry below (with the right `group` discriminator)
 *   5. i18n fieldPreview.{key} in passCard.{zh-TW,en}.ts (label + value)
 */
export const CARD_FIELD_KEYS = [
  'phone',
  'email',
  'memberLevel',
  'birthday',
  'visitCount',
  'memberName',
  'availableRewards',
  'totalStamps',
  'stampsRemaining',
  // ── reward: only reward_card ──────────────────────────────────────────
  // 2026-09-10 reward_card Step 3 display-field extension:
  //   pointsToNextTier — 到下一階還差 / Points to Next Tier
  //   currentPoints    — 已累積點數 / Current Points
  // The label / value for the preview-only demo are static strings defined
  // in passCard.{zh-TW,en}.ts (matching the existing phone/email pattern).
  // Real values will be sourced from the member row once PassCreator is
  // wired (same as other demo fields).
  'pointsToNextTier',
  'currentPoints',
  // ── cashback: only cashback_card ─────────────────────────────────────
  // 2026-09-12 cashback card Step 3 display-field extension:
  //   pointsToNextTierCashback — 到下個層級還差 / Amount to Next Tier
  //   accumulatedSpendCashback — 已累積消費 / Accumulated Spending
  // Cashback fields are semantically distinct from reward_card fields
  // (spend amounts vs. points), so they use separate keys rather than
  // overloading the existing points keys. The English label deliberately
  // drops "Points" because cashback is spend-based, not point-based.
  // (2026-09-12 copy fix: "Points to Next Tier" → "Amount to Next Tier".)
  'pointsToNextTierCashback',
  'accumulatedSpendCashback',
] as const;

export type CardFieldKey = (typeof CARD_FIELD_KEYS)[number];

export interface CardFieldDefinition {
  key: CardFieldKey;
  /** i18n key path inside the 'cardEditor' namespace */
  labelKey: string;
  /**
   * Which card types see this option in the Step 3 selector.
   * - 'common'  : always shown
   * - 'stamp'   : only shown when cardType ∈ {stamp_card, multipass}
   * - 'reward'  : only shown when cardType === 'reward_card'
   * - 'cashback': only shown when cardType === 'cashback_card'
   */
  group: CardFieldGroup;
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
  // ── common: every card type ────────────────────────────────────────────
  { key: 'phone',       group: 'common', labelKey: 'step3.fieldsSection.fields.phone' },
  { key: 'email',       group: 'common', labelKey: 'step3.fieldsSection.fields.email' },
  { key: 'memberLevel', group: 'common', labelKey: 'step3.fieldsSection.fields.memberLevel' },
  { key: 'birthday',    group: 'common', labelKey: 'step3.fieldsSection.fields.birthday' },
  { key: 'visitCount',  group: 'common', labelKey: 'step3.fieldsSection.fields.visitCount' },
  { key: 'memberName',  group: 'common', labelKey: 'step3.fieldsSection.fields.memberName' },
  // ── stamp: only stamp_card / multipass ─────────────────────────────────
  { key: 'availableRewards', group: 'stamp', labelKey: 'step3.fieldsSection.fields.availableRewards' },
  { key: 'totalStamps',      group: 'stamp', labelKey: 'step3.fieldsSection.fields.totalStamps' },
  { key: 'stampsRemaining',  group: 'stamp', labelKey: 'step3.fieldsSection.fields.stampsRemaining' },
  // ── reward: only reward_card (2026-09-10) ──────────────────────────────
  // Display-field extension for the Reward Card tier system. Preview values
  // are static demo strings (see passCard.{zh-TW,en}.ts fieldPreview);
  // real values will be sourced from the member row once PassCreator is
  // wired (same deferred path as phone / email / visitCount).
  { key: 'pointsToNextTier', group: 'reward', labelKey: 'step3.fieldsSection.fields.pointsToNextTier' },
  { key: 'currentPoints',    group: 'reward', labelKey: 'step3.fieldsSection.fields.currentPoints' },
  // ── cashback: only cashback_card (2026-09-12) ───────────────────────
  // Display-field extension for the Cashback Card tier system. Preview values
  // are static demo strings (see passCard.{zh-TW,en}.ts fieldPreview);
  // real values will be sourced from the member row once PassCreator is
  // wired (same deferred path as phone / email / visitCount).
  { key: 'pointsToNextTierCashback',   group: 'cashback', labelKey: 'step3.fieldsSection.fields.pointsToNextTierCashback' },
  { key: 'accumulatedSpendCashback',   group: 'cashback', labelKey: 'step3.fieldsSection.fields.accumulatedSpendCashback' },
];
