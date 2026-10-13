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
    entries = extractUpstreamErrorsFromArray(rawErrors);
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
