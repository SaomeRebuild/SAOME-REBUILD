/**
 * Passcreator V2 template request/response types.
 *
 * @module shared/lib/passcreator/v2-template-types
 */

import type { PasscreatorFieldType } from './v3-pass-types';

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
    headerFields: Array<{
      key: string;
      type: PasscreatorFieldType;
      label: string;
      value: string;
    }>;
    primaryFields: Array<{
      key: string;
      type: PasscreatorFieldType;
      label: string;
      value: string;
    }>;
    secondaryFields: Array<{
      key: string;
      type: PasscreatorFieldType;
      label: string;
      value: string;
    }>;
    auxiliaryFields: Array<{
      key: string;
      type: PasscreatorFieldType;
      label: string;
      value: string;
    }>;
    backFields: Array<{
      key: string;
      type: PasscreatorFieldType;
      label: string;
      value: string;
    }>;
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
