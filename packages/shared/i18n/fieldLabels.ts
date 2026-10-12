/**
 * Field labels — single source of truth for the Step 3 dropdown labels
 * that also flow into the Passcreator `headerFields[].label` /
 * `primaryFields[].label` / `secondaryFields[].label` slots.
 *
 * @module shared/i18n/fieldLabels
 * @description Both the frontend preview (`useTranslation('passCard')`)
 * and the backend push (`passTemplateMapping.ts`) read from this module.
 * The frontend passes the BROWSER language via `react-i18next`; the
 * backend passes the DB-stored `templates.settings.language` (zh-TW | en)
 * so the deployed pass uses the same wording as the editor preview.
 *
 * Architecture (v4 plan, with v5 Passcreator `headerField` per-cardType):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ packages/shared/i18n/fieldLabels.ts  (this file)         │
 *   │  ↳ getFieldLabel(key, language) → string                 │
 *   │  ↳ getFieldLabelMap(language)   → Record<CardFieldKey,…> │
 *   │  ↳ getHeaderField(cardType, language) → {key,label}|null │
 *   │  ↳ getSlotNames / getBackSideLabels / getDefaults /      │
 *   │    getPreviewPillLabels(language) → sub-object           │
 *   └──────────────────────────────────────────────────────────┘
 *              ↑                       ↑
 *   ┌──────────┴──────────┐  ┌─────────┴──────────┐
 *   │ apps/frontend       │  │ apps/backend        │
 *   │  useTranslation()   │  │ passTemplateMapping │
 *   │  (browser locale)   │  │  (DB language)      │
 *   └─────────────────────┘  └────────────────────┘
 *
 * Rule references:
 *   - Rule 023 § i18n naming — flat key namespace, no nested object.
 *   - Rule 023 § Shared Validation 用 i18n Key — error messages are
 *     i18n keys, but this module is the inverse: it RETURNS localized
 *     strings (the shared module is the producer; consumers read).
 *   - Rule 019 § D.3 — third-party (Passcreator) shape is a contract;
 *     mapping module must read from this single source.
 *
 * @see runs/decisions/2026-10-11-step8-passcreator-push.md (plan v4)
 * @see apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts
 * @see apps/frontend/src/i18n/locales/passCard.{zh-TW,en}.ts (frontend spread)
 */

import { CARD_FIELD_KEYS, type CardFieldKey, type FieldSemanticType } from '../constants/card-fields';
import type { CardType } from '../schemas/card';
import { zhTW } from './fieldLabels.zh-TW';
import { en } from './fieldLabels.en';

/**
 * Languages supported for the Passcreator push. Mirrors the
 * `languageSchema` in `packages/shared/schemas/card.ts` (Layer 1 of
 * Rule 019 § 4.1).
 *
 * Adding a new language requires:
 *   1. Adding the value to `languageSchema` (shared schema).
 *   2. Adding the value to `SUPPORTED_LANGUAGES` (shared i18n).
 *   3. Creating a new `fieldLabels.<lang>.ts` file.
 *   4. Re-running `fieldLabels.test.ts` (drift detection will fail
 *      until the new locale ships matching keys).
 */
export type PassLanguage = 'zh-TW' | 'en';

export type FieldLabels = typeof zhTW;

/**
 * CardType-aware memberLevel label overrides.
 *
 * The Passcreator push must use the SAME label strings as the editor
 * Step 3 dropdown. The editor applies a cardType override in
 * `Step3CardFields::resolveOptionLabelKey` (see
 * apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3CardFields/index.tsx):
 *
 *   - stamp_card / reward_card / cashback_card → 「獎勵」 / "Reward"
 *     (semantically "first reward tier name" / "first cashback tier name"
 *     — the editor renames the field to signal the tier-data source)
 *   - discount_card → 「折扣等級」 / "Discount Tier"
 *     (semantically "first discount tier name" — the editor deliberately
 *     uses a different label so users see the tier semantics instead of
 *     the generic "reward" semantics; see the per-key comment in
 *     cardEditor.zh-TW.ts::step3.fieldsSection.fields.memberLevelDiscount)
 *   - any other cardType (membership_card, multipass, coupon_card,
 *     gift_card, undefined) → falls back to the default 「會員等級」 /
 *     "Member Level"
 *
 * Without this override, the editor preview shows 「獎勵」 (zh-TW) /
 * "Reward" (en) on a stamp_card but the deployed pass on Passcreator
 * shows 「會員等級」 / "Member Level" — drift between editor and
 * production.
 *
 * The override is local to `memberLevel` because it's the only key with
 * a cardType-driven semantic shift in Step 3. If a future field needs
 * the same treatment (e.g. a `discountTierBracket` override), add a
 * dedicated `xxxOverrides` block here and a dedicated helper.
 */
const MEMBER_LEVEL_OVERRIDE_CARD_TYPES = new Set<CardType>([
  'stamp_card',
  'reward_card',
  'cashback_card',
  'discount_card',
]);

/**
 * Look up a CardFieldKey label in a given language.
 *
 * `cardType` is OPTIONAL — when provided, the lookup applies
 * cardType-aware overrides (see MEMBER_LEVEL_OVERRIDE_CARD_TYPES
 * doc above). The frontend editor (which already renders the
 * cardType-specific label via `Step3CardFields::resolveOptionLabelKey`)
 * does NOT need to pass `cardType` because the editor's own
 * `useTranslation('cardEditor')` call resolves the override key
 * directly. The backend `passTemplateMapping.ts` MUST pass `cardType`
 * so the pushed label matches what the editor rendered.
 *
 * Falls back to the canonical CardFieldKey string if the language
 * dictionary is missing a key — better to render a debuggable token
 * than to throw. The drift test (`fieldLabels.test.ts`) ensures all
 * locales have all keys, so the fallback is a safety net, not a
 * primary path.
 *
 * @example
 *   getFieldLabel('phone', 'zh-TW');                          // '電話'
 *   getFieldLabel('phone', 'en');                             // 'Phone'
 *   getFieldLabel('memberLevel', 'zh-TW');                    // '會員等級'
 *   getFieldLabel('memberLevel', 'zh-TW', 'stamp_card');      // '獎勵'
 *   getFieldLabel('memberLevel', 'zh-TW', 'discount_card');   // '折扣等級'
 *   getFieldLabel('memberLevel', 'en', 'reward_card');        // 'Reward'
 *   getFieldLabel('memberLevel', 'en', 'discount_card');      // 'Discount Tier'
 */
export function getFieldLabel(
  key: CardFieldKey,
  language: PassLanguage,
  cardType?: CardType | null,
): string {
  const dict = selectLabels(language);

  // memberLevel cardType-aware override — see MEMBER_LEVEL_OVERRIDE_CARD_TYPES
  // doc above for the full rationale. The override keys are NOT
  // CardFieldKey themselves (they're sub-categories of memberLevel), so
  // we don't extend the `fieldLabels` record. We index into a dedicated
  // sub-object on the locale struct instead.
  if (key === 'memberLevel' && cardType && MEMBER_LEVEL_OVERRIDE_CARD_TYPES.has(cardType)) {
    const override = dict.memberLevelOverrides[cardType];
    if (override) {
      return override;
    }
  }

  const value = dict.fieldLabels[key];
  return value ?? key;
}

/**
 * Bulk-fetch the full `Record<CardFieldKey, string>` map for a given
 * language, with optional cardType-aware overrides applied uniformly.
 *
 * Used by the Passcreator mapping module to populate
 * `headerFields[].label` / `primaryFields[].label` / `secondaryFields[].label`
 * for every `CardFieldKey` in one call. Pass `cardType` to mirror the
 * editor's `resolveOptionLabelKey` behavior — without it, the pushed
 * pass shows the generic `memberLevel` label instead of the
 * cardType-specific one.
 *
 * @example
 *   const m = getFieldLabelMap('zh-TW');
 *   m.phone;                          // '電話'
 *   m.email;                          // 'E-mail'
 *   m.memberLevel;                    // '會員等級' (default)
 *
 *   const m2 = getFieldLabelMap('zh-TW', 'stamp_card');
 *   m2.memberLevel;                   // '獎勵' (override applied)
 */
export function getFieldLabelMap(
  language: PassLanguage,
  cardType?: CardType | null,
): Record<CardFieldKey, string> {
  const dict = selectLabels(language);
  const out: Partial<Record<CardFieldKey, string>> = {};
  for (const key of CARD_FIELD_KEYS) {
    out[key] = getFieldLabel(key, language, cardType);
  }
  return out as Record<CardFieldKey, string>;
}

/**
 * Slot name labels — the literal "Left Slot" / "Right Slot" words that
 * appear above the Step 3 dropdowns. These are NOT in Passcreator output
 * (Apple Wallet / Google Wallet don't have slot names), but the editor
 * renders them and we want a single source of truth.
 */
export function getSlotNames(language: PassLanguage): { left: string; right: string } {
  const dict = selectLabels(language);
  return { left: dict.slotNames.left, right: dict.slotNames.right };
}

/**
 * Back-side labels — used for Step 4 ("back fields" rendered on the
 * back of the pass). The mapping module does NOT use this for
 * Passcreator `backFields[].label` (those labels are user-input
 * strings). It IS used by the editor preview to render "卡片資訊" /
 * "Card Info" titles.
 */
export function getBackSideLabels(language: PassLanguage): {
  title: string;
  hint: string;
  addField: string;
  removeField: string;
  labelPlaceholder: string;
  valuePlaceholder: string;
  required: string;
  minOne: string;
  maxReached: string;
} {
  const dict = selectLabels(language);
  return { ...dict.backSide };
}

/**
 * Default placeholder strings for empty-card state (used by the editor
 * when a user hasn't typed anything yet). NOT sent to Passcreator —
 * editor-only.
 */
export function getDefaults(language: PassLanguage): {
  cardType: string;
  issuerName: string;
  cardName: string;
} {
  const dict = selectLabels(language);
  return { ...dict.defaults };
}

/**
 * Preview pill labels — the small headers above the dynamic store-driven
 * preview values (餘額 / Balance, 會員到期日 / Member Expiry, etc.).
 * Editor-only, NOT in Passcreator output.
 *
 * 2026-10-11 — note: the Apple Wallet `headerField` label (the small
 * label at the top of the deployed pass) is sourced from a SEPARATE
 * `headerField` block (see `getHeaderField` below). Both blocks MUST
 * share the same label strings; the conformance test
 * `fieldLabels.test.ts::previewPill-vs-headerField` enforces parity
 * to prevent the editor preview and the deployed pass from diverging.
 */
export function getPreviewPillLabels(language: PassLanguage): {
  balance: string;
  memberExpiry: string;
  discountExpiry: string;
  couponExpiry: string;
  giftPoints: string;
} {
  const dict = selectLabels(language);
  return { ...dict.previewPill };
}

/**
 * Passcreator `headerFields[0]` per-cardType mapping (2026-10-11).
 *
 * Returns the `{key, label}` pair for the Apple Wallet `headerField`
 * slot, fixed per cardType. The tenant sees this label in the Step 1
 * preview (via `PassCardPreviewHeader::resolveHeaderRightSlot`) the
 * moment they pick a card type, and the deployed pass carries the
 * SAME label.
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ cardType           →  key              label            │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ membership_card    →  'memberExpiry'   '會員到期日' / 'MT'│
 *   │ discount_card      →  'discountExpiry' '有效期限' / 'ED'  │
 *   │ coupon_card        →  'couponExpiry'   '有效期限' / 'ED'  │
 *   │ stamp_card         →  'balance'        '餘額' / 'Balance' │
 *   │ reward_card        →  'balance'        '餘額' / 'Balance' │
 *   │ cashback_card      →  'balance'        '餘額' / 'Balance' │
 *   │ multipass          →  'balance'        '餘額' / 'Balance' │
 *   │ gift_card          →  'giftPoints'     '點數' / 'Points'  │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Returns `null` when `cardType` is `null` / `undefined` (the
 * editor hasn't picked a card type yet) — the caller is expected
 * to treat that as "no headerField" (Passcreator accepts an empty
 * array).
 *
 * The `key` is the stable Passcreator field identifier (used when
 * pushing template updates / reading back per-pass values); the
 * `label` is the user-visible string at the top of the pass.
 *
 * Branch order MUST mirror
 * `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/passCardPreviewSlot.ts::resolveHeaderRightSlot`
 * — if you add a new cardType, add a row to BOTH places (or refactor
 * `resolveHeaderRightSlot` to read from `getHeaderField` so there is
 * only one source of truth).
 *
 * @example
 *   getHeaderField('membership_card', 'zh-TW');   // {key: 'memberExpiry', label: '會員到期日'}
 *   getHeaderField('stamp_card',      'en');      // {key: 'balance',      label: 'Balance'}
 *   getHeaderField(null,              'zh-TW');   // null
 */
export function getHeaderField(
  cardType: CardType | null | undefined,
  language: PassLanguage,
): { key: string; label: string } | null {
  if (!cardType) return null;
  const dict = selectLabels(language);
  const entry = dict.headerField[cardType];
  return entry ?? null;
}

/**
 * v12 (2026-10-12): Header field keys → Passcreator `fields[].type` mapping.
 *
 * Header fields are NOT in `CARD_FIELDS` (they don't appear in the Step 3
 * left/right dropdown — they're fixed per cardType via `getHeaderField()`).
 * They need their own metadata map so `mapFieldType()` can resolve the
 * Passcreator type for `headerFields[0].type`.
 *
 * Keys here MUST stay in lockstep with the table inside `getHeaderField()`:
 *   - membership_card    → memberExpiry  (date)
 *   - discount_card      → discountExpiry (date)
 *   - coupon_card        → couponExpiry  (date)
 *   - stamp/reward/cashback/multipass → balance (number)
 *   - gift_card          → giftPoints    (number)
 *
 * `passValidDays` is also 'number' for completeness — it's the only
 * header key that is NOT yet produced by `getHeaderField()` (no current
 * cardType maps to it) but the type stays aligned so future cardTypes
 * can opt in without re-plumbing `mapFieldType()`.
 *
 * @see runs/improvements/feedback/20261012-step8-passcreator-v11-cross-reference-fields.md § 教訓 4
 */
export const HEADER_FIELD_TYPES: Readonly<Record<string, FieldSemanticType>> = {
  memberExpiry: 'date',
  discountExpiry: 'date',
  couponExpiry: 'date',
  balance: 'number',
  giftPoints: 'number',
  passValidDays: 'number',
};

/**
 * Field preview label for a CardFieldKey (the per-field label that
 * appears next to the demo value in the PassCard preview, e.g.
 * "電話" / "+8869XXXXXXXX"). Editor-only; the label is the same as
 * `getFieldLabel` for most keys but a few differ (e.g. memberLevel
 * shows "會員等級" in the dropdown but may show "獎勵" in the stamp
 * preview).
 *
 * For the basic label (no card-type override), this is identical to
 * `getFieldLabel`. The frontend preview component applies the
 * card-type-specific override on top of this base label.
 */
export function getFieldPreviewLabel(key: CardFieldKey, language: PassLanguage): string {
  // For v1 the preview label and the dropdown label are identical for
  // every key. We keep this function as a separate API so that if a
  // future card-type-specific override needs to live in shared
  // (instead of frontend-local), the surface is ready.
  return getFieldLabel(key, language);
}

/**
 * Internal: pick the right labels object for a language.
 *
 * Strict — unknown language codes throw. The shared schema
 * `languageSchema` already constrains valid values, so an unknown
 * value would only surface if a caller bypassed zod (which is a
 * programming error worth surfacing loudly).
 */
function selectLabels(language: PassLanguage): FieldLabels {
  switch (language) {
    case 'zh-TW':
      return zhTW;
    case 'en':
      return en;
    default: {
      const _exhaustive: never = language as never;
      throw new Error(`[fieldLabels] unsupported language: ${String(language)}`);
    }
  }
}
