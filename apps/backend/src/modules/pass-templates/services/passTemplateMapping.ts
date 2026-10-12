/**
 * Passcreator template body mapping — DB row → upstream request body.
 *
 * @module modules/pass-templates/services/passTemplateMapping
 * @description Pure function that converts a SAOME `TemplatesRow` into
 * the JSON body that the Passcreator V2 API expects for
 * `POST /api/v2/pass-template` (create) and
 * `POST /api/v2/pass-template/:id` (update).
 * NOTE: V2 update is `POST`, NOT `PUT` — V1 used PUT, V2 standardized
 * on POST for all mutations. See `passcreator.ts::updatePassTemplate`
 * for the regression trace (2026-10-12).
 *
 * Architecture (v5 plan):
 *   - This is a PURE function. No SQL, no fetch, no env reads. Caller
 *     passes `language` explicitly so the labels can be sourced from
 *     `@saome/shared/i18n/fieldLabels` (single source of truth).
 *   - The mapping module owns the *shape*; `passTemplateSync` owns the
 *     *transport* (create vs update, error handling). Keeping them split
 *     makes the shape unit-testable without HTTP mocks.
 *
 * What the mapping does:
 *   1. Projects SQL `templates.name` → Passcreator `name`.
 *   2. Projects SQL `templates.settings.logoText` (Step 2) → `logoText`
 *      as a separate top-level field (v9 — 2026-10-12). `logoText` is
 *      the Apple Wallet header strip text; previously v6-v8 folded it
 *      into the `name` fallback chain and never sent it separately,
 *      so the deployed pass header strip was empty.
 *      The Card Name (display title in Passcreator's UI) still falls
 *      back through `logoText` when `templates.name` is empty.
 *   3. Projects SQL `templates.settings.issuerName` (Step 2) →
 *      `organizationName` (Apple Wallet convention).
 *   4. Projects SQL `templates.settings.description` (Step 4) →
 *      `description`.
 *   5. Projects `settings.backgroundColor / textColor` (Step 3) → `colors`.
 *      Keep the leading `#` because Passcreator regex requires
 *      `^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`.
 *   6. Projects `settings.barcodeType` (Step 2) → `barcode.format` enum.
 *   7. Builds `fields` (header / primary / secondary / auxiliary / back):
 *      - `headerFields[0]` is **FIXED per cardType** — NOT driven by
 *        Step 3. Source: `getHeaderField(cardType, language)` from
 *        `@saome/shared/i18n/fieldLabels`. Per-cardType rules:
 *          - membership_card        → {key: 'memberExpiry',   label: '會員到期日' / 'Member Expiry'}
 *          - discount_card          → {key: 'discountExpiry', label: '有效期限' / 'Expiry Date'}
 *          - coupon_card            → {key: 'couponExpiry',   label: '有效期限' / 'Expiry Date'}
 *          - stamp/reward/cashback/multipass → {key: 'balance',  label: '餘額' / 'Balance'}
 *          - gift_card              → {key: 'giftPoints',     label: '點數' / 'Points'}
 *          - cardType null/undef    → empty `headerFields` array
 *      - `primaryFields[]` — v12-followup (2026-10-12):
 *          - membership_card ⇒ [{ key: 'memberName', label: '會員姓名' / 'Member Name', value: '{memberName}', type: 'text' }]
 *          - 其它 cardType  ⇒ [] (Apple Wallet `primaryFields[]` is RESERVED for the
 *                          「most important field」slot — user 2026-10-12 directive:
 *                          「只有會員卡的會員姓名會在 Primary fields」)
 *      - `secondaryFields[]` — v12-followup (2026-10-12):
 *          - Step 3 「左欄」(settings.leftField) → secondaryFields[0]
 *          - Step 3 「右欄」(settings.rightField) → secondaryFields[1]
 *          - 順序 = 左 / 右（user 報「左欄位是第 1 個，右欄位是第 2 個」）;
 *            設了才 emit；兩欄都沒設 → `[]`
 *          - v6-v12 行為是把 leftField 推到 primaryFields[0] + rightField 推到
 *            secondaryFields[0] — 是 bug, v12-followup 修正
 *      - `auxiliaryFields` is always an empty array (v9 — 2026-10-12).
 *        SAOME's Step 3 does not currently author an auxiliary slot.
 *      - `backFields` use the user-authored `settings.backFields` array
 *        verbatim (label = user-typed string, value = user-typed string).
 *        **v12-followup**: backFields rows are NOT mirrored into
 *        `additionalProperties[]` anymore (user directive: 「backFields
 *        的值就填在 backFields 裡面就好」). Reverted from v7 add-on.
 *   8. Builds top-level `links[]` (v9 — 2026-10-12) from
 *      `settings.links[]`. Previously v6-v8 rendered links as HTML
 *      anchors inside `fields.backFields[].value`; v9 emits them at
 *      top-level per the canonical V2 contract. Cap at MAX_PASS_LINKS=4
 *      (Passcreator's documented 4-link cap).
 *   9. Builds top-level `locationsDisabled` + conditional `locations[]`
 *      (v9 — 2026-10-12). Per the user's directive: "地理位置是否啟用,
 *      取決於DB裡的設定，若有開啟，要把裡面的資訊推上去". When
 *      `settings.locationsDisabled === false`, push the array; when
 *      `true`, omit the array entirely (Passcreator never sees stale
 *      location data).
 *      v13 (2026-10-12) — each `locations[]` row now also carries
 *      `name` (per-row user-facing label, Passcreator V2 accepts it;
 *      previously v9 stripped it based on an incomplete reading of
 *      the describe response). Top-level `initialMessage` (welcome
 *      push-notification body) and `locationsMaxDistance` (pass-level
 *      notification radius in meters, [100, 1000]) are now also
 *      pushed when set. See `runs/improvements/feedback/20261012-
 *      step8-passcreator-v13-location-radius-initial-message-and-
 *      membership-backfields.md`.
 *  10. Builds `backFields` from one of two sources depending on
 *      `cardType` (v13 — 2026-10-12):
 *        - `membership_card` ⇒ flatten `settings.membershipTiers[].rewards[]`
 *          (each reward row becomes one backField row; tier name is NOT
 *          prefixed, per user 2026-10-12 directive). Membership cards
 *          use the Step 6 tier editor to author benefits, so
 *          `settings.backFields[]` is an empty placeholder for this
 *          card type.
 *        - all other cardTypes ⇒ use `settings.backFields[]` (v9
 *          behavior preserved).
 *      Edge case: membership_card with no tiers AND non-empty
 *      `settings.backFields[]` falls back to the legacy source (so
 *      a tenant who authored backFields before adding tiers doesn't
 *      lose their content silently).
 *  11. Builds `images` from `settings.issuerLogo / iconImage` etc.
 *      When the value is a JSONB R2 key, we convert it to the public R2 URL.
 *
 * Why `headerField` is FIXED per cardType (v5 user decision, 2026-10-11):
 *   The Apple Wallet `headerField` is the small label at the top of the
 *   pass — its semantic meaning is "what type of value is shown here"
 *   (member expiry / discount expiry / coupon expiry / balance / gift
 *   points), which is determined by the cardType, NOT by the user's
 *   Step 3 field selection. Previously (v4) the mapping put
 *   `settings.leftField` into `headerFields[0]`, which meant the
 *   label was dynamic — a stamp_card with `leftField: 'phone'` would
 *   show "電話" at the top of the pass instead of "餘額". The user
 *   clarified: "header field 的標籤，其實一開始就定義好了，不是
 *   step3 設定的" — the label is fixed at Step 1 (card type selection)
 *   time, NOT at Step 3 (left/right dropdown) time.
 *
 * What the mapping does NOT do (deferred):
 *   - Pass issuance (the per-member pass object). That's a different
 *     flow: `POST /api/pass-templates/:id/issue-pass`. Out of scope for
 *     Step 8.
 *   - Real member-row data in `headerFields[].value` / `primaryFields[]
 *     .value` / `secondaryFields[].value`. Step 8 only pushes the
 *     *template*; per-pass values are filled in at issuance time.
 *   - Translation of `backFields[].label` to the user-locale string.
 *     Per design (2026-10-11), back fields are user input — they were
 *     authored in a specific locale and we don't second-guess them.
 *
 * Rule references:
 *   - Rule 000 Part C.2 — third-party mapping: pure function, no
 *     transport, fully unit-testable.
 *   - Rule 019 § 4.1 — `TemplateSettings` is the source of truth (Layer 3).
 *   - Rule 019 § D.3 — third-party API is a contract; mapping is the
 *     one place we serialize to that contract.
 *
 * @see runs/decisions/2026-10-11-step8-passcreator-push.md
 */

import type { Sql } from '@/shared/db/client';
import type { TemplatesRow } from '@/modules/cards/db/templates';
import type { PassLanguage } from '@saome/shared/i18n/fieldLabels';
import {
  getFieldLabel,
  getFieldLabelMap,
  getHeaderField,
  HEADER_FIELD_TYPES,
} from '@saome/shared/i18n/fieldLabels';
import { CARD_FIELDS, type FieldSemanticType } from '@saome/shared/constants/card-fields';
import type {
  PasscreatorAdditionalProperty,
  PasscreatorFieldType,
  PasscreatorTemplateBody,
} from '@/shared/lib/passcreator';

/**
 * Mapping options.
 *
 * `r2PublicUrl` is the env-derived base URL for the R2 bucket — used to
 * convert R2 keys (`{tenant_id}/{template_id}/logo.png`) to absolute
 * public URLs that Passcreator can fetch at template-creation time.
 *
 * `logoText` is the Step 2 logo text — separate from `templates.name`
 * (which is the Card Name). Passcreator's `name` field accepts either;
 * we prefer `name` and fall back to `logoText` so the deployed pass has
 * a sensible display title.
 */
export interface MapTemplateToPasscreatorArgs {
  template: TemplatesRow;
  language: PassLanguage;
  r2PublicUrl: string;
  /**
   * Optional env-derived pass type id override. Defaults to
   * `templates.settings.passTypeId` if the editor ever adds that field
   * (future); currently hard-coded to env-driven
   * `PASSCREATOR_PASS_TYPE_ID` so we ignore this. Reserved.
   */
  passTypeId?: string;
}

/**
 * Normalize a hex color to Passcreator's `^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`
 * regex format (REQUIRED by the Passcreator V2 API, 2026-10-11).
 *
 * Contract:
 *   - Output MUST start with `#` (the earlier `stripHexHash` helper
 *     dropped the `#`, which silently failed Passcreator validation
 *     with `errors[].colors.foregroundColor` matching the regex).
 *   - Output MUST be uppercase 6-digit form when possible (cleaner
 *     diff; Passcreator accepts lowercase too but we pick a canonical
 *     form to keep test fixtures stable).
 *   - Empty / missing input → empty string (Passcreator accepts empty
 *     colors and falls back to the pass-type default).
 *
 * Edge cases:
 *   - `'#abcdef'`       → `'#ABCDEF'`
 *   - `'#abc'`          → `'#ABC'`   (accepted by regex `^#[A-Fa-f0-9]{3}$`)
 *   - `'ABCDEF'` (no `#`) → `'#ABCDEF'`  (we prepend the missing `#`)
 *   - `'#GGGGGG'` (invalid) → returned as-is (Passcreator will reject)
 *
 * Defensive: we do NOT throw on bad hex — the upstream will reject it,
 * and `BadGatewayError` will carry the V2 envelope's per-field reason
 * for the frontend banner. Throwing here would obscure the source of
 * the failure.
 */
function normalizeHexColor(value: string | undefined | null): string {
  if (!value) return '';
  let v = value.trim();
  if (v.length === 0) return '';
  if (!v.startsWith('#')) v = `#${v}`;
  return v.toUpperCase();
}

/**
 * Convert an R2 key (e.g. `{tenant_id}/{template_id}/icon.png`) to a
 * public URL the Passcreator API can fetch. When the input is already
 * an absolute URL (legacy / pre-R2 migration), return it as-is.
 *
 * Returns `null` when the key is empty — Passcreator rejects empty
 * `images.icon` (verified 2026-10-11 with
 *   `errors[].images.icon = 'The given icon  could not be downloaded.'`
 * when value is `''`). The mapping uses the `null` return as a
 * "skip this field" signal and omits the key from the request body,
 * letting Passcreator fall back to the pass-type default icon.
 *
 * The `null` return is also distinct from an empty string so the
 * caller can use truthy checks (`if (url)`) to decide whether to
 * include the key.
 *
 * URL pattern (2026-10-12 fix — regression from the v4 push):
 *   `${r2PublicUrl}/api/pass-templates/${templateId}/${imageType}`
 *
 * v4 constructed URLs as `${r2PublicUrl}/${r2Key}` (e.g.
 * `.../<tenantId>/<templateId>/icon.png`), which has NO matching
 * route — Passcreator's server-to-server fetch hit 404 and
 * rejected the template with
 *   `errors[].images.icon = 'The given icon ... could not be downloaded.'`
 *
 * The new pattern points at the public R2 proxy route added in
 * `routes/getTemplateImage.ts::createGetTemplateImageRoute`, which
 * validates the tenant owns the image, fetches from R2, and streams
 * the bytes back. Passcreator can now download successfully.
 *
 * Legacy absolute URLs (e.g. `https://cdn.example.com/icon.png`) are
 * still passed through unchanged — pre-R2 rows may have a hard-coded
 * CDN URL in `settings.<field>`.
 */
function r2KeyToPublicUrl(
  key: string | undefined | null,
  r2PublicUrl: string,
  templateId: string,
  imageType: 'logo' | 'icon' | 'background',
): string | null {
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key; // legacy absolute URL — pass through
  const base = r2PublicUrl.replace(/\/$/, '');
  return `${base}/api/pass-templates/${templateId}/${imageType}`;
}

/**
 * Map a `barcodeType` value (Step 2) to the Passcreator `PKBarcodeFormat*`
 * enum. The schema constrains `barcodeType` to `'qr_code' | 'pdf_417'`,
 * so the exhaustive switch is type-safe.
 *
 * Defaults to `PKBarcodeFormatQR` for unknown values — safer than
 * throwing because the editor's zod validation prevents unknowns in
 * production, but a corrupted row from a legacy migration could surface.
 */
function mapBarcodeFormat(barcodeType: TemplatesRow['settings']['barcodeType']): 'PKBarcodeFormatQR' | 'PKBarcodeFormatPDF417' {
  switch (barcodeType) {
    case 'pdf_417':
      return 'PKBarcodeFormatPDF417';
    case 'qr_code':
    case undefined:
    case null:
    default:
      return 'PKBarcodeFormatQR';
  }
}

/**
 * v12 (2026-10-12): Face-field type map — derived ONCE at module load
 * from `CARD_FIELDS` metadata. No more hard-coded switch cases.
 *
 * The Map preserves insertion order, which is irrelevant for `get()`
 * but useful for debugging (entries appear in `CARD_FIELDS` order).
 */
const FACE_FIELD_TYPE_MAP: ReadonlyMap<string, FieldSemanticType> = new Map(
  CARD_FIELDS.map((f) => [f.key, f.semanticType]),
);

/**
 * Map a SAOME card field key to Passcreator's `PasscreatorFieldType`
 * (the data type of a field's `value`).
 *
 * v12 (2026-10-12) — DATA-DRIVEN refactor. Previously this was a
 * 19-case hard-coded switch that drifted each time a new CardFieldKey
 * was added to `CARD_FIELDS` (see v11 feedback § 教訓 4). Now the
 * mapping is sourced from metadata:
 *
 *   1. `CARD_FIELDS` (face display fields, declared in
 *      `packages/shared/constants/card-fields.ts`) carries a required
 *      `semanticType: 'text' | 'number' | 'date'` per entry. TypeScript
 *      fails the build if any new entry forgets to declare it.
 *   2. `HEADER_FIELD_TYPES` (per-cardType header fields, declared in
 *      `packages/shared/i18n/fieldLabels.ts` next to `getHeaderField()`)
 *      covers the 6 header field keys (memberExpiry / discountExpiry
 *      / couponExpiry / balance / giftPoints / passValidDays).
 *   3. Fallback: `'text'` for any unknown key. Passcreator accepts
 *      text for any value, so this is the safe default.
 *
 * Per Passcreator V2 docs (`update-a-template.md`), every field entry
 * requires `type`, `label`, AND `value`. The `type` field is a render
 * hint, not a strict validator — so 'text' as the universal fallback
 * never causes a rejection upstream.
 *
 * For `additionalProperties[].type` (a different field with a
 * narrower enum that excludes 'date'), the date-key coercion to
 * `'text'` lives in `buildAdditionalProperties()` — NOT here. This
 * function only emits the `fields[].type` value.
 *
 * Tested by `passTemplateMapping.test.ts`:
 *   - 9 pre-existing tests under "field type mapping (regression —
 *     2026-10-11)" pin the v11 behavior (preserved 1:1).
 *   - New "v12 data-driven" describe block iterates every CARD_FIELDS
 *     key + every header field key, plus edge cases (null / undefined
 *     / unknown key).
 *
 * @see runs/improvements/feedback/20261012-step8-passcreator-v11-cross-reference-fields.md § 教訓 4
 * @see packages/shared/constants/card-fields.ts (CARD_FIELDS source of truth)
 * @see packages/shared/i18n/fieldLabels.ts (HEADER_FIELD_TYPES source of truth)
 */
function mapFieldType(key: string | undefined | null): PasscreatorFieldType {
  if (!key) return 'text';
  const t = FACE_FIELD_TYPE_MAP.get(key) ?? HEADER_FIELD_TYPES[key];
  return (t ?? 'text') as PasscreatorFieldType;
}

/**
 * Build the `fields` block for a single side of the pass.
 *
 * Each `headerField` / `primaryField` / `secondaryField` has shape:
 *   { key: CardFieldKey, label: string (localized), value: '' }
 *
 * The `value` is left empty for the template — at issuance time the
 * per-pass code reads the member row and injects the real value.
 * `backFields` use user-typed `label` (not the localized label) and
 * `value` from `settings.backFields[*]`.
 *
 * `cardType` is threaded through so `getFieldLabel` can apply the
 * memberLevel cardType-aware override (see `fieldLabels.ts` for the
 * full rationale). Without it, a stamp_card's `memberLevel` slot
 * would push 「會員等級」 (zh-TW) / "Member Level" (en) to Passcreator
 * even though the editor renders 「獎勵」 / "Reward" in the same
 * slot — silent drift between editor preview and deployed pass.
 */
function buildFieldRows(args: {
  fieldKey: TemplatesRow['settings']['leftField'] | TemplatesRow['settings']['rightField'];
  language: PassLanguage;
  cardType: TemplatesRow['card_type'];
  value: string;
}): { key: string; label: string; value: string } {
  const label = args.fieldKey
    ? getFieldLabel(args.fieldKey, args.language, args.cardType)
    : '';
  return {
    key: args.fieldKey ?? '',
    label: label ?? '',
    value: args.value,
  };
}

/**
 * Normalize a link value (from `settings.links[].value`) to a valid
 * URL string for Passcreator V2.
 *
 * Per the user's directive (2026-10-12): "link的值沒有包裹html, 所以
 * 我們要定義: 網址(網站或whatsapp連結，可是這個本來就是html可以
 * 直接用)、郵箱(mailto)、電話(tel:) 或之類可以包裹的資料怎麼推上去".
 *
 * Passcreator V2's `links[]` array accepts raw URL values; Apple Wallet
 * and Google Wallet dispatch by URL scheme:
 *
 *   - `https://` / `http://` → opens in browser (incl. WhatsApp's
 *                                wa.me.net / api.whatsapp.com / chat.whatsapp.com)
 *   - `mailto:`              → opens Mail app
 *   - `tel:`                 → opens Phone app
 *   - `sms:` / `geo:` / etc. → opens respective native app
 *
 * SAOME's Step 4 lets them type free-form contact info, so the mapping
 * must add the scheme prefix when missing. Detection order:
 *
 *   1. Already has a scheme (RFC 3986: `^[a-z][a-z0-9+\-.]*:`) → keep
 *      as-is. The tenant knows what they're doing.
 *   2. Looks like email (`local@domain.tld`, simple RFC 5322 form)
 *      → prefix `mailto:`.
 *   3. Looks like phone (digits / `+` / spaces / dashes / parens, with
 *      >= 7 actual digits and no `@` / `.`) → prefix `tel:`. We keep
 *      the original formatting (dashes, spaces, parens) verbatim —
 *      Apple's tel: handler accepts all of them.
 *   4. Otherwise → return `null`. Caller drops the row. Refusing to
 *      guess protects against `example.com` (could be URL OR a
 *      description), `Hello World` (description), etc.
 *
 * Trims surrounding whitespace first so a user who copy-pastes with
 * leading/trailing spaces still gets a usable URL.
 *
 * Pure function. No I/O. Unit-tested in `passTemplateMapping.test.ts`.
 *
 * @param value - the raw `settings.links[].value` (user-authored text)
 * @returns The normalized URL string, or `null` when the value can't
 *          be unambiguously resolved to a URL.
 *
 * @see https://developer.passcreator.com/en/api/v2/pass-template
 *      (Passcreator `links[]` contract)
 */
export function normalizeLinkUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length === 0) return null;

  // 1. Already has scheme (https://, http://, mailto:, tel:, sms:, geo:,
  //    wa.me, api.whatsapp, chat.whatsapp, etc.) — keep verbatim.
  if (/^[a-z][a-z0-9+\-.]*:/i.test(v)) {
    return v;
  }

  // 2. Email: simple local@domain.tld pattern.
  //    Reject if it contains whitespace or doesn't have a `.` in the
  //    domain part. We don't try to enforce full RFC 5322 (overkill for
  //    a UI input field); the tenant is the source of truth and Passcreator
  //    accepts anything that resolves via mailto:.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return `mailto:${v}`;
  }

  // 3. Phone: digits / `+` / spaces / dashes / parens only, with >= 7
  //    actual digits and no `.` (which would suggest a URL/path).
  //    Common Taiwan formats:
  //      - `+886-2-1234-5678`    (international, 11 digits after +)
  //      - `02-1234-5678`        (landline, 10 digits)
  //      - `0912345678`          (mobile, 10 digits)
  //      - `0800-123-4567`       (toll-free, 11 digits)
  //      - `+1 (555) 123-4567`   (US, 11 digits, with parens + spaces)
  //    Lower bound 7 digits filters random short numeric strings.
  const strippedPhone = v.replace(/[\s\-()]/g, '');
  if (/^[\d+]+$/.test(strippedPhone)) {
    const digitCount = (strippedPhone.match(/\d/g) ?? []).length;
    if (digitCount >= 7) {
      return `tel:${v}`;
    }
  }

  // 4. Unrecognized — drop. Passcreator would reject anyway.
  return null;
}

/**
 * Map a SAOME `TemplatesRow` to a `PasscreatorTemplateBody`.
 *
 * Pure function — no SQL, no fetch, no env. The caller supplies
 * everything we need to build the upstream body. This makes the
 * mapping unit-testable without HTTP mocks (see
 * `passTemplateMapping.test.ts`).
 *
 * Defensive: when an optional field is missing, we send an empty
 * string (Passcreator accepts empty values and falls back to pass-type
 * defaults). When a required field is missing, we DO throw — better
 * to surface the data integrity issue than to silently corrupt the
 * Passcreator template.
 */
export function mapTemplateToPasscreator(args: MapTemplateToPasscreatorArgs): PasscreatorTemplateBody {
  const { template, language, r2PublicUrl } = args;
  const s = template.settings ?? ({} as TemplatesRow['settings']);

  // Passcreator's `name` is required. Prefer templates.name (Card Name),
  // fall back to settings.logoText, then to a generic default.
  const name = (template.name && template.name.trim()) || s.logoText || 'Untitled Card';

  // headerField / primaryField / secondaryField — driven by v5 rules
  // + v12-followup (2026-10-12, post data-driven mapFieldType):
  //
  //   - headerFields[0] is FIXED per cardType (NOT from Step 3).
  //     Source: getHeaderField(cardType, language). The tenant sees
  //     this label in the Step 1 preview the moment they pick a card
  //     type, and the deployed pass carries the SAME label. When
  //     cardType is null/undefined, headerFields is empty (Passcreator
  //     accepts an empty array).
  //
  //   - primaryFields[] — 2026-10-12 v12-followup. Was dynamic from
  //     `settings.leftField` (the "Left Slot" dropdown in Step 3)
  //     from v6-v12. Now RESERVED for the Apple Wallet "most important
  //     field" slot:
  //       membership_card → [memberName]  (Step 3 dropdown HIDES memberName
  //                       for membership_card to avoid duplication with
  //                       `templates.name`; mapping 強制 emit it)
  //       其它 cardType  → []
  //     See `runs/improvements/feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md`
  //     for user rationale trace.
  //
  //   - secondaryFields[] — 2026-10-12 v12-followup. Was [rightField]
  //     only from v6-v12. Now BOTH Step 3 dropdowns land here:
  //       secondaryFields[0] = settings.leftField  (Step 3 Left Slot)
  //       secondaryFields[1] = settings.rightField (Step 3 Right Slot)
  //     設了才 emit;兩欄都沒設 → [].
  //
  // 2026-10-12 v11 fix — value uses `{KeyName}` cross-reference syntax
  //   (replacing the previous `value: ''`). Each populated slot also
  //   contributes one entry to `additionalProperties[]` so the
  //   placeholder is resolvable in Passcreator's designer. The
  //   per-pass runtime continues to inject the real value at issuance
  //   time — the template-level placeholder is just so Passcreator
  //   admin visibly shows the slot (otherwise the slot looks "empty"
  //   in the UI even though the key/label are correct). See
  //   `buildAdditionalProperties` for the slot-entry logic and the
  //   user-facing rationale in
  //   `runs/improvements/feedback/20261012-step8-passcreator-v11-…` (TBD).
  //
  // We use the per-key `getFieldLabel(key, language, cardType)` call
  // (not the bulk `getFieldLabelMap`) so the `memberLevel` cardType-aware
  // override is applied — see `fieldLabels.ts` for the rationale. The
  // bulk map is still re-exported below for downstream consumers.
  const headerEntry = getHeaderField(template.card_type, language);
  const headerFields = headerEntry
    ? [{
        key: headerEntry.key,
        // Field type is required by Passcreator V2 (see
        // `update-a-template.md`). For headerField slots the semantic
        // type comes from the key itself:
        //   - 'balance' / 'giftPoints' → 'number'
        //   - 'memberExpiry' / 'discountExpiry' / 'couponExpiry' → 'date'
        //   - other (future) → 'text'
        type: mapFieldType(headerEntry.key),
        label: headerEntry.label,
        // v11: value uses `{KeyName}` cross-reference so Passcreator
        // designer shows the slot with its intended variable bound.
        value: `{${headerEntry.key}}`,
      }]
    : [];
  // 2026-10-12 v12-followup: primaryFields is RESERVED for the Apple
  // Wallet "most important field" slot. Per Apple Wallet convention +
  // user 2026-10-12 directive (「只有會員卡的會員姓名會在 Primary fields」):
  //   - cardType === 'membership_card'  ⇒ emit ONE entry (memberName)
  //   - 其它 cardType                    ⇒ emit []
  //
  // Step 3 左/右欄位 (settings.leftField, settings.rightField) BOTH
  // 改放到 secondaryFields（見下）；v6-v12 把 leftField 推到
  // primaryFields[0] 是 bug, 本 commit 修正。
  //
  // memberName 在 CARD_FIELDS 內 hideOnCardTypes: ['membership_card']
  // — Step 3 dropdown 對會員卡不顯示「會員姓名」選項。但 mapping 對會員卡
  // 強制 emit — user 報 Apple Wallet primary slot 就是要顯示會員姓名。
  const primaryFields: { key: string; label: string; value: string; type: PasscreatorFieldType }[] = [];
  if (template.card_type === 'membership_card') {
    primaryFields.push({
      key: 'memberName',
      type: mapFieldType('memberName'),
      label: getFieldLabel('memberName', language, 'membership_card') ?? '',
      value: '{memberName}',
    });
  }

  // 2026-10-12 v12-followup: secondaryFields[] 是 Step 3 左右欄位的家。
  //
  // Apple Wallet secondaryFields[] 是真 array — 兩個 entry 都有位置。
  // v6-v12 只用 s.rightField 推到 secondaryFields[0]、把 leftField 推到
  // primaryFields[0] 是 bug。修正：兩個 dropdown 都放 secondaryFields，
  // 順序 = leftField 在前、rightField 在後（user 原話：
  // 「左欄位是第 1 個，右欄位是第 2 個」）。
  //
  // 沒設定的欄位 filter 掉（不產 placeholder）；兩個都沒設時
  // secondaryFields = []。
  const secondaryFields: { key: string; label: string; value: string; type: PasscreatorFieldType }[] = [];
  for (const slotKey of [s.leftField, s.rightField]) {
    if (!slotKey) continue;
    secondaryFields.push({
      key: slotKey,
      type: mapFieldType(slotKey),
      label: getFieldLabel(slotKey, language, template.card_type) ?? '',
      value: `{${slotKey}}`,
    });
  }

  // backFields — user-authored label/value pairs from Step 4. The
  // label is the USER's typed string (in the locale they typed it),
  // not the localized CardFieldKey label. The `key` is empty because
  // the back field doesn't tie to a CardFieldKey — it's free-form
  // user content. The `type` defaults to 'text' because users don't
  // author a type for back fields in the Step 4 editor.
  //
  // 2026-10-12 v9 fix: link rendering moved out of backFields. Links
  // are now sent as a TOP-LEVEL `links[]` array (Passcreator V2
  // contract; see `links?` field type in `passcreator.ts` and the
  // user's pasted V2 example payload). Previously v7-v8 rendered links
  // as `<a href="...">...</a>` HTML anchors inside `backFields[].value`
  // (per the Passcreator docs' "use HTML links anywhere in your back
  // fields" workaround). v9 removes that workaround in favor of the
  // canonical top-level placement.
  //
  // The `additionalProperties[]` cross-reference entries (type: 'url')
  // are STILL generated from `settings.links[]` — the cross-reference
  // variable is independent of the rendering slot.
  //
  // 2026-10-12 v13 fix — membership_card backFields source switch.
  // For membership_card, the user-authored back content lives in
  // `settings.membershipTiers[].rewards[]` (per-tier 會員獎勵 sub-rows),
  // not in `settings.backFields[]` (which is an empty placeholder for
  // this card type — the Step 4 free-form back field area is not used
  // for membership cards; tenants build their benefits via the
  // Step 6 membership tier editor).
  //
  // The mapping flattens every reward row across every tier into a
  // single `backFields[]` array (no tier-name prefix — per user
  // confirmation 2026-10-12: "rewards 裡面的 label、value 就是會員卡的
  // backFields"). Rows with both label and value empty are skipped
  // (Passcreator would reject them anyway).
  //
  // Edge case — if `membershipTiers` is empty AND the legacy
  // `settings.backFields[]` happens to have content, fall back to the
  // legacy backFields. This protects against the rare transition state
  // where a tenant added backFields before adding any tier (or a tier
  // was deleted but backFields retained). Without this fallback, a
  // membership_card with zero tiers would ship an empty back to
  // Passcreator and the tenant would lose their content silently.
  //
  // For ALL other cardTypes, the source remains `settings.backFields[]`
  // (v9 behavior). Even if `settings.membershipTiers[]` happens to be
  // present (e.g. a cardType was switched), we DO NOT read it for
  // non-membership cardTypes — keeps the per-cardType contract explicit.
  const backFields = template.card_type === 'membership_card'
    ? (s.membershipTiers ?? []).flatMap((tier) =>
        (tier.rewards ?? [])
          .filter((r) => r.label.length > 0 || r.value.length > 0)
          .map((r) => ({ key: '' as const, type: 'text' as const, label: r.label, value: r.value })),
      )
    : (s.backFields ?? []).map((row) => ({
        key: '' as const,
        type: 'text' as const,
        label: row.label,
        value: row.value,
      }));

  // v13 — membership_card empty-tiers fallback (see comment above).
  // The final array used downstream is this `finalBackFields`, not
  // the raw `backFields` computed above.
  const finalBackFields =
    template.card_type === 'membership_card' &&
    backFields.length === 0 &&
    (s.backFields ?? []).length > 0
      ? (s.backFields ?? []).map((row) => ({
          key: '' as const,
          type: 'text' as const,
          label: row.label,
          value: row.value,
        }))
      : backFields;

  return {
    passTypeId: args.passTypeId ?? 'pass.saome.org.passcreator',
    /**
     * Passcreator `type` REQUIRED field — pinned to `'storeCard'`.
     *
     * 2026-10-11: simplified to a constant. The SAOME editor's
     * CardBuilder templates are designed exclusively for the
     * Apple-Wallet `PKPassStyleStoreCard` layout (header / primary /
     * secondary / back slots + strip + logo). Other Passcreator
     * `type` values (`coupon` / `eventTicket` / `generic` /
     * `boardingPass` / `eventTicketBackground`) require pass-type-
     * specific layout templates that SAOME does not yet author, so
     * we send `storeCard` for every push regardless of `cardType`.
     *
     * When SAOME later adds layout support for other Passcreator
     * `type` values (e.g. true coupon layouts for `coupon_card`),
     * reintroduce the `mapPassType(cardType)` helper here and pin
     * the new mapping with tests under the
     * `mapTemplateToPasscreator — type mapping (regression — 2026-10-11)`
     * describe block in `passTemplateMapping.test.ts`.
     */
    type: 'storeCard',
    name,
    /**
     * 2026-10-12 v9 fix — `logoText` as a separate top-level field.
     *
     * Previously the mapping folded `settings.logoText` into the `name`
     * fallback chain and did NOT push `logoText` separately. Passcreator's
     * V2 example payload shows `logoText` as a distinct top-level field
     * (`"logoText": ""` in the docs example), and the deployed pass's
     * header strip is sourced from THIS field, not from `name`.
     *
     * SAOME mapping rule: always emit `logoText` at top-level — even when
     * empty (the V2 docs example shows `""`). Source:
     * `settings.logoText` verbatim. The Card Name (the display title in
     * Passcreator's UI) stays in `name`, sourced from `templates.name`
     * with `settings.logoText` fallback. Both are independent top-level
     * V2 fields.
     */
    logoText: s.logoText ?? '',
    description: s.description ?? '',
    organizationName: s.issuerName ?? '',
    colors: {
      backgroundColor: normalizeHexColor(s.backgroundColor),
      foregroundColor: normalizeHexColor(s.textColor),
    },
    /**
     * Barcode configuration.
     *
     * User-requested defaults (2026-10-11):
     *   - "Use automatic generated ID" → `useAutoIdForValue: true`
     *     (Passcreator auto-generates a per-pass unique id when no
     *     explicit value is supplied at issuance time)
     *   - "Value is provided on pass creation" → `value: ''`
     *     (Passcreator accepts the per-pass runtime injection; the
     *     empty string means "no template-level default — let the
     *     per-pass API call supply the value, or fall back to the
     *     auto-generated id when useAutoIdForValue is on")
     */
    barcode: {
      format: mapBarcodeFormat(s.barcodeType),
      value: '',
      useAutoIdForValue: true,
    },
    images: (() => {
      // Build image URLs via the public R2 proxy at
      // `/api/pass-templates/:id/:type` (regression fix 2026-10-12).
      // The previous `${r2PublicUrl}/${r2Key}` pattern had no matching
      // route and Passcreator rejected with
      //   `errors[].images.icon = 'The given icon ... could not be downloaded.'`
      // The public route validates the tenant owns the image and
      // streams from R2 with the right Content-Type.
      //
      // 2026-10-12 v7 fix: the pushed key for the strip image is
      // `background`, NOT `strip`. Passcreator V2's describe response
      // uses `images.background` for the strip slot (and the SAOME
      // mu-plugins Passcreator Engine at
      // `SAOME-Passcreator-Engine/modules/passcreator-template.php`
      // builds `images.background` from the same R2 key). The previous
      // `images.strip` key was silently dropped by Passcreator (no
      // warning, no error) — the user saw "strip image not uploaded"
      // on the deployed pass despite the SAOME push returning 200.
      const out: Record<string, string> = {};
      const iconUrl = r2KeyToPublicUrl(s.iconImage, r2PublicUrl, template.id, 'icon');
      const logoUrl = r2KeyToPublicUrl(s.issuerLogo, r2PublicUrl, template.id, 'logo');
      const stripUrl = r2KeyToPublicUrl(s.backgroundImage, r2PublicUrl, template.id, 'background');
      if (iconUrl) out.icon = iconUrl;
      if (logoUrl) out.logo = logoUrl;
      if (stripUrl) out.background = stripUrl;
      return out;
    })(),
    fields: {
      headerFields,
      primaryFields,
      secondaryFields,
      /**
       * 2026-10-12 v9 — `auxiliaryFields` is required by V2 schema.
       * SAOME's Step 3 does not currently author an auxiliary slot
       * (only leftField / rightField are user-configurable). The mapping
       * emits `[]` to maintain V2 schema alignment — Passcreator's
       * describe response always includes `auxiliaryFields` (even when
       * empty).
       */
      auxiliaryFields: [],
      backFields: finalBackFields,
    },
    /**
     * 2026-10-12 v10 — Top-level `links[]`. Per the V2 endpoint contract
     * (Passcreator's documented `update-a-template.md` + the canonical
     * example payload the user pasted in this session), `links` is a
     * TOP-LEVEL array, NOT nested inside `fields`.
     *
     * Source: `settings.links[]` (Step 4 author content). Cap at
     * MAX_PASS_LINKS=4 (Passcreator's documented 4-link cap for the
     * dedicated `links` slot). Empty array is accepted.
     *
     * URL scheme normalization (v10 — 2026-10-12, per the user's
     * directive "link的值沒有包裹html, 所以我們要定義: 網址...郵箱
     * (mailto)...電話(tel:)...之類可以包裹的資料怎麼推上去"):
     *   - https:// / http:// / wa.me / mailto: / tel: / sms: / geo: etc.
     *     (any RFC 3986 scheme) → kept verbatim
     *   - `info@cafe.com`            → prefixed `mailto:`
     *   - `+886-2-1234-5678` / `0912345678` / `02-1234-5678` (phone-shaped,
     *     >= 7 digits) → prefixed `tel:`
     *   - Anything that can't be unambiguously normalized → DROPPED
     *     (Passcreator rejects empty / non-URL `links[].value` with a
     *     400; dropping keeps the push from breaking the entire template)
     *
     * The label passes through verbatim — the top-level `links[]` array
     * is plain JSON (no HTML anchor wrapping, no character escaping).
     *
     * The cross-reference `additionalProperties[]` entries for links
     * (type: 'url', placeholder = `{Name}`) are STILL built from
     * `settings.links[]` — the cross-reference variable is independent
     * of the rendering slot, but uses the same normalization so the
     * `{Name}` placeholder set stays consistent with the actually-pushed
     * URL set (no dangling placeholders pointing at URLs we didn't push).
     */
    links: (s.links ?? [])
      .flatMap((row): { label: string; value: string }[] => {
        const normalized = normalizeLinkUrl(row.value);
        return normalized ? [{ label: row.label, value: normalized }] : [];
      })
      .slice(0, MAX_PASS_LINKS),
    /**
     * 2026-10-12 v9 — Geolocation (Passcreator `locations` +
     * `locationsDisabled`).
     *
     * Per the user's directive: "地理位置是否啟用，取決於DB裡的設定，
     * 若有開啟，要把裡面的資訊推上去" (Whether geolocation is enabled
     * depends on the DB settings; if enabled, push the information).
     *
     * Source: `settings.locationsDisabled` (Step 5 toggle). When
     * `locationsDisabled === true` (the user-opt-out), `locations[]`
     * is OMITTED entirely from the payload. The `locationsDisabled`
     * toggle is ALWAYS sent (so Passcreator's state is explicit).
     *
     * 2026-10-12 v13 — three new fields added to this geolocation
     * block per user feedback on the v9 deploy:
     *   - `locations[].name` — per-row human-readable label
     *     (Passcreator V2 accepts it; previously v9 stripped it
     *     based on an incomplete reading of the describe response).
     *   - `initialMessage` (top-level) — push-notification body
     *     shown after the user downloads the pass. Omitted when empty.
     *   - `locationsMaxDistance` (top-level) — pass-level notification
     *     radius in meters (PassKit / Apple Wallet bound [100, 1000]).
     *     Omitted when null (= PassKit picks pass-type default).
     */
    locationsDisabled: s.locationsDisabled === true,
    ...(s.locationsDisabled === true
      ? {}
      : {
          locations: (s.locations ?? []).map((loc) => {
            const out: { latitude: number; longitude: number; relevantText?: string; name?: string } = {
              latitude: loc.latitude,
              longitude: loc.longitude,
            };
            if (loc.relevantText != null && loc.relevantText.length > 0) {
              out.relevantText = loc.relevantText;
            }
            // v13 — per-row user-facing label (Passcreator V2 accepts
            // `locations[].name` as an optional field). Omitted when
            // empty so the upstream UI doesn't render an empty label.
            if (loc.name && loc.name.length > 0) {
              out.name = loc.name;
            }
            return out;
          }),
        }),
    /**
     * 2026-10-12 v13 — `initialMessage` (top-level). Push-notification
     * body after the user downloads the pass. Omitted when empty /
     * undefined so Passcreator keeps its default behavior
     * (no welcome notification).
     */
    ...(s.initialMessage && s.initialMessage.length > 0
      ? { initialMessage: s.initialMessage }
      : {}),
    /**
     * 2026-10-12 v13 — `locationsMaxDistance` (top-level). Pass-level
     * notification radius in meters. `null` in DB → omitted (PassKit
     * picks the pass-type default). Range [100, 1000] is enforced
     * upstream by the shared zod schema.
     */
    ...(s.locationsMaxDistance != null
      ? { locationsMaxDistance: s.locationsMaxDistance }
      : {}),
    /**
     * 2026-10-12 v7 fix — additional properties (cross-reference
     * variable store). Each entry corresponds to ONE user-authored row
     * in `settings.backFields[]` (type: 'text') or `settings.links[]`
     * (type: 'url'). The tenant can reference any entry by name in
     * other fields' values via `{Name}` placeholders.
     *
     * 2026-10-12 v11 — additionally include one entry per populated
     * slot (`headerFields[0]` / `primaryFields[0]` / `secondaryFields[0]`)
     * so the `{KeyName}` cross-reference in the slot's `value` is
     * resolvable in Passcreator designer. Without these, the slot's
     * `value: '{KeyName}'` would render as an "unresolved variable"
     * warning in Passcreator admin.
     *
     * Built by `buildAdditionalProperties` below — pure function, no
     * side effects, fully unit-tested in
     * `passTemplateMapping.test.ts::mapTemplateToPasscreator —
     * additionalProperties (v7)` + `{Name} cross-reference values (v11)`.
     */
    additionalProperties: buildAdditionalProperties({
      backFields: s.backFields ?? [],
      links: s.links ?? [],
      slotKeys: {
        header: headerEntry?.key,
        left: s.leftField ?? null,
        right: s.rightField ?? null,
      },
    }),
  };
}

/**
 * Maximum number of links sent in the top-level `links[]` array.
 * Mirrors Passcreator's documented 4-link cap for the dedicated
 * `links` slot. Overflow is logged via `console.warn` but does not
 * throw — the user's other content still ships.
 *
 * 2026-10-12 v9 rename: previously `MAX_LINKS_IN_BACK_FIELDS` (when
 * links were rendered as HTML anchors inside `fields.backFields[]`).
 * v9 sends `links` as a top-level array, so the constant name now
 * reads true. The same cap also applies to the `additionalProperties[]`
 * cross-reference entries built from `settings.links[]`.
 */
const MAX_PASS_LINKS = 4;

/**
 * Build the `additionalProperties[]` array.
 *
 * Each entry corresponds to ONE cross-reference variable that the
 * tenant can reference via `{Name}` placeholders in any field's value.
 *
 * Sources (2026-10-12 v12-followup):
 *   0. **Slot keys** (`headerFields[0].key` / `secondaryFields[0..1].key`)
 *      — populated slots emit a property so their `{KeyName}` cross-reference
 *      resolves in Passcreator designer. (`primaryFields[0]` is only
 *      populated for membership_card → memberName; that flow is covered
 *      indirectly via the secondary slot when applicable.)
 *   1. ~~backFields rows~~ — REMOVED in v12-followup. User directive
 *      (2026-10-12): 「backFields 的值就填在 backFields 裡面就好」.
 *      `settings.backFields[]` is its OWN value store in
 *      `fields.backFields[]`; cross-reference mirroring is no longer
 *      needed. (Reverted from v7 plan
 *      `pass-template-mapping-strip-additional-props` § additionalProperties
 *      — see v12-followup plan for rationale + user feedback trace.)
 *   2. **Links** (`settings.links[]`) — type: 'url'. Same
 *      `normalizeLinkUrl` filter + `MAX_PASS_LINKS` cap as the top-level
 *      `links[]` array; guarantees `{Name}` placeholder set stays
 *      consistent with the pushed URL set (no dangling placeholders).
 *
 * Empty-label fallback: Passcreator rejects
 * `additionalProperties[].name = ''` with "The property name is required".
 * For the `links` source, when a row's `label` is empty but `value` is
 * non-empty, a stable name is derived from the first 30 chars of the
 * value (slug: trim, collapse whitespace to `_`, drop unsafe characters).
 * When BOTH label and value are empty, the row is skipped entirely.
 *
 * @param args.backFields  - UNUSED (kept for backward compat). The
 *                           `backFields` source was removed in v12-followup.
 * @param args.links       - `settings.links[]` (Step 4 author content, value = URL)
 * @returns PasscreatorAdditionalProperty[] — possibly empty
 *
 * Pure function. No I/O. Unit-tested in `passTemplateMapping.test.ts`.
 *
 * @see https://developer.passcreator.com/en/api/v2/pass-template
 *      (describe response shape; `additionalProperties` schema with
 *      `name` / `placeholder` / `type` / `required` / `hidden` / `options`)
 */
export function buildAdditionalProperties(args: {
  backFields: TemplatesRow['settings']['backFields'];
  links: TemplatesRow['settings']['links'];
  /**
   * 2026-10-12 v11 + v12-followup — Slot keys that the corresponding
   * `fields[]` row references via `{Name}` cross-reference. Each
   * populated slot adds ONE entry to `additionalProperties[]` so the
   * placeholder is resolvable in Passcreator's designer.
   *
   *   - `header`  — the Apple Wallet `headerField` slot's key
   *                 (e.g. `balance` / `discountExpiry` / `memberExpiry`).
   *                 `null` / `undefined` ⇒ no headerFields slot was emitted.
   *   - `left`    — `settings.leftField` (Step 3 "Left Slot" dropdown;
   *                 v12-followup: emitted into `secondaryFields[0]`).
   *   - `right`   — `settings.rightField` (Step 3 "Right Slot" dropdown;
   *                 v12-followup: emitted into `secondaryFields[1]`).
   *                 `null` / `undefined` ⇒ no secondaryFields slot was emitted.
   *
   * Order in the returned array: slot entries come FIRST (most visible
   * to the tenant), then `links`. Order within each block is the
   * same as the source iteration order.
   */
  slotKeys?: { header?: string | null; left?: string | null; right?: string | null };
}): PasscreatorAdditionalProperty[] {
  const out: PasscreatorAdditionalProperty[] = [];

  // 0. v11 — slot keys (headerFields / secondaryFields). Each populated
  //    slot emits ONE additional property whose name is the slot's `key`.
  //    `type` is derived via `mapFieldType`; date-typed keys fall back to
  //    'text' (Passcreator's additionalProperties.type enum doesn't
  //    include 'date' — the date semantic lives on the field slot itself).
  for (const k of [args.slotKeys?.header, args.slotKeys?.left, args.slotKeys?.right]) {
    if (!k) continue;
    const fieldType = mapFieldType(k);
    const propertyType: PasscreatorAdditionalProperty['type'] = fieldType === 'number' ? 'number' : 'text';
    out.push({
      name: k,
      placeholder: `{${k}}`,
      type: propertyType,
      required: false,
      hidden: false,
    });
  }

  // 1. (REMOVED 2026-10-12 v12-followup) backFields mirror.
  //    User directive: backFields values stay in fields.backFields[]
  //    and are NOT replicated into additionalProperties[]. Reverted
  //    from v7 add-on; see plan `pass-template-mapping-v12-followup`
  //    for full rationale.

  // 2. links → type: 'url'. The URL IS the value (the cross-reference
  //    variable resolves to the URL, not the HTML anchor form).
  //    Cap at MAX_PASS_LINKS — overflow is logged but not thrown so
  //    the user's other content still ships.
  //
  //    2026-10-12 v10: filter via `normalizeLinkUrl` so the `{Name}`
  //    placeholder set stays consistent with the actually-pushed URL
  //    set in `links[]`. A row that fails normalization is dropped from
  //    BOTH arrays — otherwise we'd ship a `{Name}` placeholder that
  //    points at a URL we never pushed upstream.
  const links = (args.links ?? []).filter((row) => normalizeLinkUrl(row.value) !== null);
  if (links.length > MAX_PASS_LINKS) {
    console.warn(
      `[passTemplateMapping] links count ${links.length} exceeds the ${MAX_PASS_LINKS}-link cap; ` +
        `overflow will be dropped from additionalProperties + top-level links.`,
    );
  }
  for (const row of links.slice(0, MAX_PASS_LINKS)) {
    const name = derivePropertyName(row.label, row.value);
    if (name === null) continue;
    out.push({
      name,
      placeholder: `{${name}}`,
      type: 'url',
      required: false,
      hidden: false,
    });
  }

  return out;
}

/**
 * Derive the `name` for an additional property from a user-authored
 * `{label, value}` row. Returns `null` when BOTH label and value are
 * empty (Passcreator rejects empty names outright).
 *
 * Name derivation priority:
 *   1. `label` (trimmed) if non-empty — this is what the tenant sees.
 *   2. Slug of first 30 chars of `value` (trim + collapse whitespace to `_`
 *      + drop unsafe characters) when label is empty.
 *   3. `null` when both label and value are empty/whitespace.
 *
 * Why we cap the slug at 30 chars: Passcreator may have an internal
 * length limit on property names (not explicitly documented, but
 * typical SaaS conventions cap at 50-100 chars). 30 leaves headroom
 * for `{Name}` placeholder syntax (the placeholder adds 2 chars of
 * curly braces around the name).
 */
function derivePropertyName(label: string | undefined | null, value: string | undefined | null): string | null {
  const trimmedLabel = (label ?? '').trim();
  if (trimmedLabel.length > 0) return trimmedLabel;
  const trimmedValue = (value ?? '').trim();
  if (trimmedValue.length === 0) return null;
  const slug = slugify(trimmedValue, 30);
  return slug.length > 0 ? slug : null;
}

/**
 * Convert a free-form string into a stable identifier suitable for
 * an additional property's `name`. Trims, collapses whitespace to
 * single underscores, drops characters that would break a URL /
 * identifier (anything outside ASCII alphanumerics, underscore, hyphen,
 * CJK ideographs, or basic punctuation).
 *
 * The output keeps Chinese / Japanese / Korean characters intact
 * (per the user's 2026-10-12 confirmation: "Additional properties 的
 * 命名是自由的" — they type the name in their locale). We only
 * normalize the structural form (whitespace + unsafe chars).
 *
 * @param input     - the raw value to slugify
 * @param maxLength - cap the output length (Passcreator's unstated internal limit)
 */
function slugify(input: string, maxLength: number): string {
  // Collapse all whitespace runs to single underscores.
  // Drop control chars + everything outside the safe set.
  // Keep the result under maxLength.
  const slug = input
    .replace(/\s+/g, '_')
    // Drop control chars and the few punctuation chars that aren't safe in a name.
    // Safe = ASCII alphanumerics, underscore, hyphen, dot,
    //       plus Unicode letter classes (Han / Hiragana / Katakana / Hangul).
    .replace(/[^\p{L}\p{N}_.\-]/gu, '')
    .slice(0, maxLength)
    .replace(/^[_.]+|[_.]+$/g, ''); // strip leading / trailing separators
  return slug;
}

/**
 * Build a `Record<CardFieldKey, string>` from the labels in a given
 * language. Re-exports the shared helper so this module's surface is
 * self-contained for downstream consumers.
 */
export { getFieldLabelMap, getHeaderField };
