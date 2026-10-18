/**
 * Passcreator API client — shared lib.
 *
 * @module shared/lib/passcreator
 * @description Thin wrapper around Passcreator's REST API for template
 * lifecycle operations (create / update / fetch). Used by the Step 8
 * "Save & Publish" hook to push the SAOME card template upstream so
 * Passcreator can issue the actual Apple Wallet / Google Wallet pass.
 *
 * Architecture (v4 plan):
 *   - This module owns the upstream contract. Service modules
 *     (`passTemplateMapping`, `passTemplateSync`) call into this and
 *     MUST NOT reach out to Passcreator directly.
 *   - All non-2xx responses throw `BadGatewayError` so the route layer
 *     maps them to a stable 502 + i18n key for the frontend banner.
 *   - Authentication uses the API key from `env.PASSCREATOR_API_KEY`,
 *     sent as `Authorization: <raw-key>` (Passcreator's V2 scheme does
 *     NOT use the `Bearer` prefix — verified 2026-10-11 against the
 *     real endpoint; `Bearer` prefix causes silent 401 with empty body).
 *   - The Team Identifier (`U53JD8FLAG`) is NOT a backend concern.
 *     Apple Wallet signing is handled by Passcreator's own
 *     certificate infra; the SAOME backend only needs the API key.
 *
 * Rule references:
 *   - Rule 000 Part C.2 (third-party service module structure): one
 *     provider per file, SDK / fetch errors caught and re-thrown as
 *     SaomeError subclasses, no leakage of upstream types into the
 *     route layer.
 *   - Rule 019 § D.3 (third-party API is also a contract): the
 *     request/response types below mirror the Passcreator V2 API
 *     shape so the backend can validate the response before using
 *     any field. We don't use Passcreator's SDK (no published
 *     first-party SDK); the manual types are the contract.
 *   - Rule 017 (post-deploy CORS): the Passcreator URL is fetched
 *     server-to-server, no CORS concerns.
 *
 * @see runs/decisions/2026-10-11-step8-passcreator-push.md (plan)
 * @see .cursor/rules/000-modular-design.mdc Part C
 */

import { BadGatewayError } from './saomeError';

/**
 * Passcreator template body — the shape we send on `POST /api/v2/pass-template`.
 *
 * Only the fields used by the SAOME Step 8 push are typed. Passcreator
 * accepts many more fields (barcode alt-text, app store links, etc.)
 * but the SAOME editor doesn't author them yet — we keep the contract
 * narrow to avoid sending zero-valued junk upstream.
 *
 * Field types map the Passcreator V2 API documentation as of 2026-10-11.
 * If Passcreator adds new required fields, the type must be updated and
 * the mapping module (`passTemplateMapping.ts`) must populate them.
 *
 * @see https://app.passcreator.com/en/api-documentation/v2
 */
export type PasscreatorPassType =
  | 'coupon'
  | 'storeCard'
  | 'eventTicketBackground'
  | 'eventTicket'
  | 'generic'
  | 'boardingPass';

/**
 * Passcreator field type — the data type of a field's `value`.
 *
 * Required for every `fields.*[N]` entry (validated 2026-10-11:
 *   `errors[].fields = 'All fields need to have at least type, label and value.'`
 * )
 *
 * Per Passcreator V2 docs (update-a-template.md):
 *   - `text`     — generic string (phone, email, address, etc.)
 *   - `date`     — `YYYY-MM-DD` or Apple Wallet's `PKDateStyle`
 *   - `number`   — integer or float
 *   - `currency` — formatted currency (Apple Wallet's `PKCurrencyStyle`)
 *   - `barcode`  — the value is rendered as a barcode in addition to
 *                  text (used for the dedicated `barcode` field, not
 *                  for header/primary/secondary; we keep this enum
 *                  member for completeness)
 *
 * Mapping is best-effort — SAOME's `CardFieldKey` (phone, email,
 * memberExpiry, etc.) is mapped to the closest Passcreator type.
 * When in doubt, default to `text` (Passcreator accepts text for
 * any value).
 */
export type PasscreatorFieldType = 'text' | 'date' | 'number' | 'currency' | 'barcode';

/**
 * Passcreator `additionalProperties` entry — the per-template variable
 * store that the tenant can cross-reference from any field via
 * `{Name}` placeholders.
 *
 * Per Passcreator V2 docs (https://developer.passcreator.com/en/api/v2/pass-template
 * describe response + `update-a-template.md`):
 *   - `name`        — user-facing, free-form per Passcreator docs ("you can
 *                     name your additional properties however you like").
 *                     SAOME's mapping sources `name` from
 *                     `settings.backFields[].label` (and `settings.links[].label`).
 *   - `placeholder` — auto-derived `{Name}` token used to cross-reference
 *                     this property in any other field. SAOME always emits
 *                     `{name}` — Passcreator's documented placeholder syntax.
 *   - `type`        — Passcreator's input type for the property. SAOME
 *                     uses:
 *                       - `'text'` for back fields (free-form user input)
 *                       - `'url'`  for links (the value is a URL)
 *   - `required`    — must the property be supplied at pass-issuance time?
 *                     SAOME defaults to `false` (back fields / links are
 *                     advisory, not blocking inputs).
 *   - `hidden`      — `true` = property exists for placeholder use but
 *                     doesn't render on the pass. SAOME defaults to `false`
 *                     (the value IS shown on the back of the pass).
 *   - `options`     — only meaningful for `select` / `checkbox` /
 *                     `radiobutton` types. SAOME doesn't currently
 *                     author these — omitted from the push.
 *
 * 2026-10-12 v7: introduced after the user clarified that
 * "Additional properties 的命名是自由的，也就是我們可以為了這些標籤
 * 命名自己的Additional properties". SAOME's source data is the
 * user-authored `settings.backFields[]` + `settings.links[]` arrays —
 * each row becomes one additional property.
 */
export interface PasscreatorAdditionalProperty {
  name: string;
  placeholder: string;
  type: 'text' | 'textarea' | 'url' | 'number' | 'select' | 'checkbox' | 'radiobutton';
  required: boolean;
  hidden: boolean;
  options?: string[];
}

/**
 * Passcreator template body — the shape we send on `POST /api/v2/pass-template`.
 *
 * Only the fields used by the SAOME Step 8 push are typed. Passcreator
 * accepts many more fields (barcode alt-text, app store links, etc.)
 * but the SAOME editor doesn't author them yet — we keep the contract
 * narrow to avoid sending zero-valued junk upstream.
 *
 * Field types map the Passcreator V2 API documentation as of 2026-10-11.
 * If Passcreator adds new required fields, the type must be updated and
 * the mapping module (`passTemplateMapping.ts`) must populate them.
 *
 * Required-field contract from Passcreator (verified by 400 response
 * captured 2026-10-11 against the live endpoint, see
 * `runs/improvements/feedback/20261011-step8-passcreator-push.md`):
 *   - `type`      — REQUIRED. Must be one of `PasscreatorPassType`.
 *     We default every SAOME card to `storeCard` because SAOME's 8
 *     cardTypes (membership/discount/stamp/reward/cashback/gift/multipass/coupon)
 *     don't 1:1 map to Passcreator's 6, and `storeCard` is the closest
 *     fit for "saved-value / loyalty card" (Apple Wallet's `PKPassStyleStoreCard`
 *     covers all SAOME loyalty / points / discount flows).
 *   - `colors.*`  — REQUIRED regex `^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`
 *     (Passcreator 2026-10-11 error envelope). Earlier we stripped the
 *     leading `#`, which silently failed with the same regex error.
 *   - `barcode.useAutoIdForValue` — Optional. Set to `true` to enable
 *     the "Use automatic generated ID" template-level option. The
 *     `barcode.value` field is then a placeholder that the upstream
 *     rewrites per-pass; the SAOME Step 8 template push leaves the
 *     value empty (`''`) because the per-pass runtime at issuance time
 *     injects the real member-row value.
 *   - `barcode.value` — Optional. When `useAutoIdForValue` is `true`,
 *     Passcreator interprets this as a fallback template default.
 *     SAOME leaves it empty (no template-level default) so the per-pass
 *     injection at issuance time is the single source of truth.
 *
 * @see https://app.passcreator.com/en/api-documentation/v2
 */
export interface PasscreatorTemplateBody {
  /** Pass Type ID (Passcreator-side identifier). Comes from env. */
  passTypeId: string;
  /**
   * Apple Wallet pass style. One of `PasscreatorPassType`. REQUIRED.
   *
   * Passcreator's "Pass Type ID" concept (`passTypeId` above) is
   * different from this `type` field: `passTypeId` is the
   * Apple-issued cert-bound identifier (per-account), while `type`
   * selects which Apple Wallet `PKPassStyle*` to render. Both are
   * required at template-create time.
   */
  type: PasscreatorPassType;
  /** Pass name (Apple Wallet: organization name shown on back). */
  name: string;
  /** Description shown in Apple Wallet / Google Wallet. */
  description: string;
  /** Organization name (Apple Wallet: passes.organizationName). */
  organizationName: string;
  /**
   * Visual customization. Passcreator regex requires `^#RRGGBB`
   * (or `^#RGB`); we serialize WITH the leading `#` (uppercase,
   * 6-digit form when possible). Empty string is accepted and falls
   * back to pass-type defaults.
   */
  colors: {
    backgroundColor: string;
    foregroundColor: string;
  };
  /**
   * Barcode configuration.
   *
   * `value` is left empty at template time — the per-pass runtime at
   * issuance time writes the real value (member-row barcode value).
   *
   * `useAutoIdForValue: true` enables the "Use automatic generated ID"
   * template option, so when no per-pass value is supplied Passcreator
   * falls back to its own auto-id. This is the user-requested
   * "default ON" behavior (2026-10-11, see
   * `runs/improvements/feedback/20261011-step8-passcreator-push.md`).
   */
  barcode: {
    format: 'PKBarcodeFormatQR' | 'PKBarcodeFormatPDF417';
    /** Template-time barcode value placeholder. Empty = supplied at pass-issuance time. */
    value: string;
    /** Use automatic generated ID when no per-pass value is supplied. Default `true`. */
    useAutoIdForValue: boolean;
  };
  /**
   * Image references.
   *
   * `icon` is REQUIRED by Passcreator V2 in practice — when the value
   * is `''` (empty string), Passcreator tries to download the empty
   * URL and returns
   *   `errors[].images.icon = 'The given icon  could not be downloaded.'`
   *
   * When the SAOME template has no icon uploaded, the mapping OMITS
   * the `icon` key entirely (rather than sending `''`) so Passcreator
   * falls back to the pass-type default icon.
   *
   * `logo` is optional — omitted when missing.
   *
   * `background` is the Apple Wallet "strip" image (a tall image that
   * renders between the header and the primary fields). 2026-10-12
   * v7 fix: the pushed key is `background`, NOT `strip`. Passcreator
   * V2's describe endpoint response (and the SAOME mu-plugins
   * Passcreator Engine's payload builder at
   * `SAOME-Passcreator-Engine/modules/passcreator-template.php`) both
   * use `images.background` for the strip slot. The previous
   * `images.strip` key was silently dropped by Passcreator — no
   * warning, no error — which is why the strip image "didn't get
   * uploaded" on the Step 8 push.
   *
   * 2026-10-15 v16 — `backgroundHidden` / `logoHidden` explicit
   * un-hide flags. Passcreator V2's describe response defaults BOTH
   * flags to `true`, meaning a template whose payload only sets
   * `images.background = '<url>'` (without `backgroundHidden: false`)
   * ends up with the "Hide background image" checkbox STILL checked
   * in Passcreator's settings UI — the deployed pass silently shows
   * no strip image. Same issue applies to logos (Passcreator defaults
   * `logoHidden: true`). User-reported 2026-10-15: "不用背景圖被打勾了"
   * after the v15 push successfully shipped `images.background` URLs.
   *
   * SAOME mapping emits `backgroundHidden: false` ONLY when
   * `images.background` has a URL; otherwise the flag is omitted
   * (letting Passcreator's "no image ⇒ hide" default apply). Same
   * rule for `logoHidden` ↔ `images.logo`.
   *
   * Source: https://developer.passcreator.com/en/api/v2/pass-template
   * (describe response — `images.background` / `images.backgroundHidden`
   * and `images.logo` / `images.logoHidden` are returned as separate
   * fields; the latter two default to `true`).
   */
  images: {
    icon?: string;
    logo?: string;
    background?: string;
    /**
     * 2026-10-13 v14 — per-pass background override. When `true`,
     * Passcreator accepts a per-pass background image at issuance time
     * that overrides the template-level `images.background` (which
     * remains as fallback).
     *
     * SAOME mapping HARDCODES `true` (user decision 2026-10-13): future
     * card templates get this flag set unconditionally so tenants can
     * upload per-pass backgrounds later without re-pushing the template.
     * No schema field, no DB column, no frontend toggle.
     */
    backgroundDifferentForEachPass?: boolean;
    /**
     * 2026-10-15 v16 — "Hide background image" checkbox (zh-TW:
     * 「不用背景圖」). Passcreator's describe response defaults this
     * to `true`, meaning the SAOME mapping MUST explicitly opt the
     * template OUT of hiding when `images.background` is set, or the
     * deployed pass won't show the strip image.
     *
     * When `images.background` is OMITTED (no URL available), this
     * flag is also OMITTED so Passcreator's default ("no image ⇒
     * no rendering") applies naturally.
     */
    backgroundHidden?: boolean;
    /**
     * 2026-10-15 v16 — "Hide logo" checkbox. Same default-`true`
     * behavior as `backgroundHidden`; emitted `false` when SAOME
     * sends `images.logo` so the deployed pass header strip shows
     * the tenant's logo.
     */
    logoHidden?: boolean;
  };
  /**
   * Logo text — text shown on the pass header (Apple Wallet's
   * `pkpass` `logoText` field; distinct from `name`).
   *
   * V2 endpoint expects this as a top-level field (separate from `name`).
   * Per the V2 docs example payload:
   *   "name": "My template",
   *   "logoText": "",
   * Both are required at template-create time (one of them must be
   * non-empty — Passcreator rejects an empty `name`).
   *
   * SAOME mapping rules:
   *   - Always emit `logoText` at top-level (even when empty — V2 docs
   *     example shows `""`).
   *   - Source: `settings.logoText` (Step 2 Logo Text field).
   *   - The Card Name (display title in Passcreator's UI) lives in the
   *     `name` field, sourced from `templates.name` (SQL column) with
   *     `settings.logoText` as fallback. See `mapTemplateToPasscreator`
   *     for the resolution rule.
   *
   * 2026-10-12 v9: SAOME's previous mapping FOLDED `settings.logoText`
   * into the `name` field's fallback chain and DID NOT push `logoText`
   * separately. Passcreator's deployed pass therefore showed an empty
   * header strip where the Logo Text should appear. Fix: emit
   * `logoText` as a separate top-level field sourced from
   * `settings.logoText` verbatim.
   */
  logoText?: string;
  /**
   * Per-template additional properties (the cross-reference variable
   * store). Each entry can be referenced from any other field via a
   * `{Name}` placeholder. SAOME's mapping builds this array from
   * `settings.backFields[]` (type: 'text') and `settings.links[]`
   * (type: 'url') — see `passTemplateMapping.ts::buildAdditionalProperties`.
   *
   * Optional in the interface (older test fixtures may not have it).
   * When `settings.backFields` and `settings.links` are both empty
   * arrays, the mapping sends an empty array — Passcreator accepts
   * that as "no additional properties".
   */
  additionalProperties?: PasscreatorAdditionalProperty[];
  /**
   * Localized fields. Each entry renders as a labeled row on the pass.
   *
   * `label` MUST be a localized string (from `getFieldLabelMap(language)`);
   * never hardcode the user-typed `settings.leftField` value as the label.
   * `key` matches `CardFieldKey` (e.g. 'phone', 'email') so the SAOME
   * member row can be looked up at issuance time.
   *
   * Each entry ALSO requires `type: 'text' | 'date' | 'number' | ...`
   * (Passcreator validates `type`, `label`, AND `value` together — see
   * `pass-template/describe-the-structure-of-a-pass-template.md`). The
   * mapping module (`passTemplateMapping.ts`) populates `type` from the
   * field's CardFieldKey; default is `'text'` when the key doesn't map
   * to a specific type.
   *
   * `auxiliaryFields` is an empty array by default — V2 expects it
   * (Passcreator's `fields.auxiliaryFields` schema includes the key
   * even when empty). SAOME's editor does not currently author an
   * auxiliary slot (the per-cardType Step 3 only configures leftField
   * / rightField). The mapping emits `[]` to maintain V2 schema
   * alignment.
   */
  fields: {
    headerFields: Array<{ key: string; type: PasscreatorFieldType; label: string; value: string }>;
    primaryFields: Array<{ key: string; type: PasscreatorFieldType; label: string; value: string }>;
    secondaryFields: Array<{ key: string; type: PasscreatorFieldType; label: string; value: string }>;
    auxiliaryFields: Array<{ key: string; type: PasscreatorFieldType; label: string; value: string }>;
    backFields: Array<{ key: string; type: PasscreatorFieldType; label: string; value: string }>;
  };
  /**
   * Dedicated link fields (Passcreator's 4-link cap slot).
   *
   * V2 endpoint contract: `links` is a top-level array (NOT nested
   * inside `fields`). Each entry has `{label, value}` where `value` is
   * a URL (tel:, mailto:, https://, etc.). Passcreator renders these
   * in a distinct UI area separate from `backFields`.
   *
   * SAOME mapping rule: source from `settings.links[]` (Step 4 author
   * content), cap at MAX_PASS_LINKS=4 (Passcreator's documented cap).
   * Empty array is accepted.
   *
   * 2026-10-12 v9 fix: the previous mapping rendered links as HTML
   * anchors inside `fields.backFields[].value` (per the Passcreator
   * docs' "you can also use HTML links anywhere in your back fields"
   * workaround). The V2 example payload the user pasted
   * (`runs/improvements/feedback/20261012-step8-passcreator-v9-structure-alignment.md`)
   * puts `links` at TOP-LEVEL, NOT inside `fields`. Sending `links` at
   * top-level matches the canonical V2 contract. The HTML anchor
   * rendering is REMOVED.
   *
   * The `additionalProperties[]` cross-reference entries (type: 'url')
   * are STILL generated from `settings.links[]` — the cross-reference
   * variable is independent of the rendering slot.
   */
  links?: Array<{ label: string; value: string }>;
  /**
   * Geolocation toggle for the pass (Passcreator `locationsDisabled`
   * top-level field). When `true`, the pass does NOT trigger
   * geolocation-based notifications.
   *
   * SAOME source: `settings.locationsDisabled` (Step 5 toggle).
   * Passcreator accepts `false` (= enabled) and `true` (= disabled).
   *
   * 2026-10-12 v9: the mapping NOW always sends `locationsDisabled`
   * so the upstream state is explicit. The companion `locations[]`
   * field is conditional — only sent when geolocation is enabled.
   */
  locationsDisabled?: boolean;
  /**
   * Geolocation triggers for the pass (Passcreator `locations`
   * top-level array). Each entry corresponds to one Apple Wallet
   * `pkpass` `relevantLocations` row, with Passcreator-aligned shape:
   *   - `latitude` / `longitude` (REQUIRED)
   *   - `relevantText` (optional lock-screen message)
   *   - `name` (optional human-readable label for the location)
   *
   * SAOME source: `settings.locations[]` (Step 5 entries).
   *
   * 2026-10-12 v9: only pushed when `settings.locationsDisabled === false`
   * (i.e., the tenant enabled the feature in the Step 5 editor). When
   * `locationsDisabled === true`, the key is OMITTED from the payload
   * so Passcreator never sees stale data — the per-rule spec is "if
   * disabled, don't push it".
   *
   * 2026-10-12 v13: per-row `name` is now included (Passcreator V2
   * accepts it as a user-facing label). Previously v9 stripped `name`
   * based on an incomplete reading of the describe response schema;
   * user feedback 2026-10-12 confirmed the field is part of the
   * canonical V2 contract. `name` is only emitted when non-empty.
   */
  locations?: Array<{
    latitude: number;
    longitude: number;
    relevantText?: string;
    /**
     * 2026-10-12 v13 — per-row human-readable name. Passcreator V2
     * `locations[].name` is optional; an empty string is treated by
     * Passcreator as "no label". SAOME source: `settings.locations[].name`
     * (Step 5 tenant-facing label).
     */
    name?: string;
  }>;
  /**
   * 2026-10-12 v13 — push-notification body after the user downloads
   * the pass (Passcreator `initialMessage` top-level field). Optional;
   * an empty string is treated by Passcreator as "no welcome
   * notification". SAOME source: `settings.initialMessage` (Step 5
   * "Initial message" textarea, ≤ INITIAL_MESSAGE_MAX_LENGTH=50 chars).
   */
  initialMessage?: string;
  /**
   * 2026-10-12 v13 — pass-level notification radius in meters
   * (Passcreator `locationsMaxDistance` top-level field). Optional;
   * valid range 100-1000 (PassKit / Apple Wallet bound per the
   * shared schema). `null` in DB → OMIT (PassKit picks pass-type
   * default). SAOME source: `settings.locationsMaxDistance`
   * (Step 5 "Notification radius" slider, [100, 1000] m).
   */
  locationsMaxDistance?: number;
}

/**
 * Passcreator template response — V2 standardized envelope.
 *
 * As of Passcreator V2 (2026-10-11 docs + live capture), every
 * response (success and error) follows the same envelope:
 *
 *   Success (e.g. POST /api/v2/pass-template → 201):
 *     {
 *       success: true,
 *       description: "Template was created successfully!",
 *       errors: [],
 *       data: { identifier: "<UUID>" },     ← id lives here
 *       statusCode: 201,
 *     }
 *
 *   Error (e.g. POST with missing fields → 400):
 *     {
 *       success: false,
 *       description: "Invalid data.",
 *       errors: [{ property: "name", message: "..." }]   // or singular object
 *         | { property: "...", message: "..." },
 *       data: [],
 *       statusCode: 400,
 *     }
 *
 * The template id is consistently at `data.identifier` on success.
 * Earlier versions of this client read top-level `result.id`, which
 * fails against the real endpoint with `create response missing id`
 * (regression 2026-10-12 — two production pushes returned a 201
 * envelope but the parser couldn't locate the id). The parser now
 * reads `data.identifier` and falls back to top-level `id` for
 * robustness against older Passcreator clients / test doubles.
 *
 * See:
 *   - https://app.passcreator.com/en/api-documentation/v2 (template mgt)
 *   - fixtures/passcreator/success-create.json (live-captured 2026-10-12)
 *   - runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md
 *     (root cause + fix trace)
 */
export interface PasscreatorTemplateResponse {
  id: string;
}

/**
 * Extract the template id from a Passcreator V2 response payload.
 *
 * Lookup order:
 *   1. `data.identifier`  ← V2 standard envelope (success)
 *   2. top-level `id`     ← legacy / test-double shape
 *
 * Returns `null` when neither path yields a non-empty string. The
 * caller (`createPassTemplate`, `updatePassTemplate`) decides
 * whether to surface this as `BadGatewayError` (create: must throw;
 * update: falls back to the requested id as an "update accepted" signal).
 *
 * We do NOT look for `id` anywhere else — Passcreator V2 docs put
 * the template id exclusively at `data.identifier`, and listening
 * to the legacy top-level shape would mask envelope-shape drift.
 */
function extractTemplateId(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // V2 envelope: read data.identifier first.
  const data = obj.data;
  if (typeof data === 'object' && data !== null) {
    const identifier = (data as Record<string, unknown>).identifier;
    if (typeof identifier === 'string' && identifier.length > 0) {
      return identifier;
    }
  }
  // Legacy / test-double: top-level id.
  const topLevel = obj.id;
  if (typeof topLevel === 'string' && topLevel.length > 0) {
    return topLevel;
  }
  return null;
}

/**
 * Per-field error entry from the Passcreator V2 error envelope.
 *
 * `property` is the field name in the request body that failed
 * validation. `message` is the human-readable reason. Passcreator
 * may include entries with non-string values (e.g. when the field
 * type was wrong) — see `passcreator.test.ts` "filters out
 * malformed error entries" for the defensive handling.
 */
export interface PasscreatorErrorEntry {
  property: string;
  message: string;
}

/**
 * Passcreator V2 error response envelope.
 *
 * Sent on any 4xx/5xx response. `success` is always `false` for
 * this envelope (success responses use `success: true`). The
 * `errors` field is ALWAYS present, but Passcreator's actual
 * server has TWO shapes:
 *
 *   1. `errors: PasscreatorErrorEntry[]` (most common —
 *      `empty-body` and `wrong-format-field` scenarios)
 *   2. `errors: PasscreatorErrorEntry` (singular object —
 *      `invalid-pass-type-id` scenario with
 *      `errors = { property: 'passTypeId', message: '...' }`)
 *
 * Both are real V2 envelopes. We detect either shape via the
 * type-guard below (`isPasscreatorErrorEnvelope`).
 *
 * Real examples captured 2026-10-11 (see `fixtures/passcreator/`):
 *   - `empty-body`:
 *       { success: false, errors: [{property: '', message: 'Array value found...'}] }
 *   - `invalid-pass-type-id` (now possible after type/colors fix):
 *       { success: false, errors: {property: 'passTypeId', message: 'unknown'} }
 *   - `wrong-format-field`:
 *       { success: false, errors: [{property: 'colors', message: '...'}] }
 */
export interface PasscreatorErrorResponse {
  success: false;
  description: string;
  errors: PasscreatorErrorEntry | PasscreatorErrorEntry[] | unknown;
  data: unknown;
  statusCode: number;
}

/**
 * Whether `parsed.errors` (whatever its shape) is structurally meaningful
 * enough to treat as a V2 envelope. Loose check: success:false + errors
 * is either an array OR a single `{property, message}-shaped` object.
 *
 * Returns the array form when `errors` is an array, the wrapped single-
 * entry form when `errors` is an object, or `null` when neither shape
 * matches (caller can fall back to `invalid_response`).
 */
type ErrorEnvelopeShape = { entry: PasscreatorErrorEntry } | { entries: PasscreatorErrorEntry[] } | null;

/**
 * Type-guard + shape normalizer for the V2 error envelope.
 *
 * Conservative: we treat the response as an error envelope when
 * `success === false` AND `errors` is an array OR a `{property,
 * message}-shaped` object. False positives are avoided by:
 *   - Success responses (which also have `success: true`) won't match.
 *   - Non-V2 error formats (e.g. 5xx with a generic `{error: '...'}`)
 *     won't have `success === false`.
 *   - Junk entries fail the inner `property`/`message` string check.
 *
 * Returns the parsed envelope PLUS the error entries as a single
 * array so the caller can iterate uniformly. When `errors` is a
 * single object it's wrapped into a 1-element array.
 */
function normalizePasscreatorErrorEntries(parsed: unknown): {
  envelope: PasscreatorErrorResponse;
  entries: PasscreatorErrorEntry[];
} | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.success !== false) return null;
  const rawErrors = obj.errors;
  let entries: PasscreatorErrorEntry[] = [];
  if (Array.isArray(rawErrors)) {
    // Detect V3 envelope shape vs V2 shape by inspecting the FIRST
    // entry:
    //   - V3 (live-captured 2026-10-17): `errors: string[]` — each
    //     entry is a plain human message, NO per-field `property`
    //     (V3 docs do not document per-field paths in error responses).
    //     We wrap each string into `{property: 'data', message: <string>}`
    //     so the frontend banner can render uniformly. 'data' is the
    //     V3 envelope's top-level key (per docs § "The following
    //     properties of the `data` object can/must be submitted in the
    //     request body") — it's the most accurate context prefix when
    //     the upstream didn't tell us which specific field failed.
    //   - V2 (live-captured 2026-10-11): `errors: {property, message}[]`
    //     — fall through to `extractUpstreamErrorsFromArray` which
    //     preserves each entry's own `property` field.
    //
    // Empty / whitespace-only strings are filtered defensively
    // (Passcreator occasionally returns `""` from intermediate proxies).
    if (rawErrors.length > 0 && typeof rawErrors[0] === 'string') {
      entries = rawErrors.flatMap((entry): PasscreatorErrorEntry[] => {
        if (typeof entry !== 'string') return [];
        const trimmed = entry.trim();
        if (trimmed.length === 0) return [];
        return [{ property: 'data', message: trimmed }];
      });
    } else {
      entries = extractUpstreamErrorsFromArray(rawErrors);
    }
  } else if (typeof rawErrors === 'object' && rawErrors !== null) {
    // single-object case (e.g. `invalid-pass-type-id`):
    //   errors: { property: 'passTypeId', message: '...' }
    const e = rawErrors as Record<string, unknown>;
    if (typeof e.property === 'string' && typeof e.message === 'string') {
      entries = [{ property: e.property, message: e.message }];
    }
  }
  return {
    envelope: parsed as PasscreatorErrorResponse,
    entries,
  };
}

function extractUpstreamErrorsFromArray(rawErrors: unknown[]): PasscreatorErrorEntry[] {
  return rawErrors.flatMap((entry): PasscreatorErrorEntry[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.property !== 'string' || typeof e.message !== 'string') return [];
    return [{ property: e.property, message: e.message }];
  });
}

/**
 * Type-guard: is the parsed body a Passcreator V2 error envelope?
 *
 * Mirrors `normalizePasscreatorErrorEntries` so we can label each
 * fixture for the summary table (in `capture-passcreator-errors.cjs`)
 * and use the same logic on the receive path.
 */
function isPasscreatorErrorEnvelope(parsed: unknown): parsed is PasscreatorErrorResponse {
  return normalizePasscreatorErrorEntries(parsed) !== null;
}

/**
 * Extract well-formed {property, message} entries from a V2 error envelope.
 *
 * Passcreator's `errors[]` may contain:
 *   - Junk entries (e.g. `null`, strings, or objects with the wrong shape)
 *     from upstream intermediaries or partial parser failures.
 *   - Entries with non-string `property` or `message` values (e.g.
 *     `{ property: 123, message: null }` when the field type is wrong).
 *
 * We keep only entries where BOTH `property` and `message` are strings.
 * The result is what the frontend banner renders as "field N: reason M".
 *
 * Handles both `errors: PasscreatorErrorEntry[]` (array) and
 * `errors: PasscreatorErrorEntry` (singular object) shapes — verified
 * 2026-10-11 against the live endpoint via the v6 capture baseline.
 */
function extractUpstreamErrors(parsed: PasscreatorErrorResponse): Array<PasscreatorErrorEntry> {
  const rawErrors = parsed.errors;
  if (Array.isArray(rawErrors)) return extractUpstreamErrorsFromArray(rawErrors);
  // Singular-object case: only one entry possible. Caller's behavior
  // is identical to a 1-element array (the frontend iterates the array).
  if (typeof rawErrors === 'object' && rawErrors !== null) {
    const e = rawErrors as Record<string, unknown>;
    if (typeof e.property === 'string' && typeof e.message === 'string') {
      return [{ property: e.property, message: e.message }];
    }
  }
  return [];
}

/**
 * Options for the fetch helpers.
 */
export interface PasscreatorEnv {
  PASSCREATOR_API_URL: string;
  PASSCREATOR_API_KEY: string;
  PASSCREATOR_PASS_TYPE_ID: string;
}

/**
 * Read Passcreator env from a Hono `c.env` or Cloudflare bindings.
 *
 * We accept a `Record<string, unknown>` so this module stays decoupled
 * from the Hono `HonoEnv` type (which is bound to specific binding
 * names). Service modules cast their own `c.env` to `PasscreatorEnv`.
 */
function requireEnv(env: unknown): PasscreatorEnv {
  const e = (env ?? {}) as Partial<PasscreatorEnv>;
  if (!e.PASSCREATOR_API_URL) {
    throw new Error('[passcreator] PASSCREATOR_API_URL is not set');
  }
  if (!e.PASSCREATOR_API_KEY) {
    throw new Error('[passcreator] PASSCREATOR_API_KEY is not set');
  }
  if (!e.PASSCREATOR_PASS_TYPE_ID) {
    throw new Error('[passcreator] PASSCREATOR_PASS_TYPE_ID is not set');
  }
  return {
    PASSCREATOR_API_URL: e.PASSCREATOR_API_URL,
    PASSCREATOR_API_KEY: e.PASSCREATOR_API_KEY,
    PASSCREATOR_PASS_TYPE_ID: e.PASSCREATOR_PASS_TYPE_ID,
  };
}

/**
 * Internal: do a JSON request to Passcreator and parse the response.
 *
 * Throws `BadGatewayError` on:
 *   - non-2xx response
 *   - timeout
 *   - network failure (DNS, connection refused, etc.)
 *   - non-JSON response (truncated to 500 chars in the error)
 *
 * Note: Cloudflare Workers' `fetch` is built-in and supports `AbortSignal.timeout(ms)`.
 * We use a 15-second timeout — long enough for slow responses, short enough
 * to avoid the 30-second CPU limit when a series of upserts stack.
 */
async function passcreatorFetch(
  env: PasscreatorEnv,
  path: string,
  init: { method: 'GET' | 'POST' | 'PUT'; body?: unknown; signal?: AbortSignal },
): Promise<unknown> {
  const url = `${env.PASSCREATOR_API_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    // V2 scheme: raw API key, no Bearer prefix. With `Bearer` prefix
    // Passcreator returns a silent 401 with empty body (saw 2026-10-11
    // against the real endpoint — `WWW-Authenticate: APIKey` header
    // hints at the raw-value convention; their docs also use bare
    // `Authorization: yourApiKeyHere` in every curl example).
    Authorization: env.PASSCREATOR_API_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
  } catch (err) {
    // Network-level failure (DNS, TLS, timeout, connection reset).
    // Wrap as BadGatewayError with `kind: 'network'` so the frontend
    // banner can tell the user "check your internet connection" rather
    // than the generic "sync failed" copy. The request never reached
    // the upstream — no upstreamStatus to surface.
    const message = err instanceof Error ? err.message : String(err);
    throw new BadGatewayError({
      upstream: 'passcreator',
      kind: 'network',
      upstreamBody: `network error: ${message}`,
    });
  }

  // Read the body once (Response.body can only be consumed once).
  const rawBody = await response.text();
  // Passcreator sometimes returns an empty 200/201 with no body — treat
  // as success and let the caller decode the response shape.
  let parsed: unknown = null;
  if (rawBody.length > 0) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      // Non-JSON response. This is typically a CDN/edge error (e.g.
      // Cloudflare 530 "Origin DNS error" / code 1016 — the CDN can't
      // reach the Passcreator origin). Mark as `kind: 'invalid_response'`
      // so the banner surfaces "service temporarily unavailable" instead
      // of the misleading "check your network connection".
      throw new BadGatewayError({
        upstream: 'passcreator',
        kind: 'invalid_response',
        upstreamStatus: response.status,
        upstreamBody: `non-JSON response: ${rawBody.slice(0, 200)}`,
      });
    }
  }

  if (!response.ok) {
    // Detect Passcreator V2's structured error envelope and pull
    // out the per-field `errors[]` (or single `errors` object — Passcreator
    // uses both shapes) for the frontend banner. We only attach
    // `upstreamErrors` when at least one valid entry exists; an empty
    // `errors` or a non-V2 envelope falls back to the raw `upstreamBody`
    // JSON in the details.
    //
    // `kind: 'upstream_rejected'` is set whenever the body is a V2
    // envelope — regardless of whether `upstreamErrors` is populated.
    // The frontend banner uses this to pick the "Passcreator rejected
    // the data" copy.
    //
    // We use `if/else` (not a ternary on a const boolean) so the
    // type-guard result's narrowing is preserved.
    const normalized = normalizePasscreatorErrorEntries(parsed);
    if (normalized !== null) {
      throw new BadGatewayError({
        upstream: 'passcreator',
        kind: 'upstream_rejected',
        upstreamStatus: response.status,
        upstreamBody:
          typeof parsed === 'object' && parsed !== null
            ? JSON.stringify(parsed)
            : rawBody,
        ...(normalized.entries.length > 0 ? { upstreamErrors: normalized.entries } : {}),
      });
    }
    // Body is not a V2 envelope (HTML login page, empty body, raw text,
    // or a non-V2 `{error: '...'}` shape). Surface as
    // `invalid_response` so the banner says "service temporarily
    // unavailable" instead of the misleading "Passcreator rejected the
    // data" copy.
    throw new BadGatewayError({
      upstream: 'passcreator',
      kind: 'invalid_response',
      upstreamStatus: response.status,
      upstreamBody:
        typeof parsed === 'object' && parsed !== null
          ? JSON.stringify(parsed)
          : rawBody,
    });
  }

  return parsed;
}

/**
 * Create a new Passcreator template.
 *
 * Returns the upstream `id` (UUID). The caller persists this to
 * `templates.passcreator_template_id` for subsequent `updatePassTemplate`
 * calls.
 *
 * @throws {BadGatewayError} on any non-2xx response, timeout, or network failure.
 */
export async function createPassTemplate(
  env: unknown,
  body: PasscreatorTemplateBody,
): Promise<PasscreatorTemplateResponse> {
  const e = requireEnv(env);
  // Passcreator V2 endpoint for create-template. Confirmed via the API
  // docs (2026-10-11). The base host is `https://app.passcreator.com`
  // (NOT `api.passcreator.com` — that subdomain does not resolve;
  // the V1/V2/V3 API docs all use `app.passcreator.com`). The path
  // is `/api/v2/pass-template` (singular, hyphenated — V1 used
  // `/api/pass` and V2 docs use the singular form consistently). If
  // this URL changes in a future Passcreator release, only this
  // function needs to update.
  const result = await passcreatorFetch(e, '/api/v2/pass-template', {
    method: 'POST',
    body,
  });
  // V2 envelope puts the new template id at `data.identifier`. Read
  // it through the shared extractor (also handles legacy top-level
  // `id` for compatibility with test doubles / older responses). If
  // neither path yields a non-empty string, surface the full body in
  // the BadGatewayError so the operator can see what Passcreator sent
  // — empty `data`, unexpected nesting, or a 2xx error envelope are
  // all signposted this way.
  const id = extractTemplateId(result);
  if (id === null) {
    throw new BadGatewayError({
      upstream: 'passcreator',
      upstreamBody: `create response missing id (expected data.identifier): ${JSON.stringify(result)}`,
    });
  }
  return { id };
}

/**
 * Update an existing Passcreator template by id.
 *
 * V2 endpoint: `POST /api/v2/pass-template/{identifier}` — **not PUT**.
 *
 * Per the canonical V2 docs (update-a-template.md, 2026-10-11):
 *   > POST /api/v2/pass-template/{identifier}
 *   > Update an existing pass template.
 *
 * Passcreator V2 standardized ALL mutating endpoints on POST (different
 * paths distinguish create vs update). Earlier V1 used
 * `PUT /api/pass-template/[id]` — mixing V1's PUT convention with V2's
 * path produces a 404 + nginx HTML page (the route doesn't exist for
 * PUT), which we surfaced on 2026-10-12 production push as
 * "Passcreator sync failed" with kind:'invalid_response'.
 *
 * The conformance test below (`uses POST method (V2 endpoint
 * convention)`) pins this behavior so future refactors don't drift
 * back to the V1 PUT convention.
 *
 * Idempotent: a no-op update (same body) returns 200 with the existing
 * record. POST here is per Passcreator's design — not from REST
 * semantics — and re-submitting the same body is documented as safe.
 *
 * @throws {BadGatewayError} on any non-2xx response, timeout, or network failure.
 */
export async function updatePassTemplate(
  env: unknown,
  passcreatorTemplateId: string,
  body: PasscreatorTemplateBody,
): Promise<PasscreatorTemplateResponse> {
  const e = requireEnv(env);
  const result = await passcreatorFetch(
    e,
    `/api/v2/pass-template/${encodeURIComponent(passcreatorTemplateId)}`,
    { method: 'POST', body },
  );
  // Same V2 envelope as create: id lives at `data.identifier`. If the
  // extractor doesn't find a usable id, treat the update as accepted —
  // we already issued the request with the explicit id, so it is
  // the source of truth. This covers two legitimate cases:
  //   - 204 No Content (empty body → `result === null`)
  //   - 2xx body that omits `data.identifier` (observed in the wild;
  //     some Passcreator envelope shapes on the update verb lack the
  //     id slot)
  // Falling back to the requested id keeps the sync idempotent and
  // matches the prior behavior. We only `throw` when the request
  // fails upstream (handled by `passcreatorFetch` itself), not when
  // the response envelope is simply id-less.
  const extracted = extractTemplateId(result);
  if (extracted !== null) {
    return { id: extracted };
  }
  return { id: passcreatorTemplateId };
}

/**
 * Fetch a Passcreator template by id.
 *
 * Used by the test suite (and potentially by future "view upstream"
 * debugging tools). NOT used in the Step 8 hot path — the sync
 * service reads the cached body from the local DB row.
 *
 * @throws {BadGatewayError} on any non-2xx response, timeout, or network failure.
 * 404 from Passcreator is propagated as BadGatewayError with
 * upstreamStatus=404 (we don't surface "template not found upstream"
 * as a 404 to the SAOME client — the user-facing semantics are
 * "Passcreator rejected our request", which maps to 502).
 */
export async function fetchPassTemplate(
  env: unknown,
  passcreatorTemplateId: string,
): Promise<unknown> {
  const e = requireEnv(env);
  return passcreatorFetch(
    e,
    `/api/v2/pass-template/${encodeURIComponent(passcreatorTemplateId)}`,
    { method: 'GET' },
  );
}

// ============================================================================
// 2026-10-19 — Passcreator V3 per-pass issuance (`POST /api/v3/pass`)
// ============================================================================
//
// After a public visitor registers as a Pass Holder, SAOME must immediately
// invoke Passcreator V3 to issue the actual wallet pass (Apple Wallet /
// Passwallet .pkpass). V3 is a per-pass runtime endpoint — distinct from
// the V2 template-management endpoint that this module already wraps
// (createPassTemplate / updatePassTemplate / fetchPassTemplate).
//
// V3 contract (per https://developer.passcreator.com/en/api/v3/pass):
//   - Method/Path: POST /api/v3/pass
//   - Body:
//       {
//         "templateId": "<passcreator-template-uuid>",
//         "additionalPropertyValues": {
//           "<key>": "<value>",   // arbitrary keys, all go through here
//         }
//       }
//   - Response (2xx success):
//       {
//         "success": true,
//         "description": "...",
//         "errors": [],
//         "data": {
//           "identifier":      "<per-pass UUID>",
//           "templateId":      "<passcreator-template-uuid>",
//           "linkToPassPage":  "https://app.passcreator.com/en/p/<...>",
//           "barcodeValue":    "<string|null>",
//           "autoGeneratedId": "<...>",
//           "firstDownloadedAt": null,
//           "expirationDate":  "<...>"
//         },
//         "statusCode": 201,
//       }
//
// Per the user-confirmed design (plan mode q1), V3 does NOT distinguish
// between primary / secondary fields — every holder field is pushed into
// the single `additionalPropertyValues` object and Passcreator routes the
// values into the appropriate V2 placeholders based on the template's
// configuration. SAOME pushes 4 keys:
//   - name      (the holder's display name shown on the pass header)
//   - phone     (E.164-formatted: country code + number, no '+' duplicate)
//   - birthday  (YYYY-MM-DD)
//   - email     (used by Apple/Google Wallet to deliver the pass link)
//
// The wrapper below normalizes the V3 response into a 3-tuple the
// registerService can persist directly. On any failure path the V3
// envelope is caught by passcreatorFetch's existing logic — we re-use
// the same BadGatewayError envelope so the service layer handles one
// error type across both V2 and V3 surfaces.

/**
 * Per-pass issuance holder payload.
 *
 * Mirrors `packages/shared/types/passHolder.ts::PassHolderPayload`
 * (the source of truth — Rule 019 § 4.1 Layer 1). Only the four
 * fields V3 needs are typed here; tier / payment metadata is
 * persisted on the SAOME side but never sent upstream.
 */
export interface PassIssueHolderData {
  /**
   * Holder name shown on the pass.
   *
   * Mapped to `data.memberName` on the V3 wire (NOT `data.name`) —
   * the SAOME template mapping emits `memberName` as
   * `primaryFields[0].key` for `membership_card` and as the
   * `additionalProperties[]` entry for any cardType that has a
   * membership-style field slot. Passcreator resolves the
   * `{memberName}` placeholder against this body field name, so
   * sending `name` here would leave `memberName:` empty in the
   * rendered pass.
   *
   * See `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts::primaryFields`
   * (v12-followup, 2026-10-12) and the v3-fix-2026-10-19
   * conformance tests in `passcreator.test.ts`.
   */
  name: string;
  /** E.164 phone number: country code + digits (e.g. `+886912345678`). */
  phone: string;
  /** ISO birthday YYYY-MM-DD (already validated ≥ 13 years). */
  birthday: string;
  /** Email used by Apple/Google Wallet to deliver the pass link. */
  email: string;
}

/**
 * V3 per-pass runtime artifact — the normalized response shape.
 *
 * Layer 2 of 4 per Rule 019 § 4.1 (mirrors the Layer 1
 * `PassHolderIssuanceDto` in `shared/contracts/passTemplates.ts`):
 *
 * Real V3 response shape (verified against
 * https://developer.passcreator.com/en/api/v3/pass § "Create a Pass" →
 * "Returned values", captured 2026-10-19):
 *   data: {
 *     identifier:      "<per-pass UUID>",                    // ← per-pass id
 *     downloadPage:    "https://app.passcreator.com/p/<id>",// ← universal landing page
 *                                                               //    (device-sniffs Apple vs Google)
 *     iPhoneUri:       "https://app.passcreator.com/<file>.pkpass", // ← direct .pkpass link
 *     androidUri:      "https://pay.google.com/save/<...>",// ← Google Wallet deeplink
 *     barcodeValue:    "<string>",                          // ← per-pass barcode payload
 *     bundleId:        "<string|null>",
 *     genericProperties: { ... },
 *   }
 *
 * V1 used `linkToPassPage` (a single universal link). V3 splits it
 * into `downloadPage` (universal landing page with device sniffing),
 * `iPhoneUri` (direct .pkpass for Apple Wallet / Passwallet), and
 * `androidUri` (Google Pay / Passwallet deeplink). The frontend uses
 * user-agent detection to pick which URL to surface as the download CTA.
 *
 * `firstDownloadedAt` / `expirationDate` are NOT surfaced today —
 * retention / expiry tracking is a separate subsystem.
 */
export interface PassIssueResponse {
  /** Per-pass UUID issued by Passcreator. */
  identifier: string;
  /**
   * Universal landing page URL (Apple Safari → redirects to Wallet;
   * Android Chrome → opens Google Wallet).
   * Source: V3 `data.downloadPage`.
   */
  downloadPage: string;
  /**
   * Direct .pkpass link for Apple Wallet / Passwallet. Frontend can
   * surface this as the "Add to Apple Wallet" CTA on Apple devices.
   * Source: V3 `data.iPhoneUri`.
   */
  iPhoneUri: string;
  /**
   * Direct Google Pay / Passwallet deeplink. Frontend can surface
   * this as the "Save to Android" CTA on Android devices.
   * Source: V3 `data.androidUri`.
   */
  androidUri: string;
  /**
   * Barcode payload rendered on the pass (string or null when no
   * barcode configured). Source: V3 `data.barcodeValue`.
   */
  barcodeValue: string | null;
}

/**
 * Placeholder strings Passcreator returns in `data.barcodeValue`
 * when a template has NO barcode configured. Live V3 capture
 * (2026-10-17, runs/improvements/feedback/20261018-passcreator-v3-capture.md)
 * confirmed at least 2 of these in the wild:
 *
 *   - "no value specified"  — V3 CREATE response (Q2 root cause:
 *                             production `pass_holders.barcode_value`
 *                             was literally this string instead of NULL)
 *   - "no value given"      — V3 LIST response (per item, no barcode)
 *
 * Two more are observed in Passcreator error messages / docs:
 *
 *   - "no barcode"
 *   - "" (empty string)
 *
 * Any of these in `data.barcodeValue` is normalized to `null` by
 * `normalizeBarcodeValue()` so the SAOME DB stores `barcode_value =
 * NULL` instead of a Passcreator-internal sentinel value as if it
 * were a real barcode. If Passcreator introduces a NEW placeholder
 * string in a future release, add it here AND extend the conformance
 * tests in `passcreator.test.ts > "barcodeValue defensive normalize"`.
 */
const BARCODE_VALUE_PLACEHOLDERS: ReadonlySet<string> = new Set([
  'no value given',
  'no value specified',
  'no barcode',
  '',
]);

/**
 * Normalize Passcreator's `barcodeValue` to either a real string or
 * `null`. Passcreator sends LITERAL placeholder strings ("no value
 * specified" / "no value given" / "no barcode" / "") when a template
 * has no barcode configured — those are not real barcodes and must
 * NOT be persisted as the per-pass barcode payload.
 *
 * Returns `null` for:
 *   - Any of the 4 `BARCODE_VALUE_PLACEHOLDERS` strings (case-sensitive
 *     exact match — Passcreator uses lowercase consistently).
 *   - Non-string input (defensive — V3 docs § Returned values says
 *     `barcodeValue` can be a string OR null; we accept null too).
 *
 * Returns the original string verbatim when it's a real barcode
 * (numeric strings like "3897897988979823497234").
 *
 * Used by BOTH branches of `extractPassIssueData` (V3 envelope +
 * legacy / test-double flat shape).
 */
function normalizeBarcodeValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return BARCODE_VALUE_PLACEHOLDERS.has(raw) ? null : raw;
}

/**
 * Extract the per-pass issuance fields from a Passcreator V3 envelope.
 *
 * V3 response shape (success path, per docs § Returned values +
 * live capture 2026-10-19):
 *   {
 *     success: true,
 *     description: "Pass has been created.",
 *     errors: [],
 *     data: {
 *       identifier:      "abcdefeg-0dc5-447b-ac08-eff6462d883e",
 *       templateId:      "...",
 *       downloadPage:    "https://app.passcreator.com/p/...",
 *       iPhoneUri:       "https://app.passcreator.com/...pkpass",
 *       androidUri:      "https://pay.google.com/save/...",
 *       barcodeValue:    "3897897988979823497234" | "no value specified" | null,
 *       bundleId:        null,
 *       genericProperties: { ... }
 *     },
 *     statusCode: 200,
 *     count: 1
 *   }
 *
 * Per the 2026-10-17 live capture, `barcodeValue` is one of:
 *   - a real numeric string (when the template HAS a barcode)
 *   - "no value specified" / "no value given" (V3 sentinel placeholders
 *     when no barcode is configured — see `BARCODE_VALUE_PLACEHOLDERS`)
 *   - null (V3 docs § Returned values allow this; also the ?async=true
 *     behavior returns null even when the template HAS a barcode)
 *
 * The parser collapses both sentinel strings AND null to `null` via
 * `normalizeBarcodeValue()` (Q2 root-cause fix — production data
 * was previously storing the literal "no value specified" string).
 *
 * We accept BOTH the documented envelope shape AND the legacy / test-double
 * flat shape (where the per-pass fields sit at the top level). This
 * matches the same defensive pattern used in `extractTemplateId()` above.
 */
function extractPassIssueData(parsed: unknown): PassIssueResponse | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // Preferred path: V3 envelope puts the per-pass runtime fields at
  // `data.{identifier, downloadPage, iPhoneUri, androidUri, barcodeValue}`.
  // The field is `downloadPage` (NOT `linkToPassPage` — that's V1's
  // single-link shape; V3 splits it into 3 URLs).
  const data = obj.data;
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (
      typeof d.identifier === 'string' &&
      typeof d.downloadPage === 'string' &&
      typeof d.iPhoneUri === 'string' &&
      typeof d.androidUri === 'string'
    ) {
      return {
        identifier: d.identifier,
        downloadPage: d.downloadPage,
        iPhoneUri: d.iPhoneUri,
        androidUri: d.androidUri,
        // Defensive normalize: collapse Passcreator's placeholder
        // strings ("no value specified" / "no value given" / "no
        // barcode" / "") AND `null` AND any non-string to `null`.
        // Real barcode values (numeric strings) pass through unchanged.
        barcodeValue: normalizeBarcodeValue(d.barcodeValue),
      };
    }
  }

  // Fallback: legacy / test-double flat shape. Accepts the V1
  // `linkToPassPage` shape AND the V3 `downloadPage` shape so the
  // wrapper keeps working with mocks / older fixtures.
  const legacyLink =
    (typeof obj.linkToPassPage === 'string' && obj.linkToPassPage) ||
    (typeof obj.downloadPage === 'string' && obj.downloadPage) ||
    null;
  if (typeof obj.identifier === 'string' && legacyLink !== null) {
    return {
      identifier: obj.identifier,
      downloadPage: legacyLink,
      // V3 split these into 2 URIs; legacy flat shape only has one.
      // We fall back to the same URL for both — frontend's user-agent
      // detection still works (Apple users go to downloadPage which
      // redirects to Wallet; Android users hit the same URL).
      iPhoneUri: legacyLink,
      androidUri: legacyLink,
      // Same defensive normalize applies to the legacy flat shape.
      barcodeValue: normalizeBarcodeValue(obj.barcodeValue),
    };
  }
  return null;
}

/**
 * Issue a per-pass wallet card via Passcreator V3.
 *
 * Invoked by `registerService` immediately after persisting a new
 * `pass_holders` row (or skipping for an existing row whose
 * `pass_identifier` is already populated — see Decision Log
 * § "Issue pass relation"). The returned object is the source of
 * truth for the row's V3 runtime columns.
 *
 * V3 contract (verified against
 * https://developer.passcreator.com/en/api/v3/pass § "Create a Pass",
 * captured 2026-10-19):
 *
 *   - URL:        POST https://app.passcreator.com/api/v3/pass?async=false
 *   - `async=false` URL param is REQUIRED — Passcreator defaults to
 *     `async=true`, which causes the V3 response to return success
 *     with `data.barcodeValue === null` even when the template has a
 *     barcode configured. The docs explicitly call this out:
 *       "If you need to see the actual barcodeValue in the JSON
 *        response body, you need to set async to false. Otherwise
 *        the system will not know it when the response is generated."
 *   - Body:        `{ data: { templateId, name, phone, birthday, email } }`
 *     The body MUST wrap all fields inside a `data` object. Additional
 *     template properties (like the 4 holder fields) go DIRECTLY
 *     inside `data` — NOT under an `additionalPropertyValues` wrapper
 *     (that field name does not exist on V3 create; V1 used it for
 *     the `passtemplate` URL param + zapierStyle=true approach).
 *   - Response:   `{ success, data: { identifier, downloadPage,
 *                    iPhoneUri, androidUri, barcodeValue, ... }, ... }`
 *
 * The function reuses the existing `passcreatorFetch` helper so the
 * 3-layer error envelope is identical to V2 surface:
 *   - network failure       → BadGatewayError kind='network'
 *   - 2xx non-JSON body     → BadGatewayError kind='invalid_response'
 *   - V2 error envelope     → BadGatewayError kind='upstream_rejected'
 *
 * @throws {BadGatewayError} when Passcreator returns an error, times
 *         out, or fails network. The error's `details.upstreamErrors`
 *         carries per-field reasons when the upstream envelope is
 *         parsed successfully (frontend banner can render "field N: reason M").
 *
 * @see runs/decisions/2026-10-19-pass-holder-v3-issuance.md
 * @see runs/improvements/feedback/20261019-pass-holder-v3-issuance-v3-contract-fix.md
 */
export async function issuePass(
  env: unknown,
  passcreatorTemplateId: string,
  holder: PassIssueHolderData,
): Promise<PassIssueResponse> {
  const e = requireEnv(env);

  const result = await passcreatorFetch(e, '/api/v3/pass?async=false', {
    method: 'POST',
    body: {
      // V3 contract: every request body field lives inside a top-level
      // `data` object (docs § "The following properties of the `data`
      // object can/must be submitted in the request body").
      data: {
        templateId: passcreatorTemplateId,
        // 4 holder fields go DIRECTLY inside `data` — V3 does NOT
        // distinguish primary/secondary per template; Passcreator
        // routes the values to the V2 placeholder addresses defined
        // on the template's `additionalProperties[]` (or, for
        // membership-style templates, the `primaryFields[0].key`
        // configured as `memberName` by
        // `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts`
        // — v12-followup, 2026-10-12).
        //
        // v3-fix-2026-10-19: the SAOME template mapping emits
        // `memberName` as `primaryFields[0].key` for `membership_card`
        // (and as the `additionalProperties[]` entry for any
        // cardType that has a membership-style field slot). The
        // `{memberName}` placeholder in the template resolves
        // against THIS body field name — sending `name` previously
        // left `memberName:` empty in Passcreator's dashboard
        // because Passcreator couldn't match the body field to the
        // configured placeholder key. See
        // `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts::primaryFields`.
        memberName: holder.name,
        phone: holder.phone,
        birthday: holder.birthday,
        email: holder.email,
      },
    },
  });

  const parsed = extractPassIssueData(result);
  if (parsed === null) {
    throw new BadGatewayError({
      upstream: 'passcreator',
      upstreamBody: `issue response missing identifier+downloadPage (expected data.identifier+data.downloadPage per https://developer.passcreator.com/en/api/v3/pass): ${JSON.stringify(result)}`,
    });
  }
  return parsed;
}

/**
 * Backfill response shape for a single per-pass wallet pass.
 *
 * Returned by `getPassByIdentifier` and (per array entry) by
 * `listPasses`. The 5 fields mirror the `PassIssueResponse` shape
 * so the registerService can persist them via the same UPDATE path
 * as the create-flow (`updatePassHolderIssuance`).
 *
 * `barcodeValue` semantics differ from the create-flow:
 *   - `issuePass` returns `barcodeValue` verbatim from V3 (often a
 *     placeholder like "no value specified" → normalized to null).
 *   - `getPassByIdentifier` / `listPasses` go one level deeper: when
 *     `barcodeValue` is a placeholder OR absent, the helper falls
 *     back to `generatedId` (single-pass GET) or `autoGeneratedId`
 *     (LIST). For templates with `useAutoIdForValue=true`, this
 *     field IS the real per-pass barcode rendered on the wallet
 *     pass. See `extractBackfillBarcodeValue` for the unified
 *     extraction logic.
 *
 * `downloadPage` (single-pass GET and LIST both return the V1
 * field name `linkToPassPage` rather than V3-create's `downloadPage`)
 * is mapped to `downloadPage` here for consistency with
 * `PassIssueResponse`. The frontend uses `pickDownloadUri()` to
 * pick the right URI based on user-agent.
 */
export interface PassBackfillResponse {
  /** Per-pass UUID — matches `data.identifier`. */
  identifier: string;
  /**
   * Universal landing page URL. Source: V3 single-pass GET
   * `data.linkToPassPage` / V3 LIST `data[].linkToPassPage`. Both
   * endpoints use the V1 field name (NOT V3-create's
   * `downloadPage`).
   */
  downloadPage: string;
  /** iPhoneUri (Apple Wallet / Passwallet). May be null on single-pass GET. */
  iPhoneUri: string | null;
  /** androidUri (Google Pay / Passwallet). May be null on single-pass GET. */
  androidUri: string | null;
  /**
   * Real per-pass barcode payload. Returns `null` for templates
   * without a barcode config. For templates with
   * `useAutoIdForValue=true`, this is the `generatedId` /
   * `autoGeneratedId` (Passcreator's auto-generated ID).
   */
  barcodeValue: string | null;
}

/**
 * Unify Passcreator's 2-tier barcode extraction logic.
 *
 * For `useAutoIdForValue=true` templates, Passcreator splits the
 * barcode data across two fields:
 *   - `data.barcodeValue` — often a literal placeholder string
 *     ("no value specified" / "no value given" / "no barcode" / "")
 *     or absent entirely. NEVER the real value for auto-gen templates.
 *   - `data.generatedId` (single-pass GET, SINGULAR)
 *     `data.autoGeneratedId` (LIST, PLURAL)
 *     — Passcreator's auto-generated ID, which IS the per-pass
 *     barcode rendered on the wallet pass.
 *
 * This helper accepts BOTH field-name variants and the two-tier
 * data layout, collapsing to:
 *   - Real barcode string when EITHER `barcodeValue` (post-normalize)
 *     OR the auto-gen ID field is a non-empty, non-placeholder string.
 *   - `null` when ALL three fields are placeholders / absent.
 *
 * @param barcodeValue - the value at `data.barcodeValue` (may be absent / placeholder)
 * @param autoGenId    - the value at `data.generatedId` OR
 *                       `data.autoGeneratedId` (may be absent)
 * @returns            - the real barcode OR `null`
 *
 * 2026-10-18 — P0 #4 barcode backfill. Production was persisting
 * `barcode_value = NULL` when the real value was sitting right
 * there in Passcreator's auto-gen fields. This helper is the
 * single source of truth for the backfill normalization.
 */
function extractBackfillBarcodeValue(
  barcodeValue: unknown,
  autoGenId: unknown,
): string | null {
  // Tier 1: barcodeValue (post-placeholder-normalize)
  const fromBarcode = normalizeBarcodeValue(barcodeValue);
  if (fromBarcode !== null) return fromBarcode;

  // Tier 2: auto-generated ID (single-pass GET `generatedId` /
  // LIST `autoGeneratedId`). Passcreator's auto-gen IDs are
  // alphanumeric strings like "zbood1tvxrvl31kv9e6ad3ef2f71561"
  // — no placeholder variants observed in the 2026-10-18 capture,
  // but apply the same defensive normalize in case a future
  // Passcreator release introduces one.
  const fromAutoGen = normalizeBarcodeValue(autoGenId);
  return fromAutoGen;
}

/**
 * Extract a backfill response from a V3 single-pass GET envelope.
 *
 * Single-pass GET envelope shape (live-captured 2026-10-18, see
 * `fixtures/passcreator/v3/v3-get-single.json`):
 *   {
 *     success: true,
 *     data: {
 *       identifier:      "5615a280-...",
 *       generatedId:     "zbood1tvxrvl31kv9e6ad3ef2f71561",  ← real barcode
 *       linkToPassPage:  "https://app.passcreator.com/en/p/...",
 *       // barcodeValue field is ABSENT for useAutoIdForValue=true templates
 *       // (NOT a placeholder string — Passcreator omits the field entirely)
 *       // ... plus many other fields irrelevant to backfill ...
 *     }
 *   }
 *
 * Returns `null` when `data.identifier` is missing — caller
 * surfaces as `BadGatewayError` so the registration flow can
 * gracefully skip backfill (the holder row keeps `barcode_value =
 * NULL` and the user can retry later).
 *
 * We deliberately accept MULTIPLE field-name variants for the
 * auto-gen ID:
 *   - `data.generatedId` (SINGULAR — V3 single-pass GET uses this)
 *   - `data.autoGeneratedId` (PLURAL — V3 LIST uses this; we accept
 *     it here too in case Passcreator normalizes the field name in
 *     a future release)
 *
 * `downloadPage` is mapped from `linkToPassPage` (the field name
 * V3 single-pass GET uses). V3-create's `downloadPage` field is
 * NOT present here — that field is exclusive to the create verb.
 */
function extractPassBackfillData(parsed: unknown): PassBackfillResponse | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // Preferred path: V3 envelope puts the per-pass runtime fields
  // at `data.{identifier, linkToPassPage, generatedId}`.
  const data = obj.data;
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (typeof d.identifier === 'string' && typeof d.linkToPassPage === 'string') {
      // The auto-gen field name differs between single-pass GET
      // (`generatedId`, SINGULAR) and LIST (`autoGeneratedId`,
      // PLURAL). Accept both names; prefer the singular form when
      // both are present.
      const autoGenId = d.generatedId ?? d.autoGeneratedId;
      return {
        identifier: d.identifier,
        downloadPage: d.linkToPassPage,
        // iPhoneUri / androidUri may be absent on single-pass GET
        // (live capture didn't include them). Pass through null
        // when absent — the caller already has these from the
        // create-flow, so they're not strictly needed for backfill.
        iPhoneUri: typeof d.iPhoneUri === 'string' ? d.iPhoneUri : null,
        androidUri: typeof d.androidUri === 'string' ? d.androidUri : null,
        // Two-tier extraction: barcodeValue first (post-normalize),
        // then auto-gen ID. Returns null when both are missing.
        barcodeValue: extractBackfillBarcodeValue(d.barcodeValue, autoGenId),
      };
    }
  }

  // Fallback: legacy / test-double flat shape. Some fixtures put
  // identifier + linkToPassPage at top level (no `data` wrapper).
  // Accept this for robustness against older mocks.
  if (
    typeof obj.identifier === 'string' &&
    typeof obj.linkToPassPage === 'string'
  ) {
    const autoGenId = obj.generatedId ?? obj.autoGeneratedId;
    return {
      identifier: obj.identifier,
      downloadPage: obj.linkToPassPage,
      iPhoneUri: typeof obj.iPhoneUri === 'string' ? obj.iPhoneUri : null,
      androidUri: typeof obj.androidUri === 'string' ? obj.androidUri : null,
      barcodeValue: extractBackfillBarcodeValue(obj.barcodeValue, autoGenId),
    };
  }
  return null;
}

/**
 * Fetch a single per-pass wallet pass by its V3 identifier.
 *
 * PRIMARY backfill path for the barcodeValue=NULL drift
 * (production bug 2026-10-18). When `issuePass` returns
 * `barcodeValue: null` (because Passcreator's V3 CREATE response
 * returns a placeholder string for `useAutoIdForValue=true`
 * templates), the registerService calls this helper to fetch the
 * real auto-generated barcode from `data.generatedId`.
 *
 * V3 endpoint:
 *   GET https://app.passcreator.com/api/v3/pass/{identifier}
 *
 * Response shape (live-captured 2026-10-18 against the ILJOI
 * holder, see `fixtures/passcreator/v3/v3-get-single.json`):
 *   {
 *     success: true,
 *     data: {
 *       identifier:      "<UUID>",
 *       generatedId:     "<real barcode for auto-gen templates>",
 *       linkToPassPage:  "<universal landing page>",
 *       // barcodeValue field is absent (NOT a placeholder)
 *     }
 *   }
 *
 * The function reuses `passcreatorFetch` so the 3-layer error
 * envelope is identical to V2 surface and the existing `issuePass`
 * behavior:
 *   - network failure       → BadGatewayError kind='network'
 *   - 2xx non-JSON body     → BadGatewayError kind='invalid_response'
 *   - V2 error envelope     → BadGatewayError kind='upstream_rejected'
 *
 * @throws {BadGatewayError} when Passcreator returns an error,
 *         times out, or fails network. The error's
 *         `details.upstreamBody` carries the raw response body
 *         so operators can diagnose envelope-shape drift without
 *         re-running the probe.
 *
 * @see runs/improvements/feedback/20261018-passcreator-v3-barcode-backfill.md
 */
export async function getPassByIdentifier(
  env: unknown,
  identifier: string,
): Promise<PassBackfillResponse> {
  const e = requireEnv(env);

  const result = await passcreatorFetch(
    e,
    `/api/v3/pass/${encodeURIComponent(identifier)}`,
    { method: 'GET' },
  );

  const parsed = extractPassBackfillData(result);
  if (parsed === null) {
    throw new BadGatewayError({
      upstream: 'passcreator',
      upstreamBody: `single-pass GET response missing identifier+linkToPassPage (expected data.identifier+data.linkToPassPage per https://developer.passcreator.com/en/api/v3/pass): ${JSON.stringify(result)}`,
    });
  }
  return parsed;
}

/**
 * List per-pass wallet passes for a template, filtered by identifier.
 *
 * FALLBACK backfill path. Used when `getPassByIdentifier` is
 * unavailable (network race, Passcreator contract drift, etc.).
 * Returns the matched pass(es) filtered by `identifier` — for the
 * backfill use case, the caller passes the just-issued identifier
 * and gets back a 0-or-1-element array.
 *
 * V3 endpoint:
 *   GET https://app.passcreator.com/api/v3/pass?templateId=...&identifier=...
 *
 * Response shape (live-captured 2026-10-18 against the ILJOI
 * holder, see `fixtures/passcreator/v3/v3-list-filtered.json`):
 *   {
 *     success: true,
 *     count: 100,
 *     page: { next: "<cursor URL>" },
 *     data: [
 *       {
 *         identifier:      "<UUID>",
 *         autoGeneratedId: "<real barcode for auto-gen templates>",
 *         linkToPassPage:  "<universal landing page>",
 *         barcodeValue:    "no value given",   // placeholder (NOT real)
 *         // ... many other fields ...
 *       },
 *       // ... more passes (paginated) ...
 *     ]
 *   }
 *
 * Important: Passcreator's V3 LIST response uses `autoGeneratedId`
 * (PLURAL), distinct from the single-pass GET's `generatedId`
 * (SINGULAR). The `extractBackfillBarcodeValue` helper accepts
 * both field names so the two-tier barcode extraction works
 * uniformly across endpoints.
 *
 * Pagination: this helper reads page 1 only. For Passcreator
 * accounts with >100 passes, the target identifier may be on
 * page 2+. The backfill caller treats "not on page 1" as
 * "barcode_value stays null" — registration still succeeds
 * because barcode is best-effort.
 *
 * @returns - array of matching passes (0 or 1 element for the
 *           backfill use case where `identifier` is exact).
 *           Returns `[]` when the identifier isn't on page 1.
 *
 * @throws {BadGatewayError} on network / upstream_rejected /
 *         invalid_response, identical envelope to
 *         `getPassByIdentifier`.
 */
export async function listPasses(
  env: unknown,
  options: { templateId: string; identifier?: string },
): Promise<PassBackfillResponse[]> {
  const e = requireEnv(env);

  // Build the query string. Passcreator's V3 LIST accepts
  // `templateId` and `identifier` as query parameters; both are
  // URL-encoded to be safe against special characters in
  // Passcreator's UUIDs.
  const params = new URLSearchParams();
  params.set('templateId', options.templateId);
  if (options.identifier !== undefined) {
    params.set('identifier', options.identifier);
  }
  const path = `/api/v3/pass?${params.toString()}`;

  const result = await passcreatorFetch(e, path, { method: 'GET' });

  if (typeof result !== 'object' || result === null) return [];
  const obj = result as Record<string, unknown>;

  // V3 LIST envelope puts the items at `data[]` (NOT `data{}`).
  // The single-pass GET uses `data{}` — these are two distinct
  // envelope shapes. We only iterate `data[]` here.
  const data = obj.data;
  if (!Array.isArray(data)) return [];

  // Optional filter: when `options.identifier` is provided, only
  // return the matching item. Passcreator's `?identifier=` filter
  // is server-side, but we ALSO client-filter for robustness
  // against Passcreator returning extra rows in some cases
  // (observed during the 2026-10-18 probe — `data[]` was paginated
  // and contained 100 of 221 passes, not all of which matched).
  const out: PassBackfillResponse[] = [];
  for (const rawItem of data) {
    if (typeof rawItem !== 'object' || rawItem === null) continue;
    const item = rawItem as Record<string, unknown>;
    if (typeof item.identifier !== 'string') continue;
    if (typeof item.linkToPassPage !== 'string') continue;
    if (
      options.identifier !== undefined &&
      item.identifier !== options.identifier
    ) {
      continue;
    }
    const autoGenId = item.generatedId ?? item.autoGeneratedId;
    out.push({
      identifier: item.identifier,
      downloadPage: item.linkToPassPage,
      iPhoneUri: typeof item.iPhoneUri === 'string' ? item.iPhoneUri : null,
      androidUri: typeof item.androidUri === 'string' ? item.androidUri : null,
      barcodeValue: extractBackfillBarcodeValue(item.barcodeValue, autoGenId),
    });
  }
  return out;
}
