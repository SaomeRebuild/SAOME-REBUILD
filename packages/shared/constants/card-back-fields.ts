/**
 * Card back-side fields constants.
 *
 * @module shared/constants/card-back-fields
 * @description Field-level length limits and array size limits for the three
 * Step 4 sections: Description, Back fields, and Links.
 *
 * Single source of truth (Rule 019 § 4.1 + Rule 023). Both frontend UI and
 * backend schema import from here so the limits stay in sync.
 *
 * Background:
 *   - DESCRIPTION_MAX_LENGTH: Apple Wallet pass-level description is capped
 *     around 2048 bytes total per pass, but in practice descriptions render
 *     in a small area on the back of the pass. 200 chars is the conservative
 *     UI-friendly ceiling that matches what users can reasonably read in the
 *     preview.
 *   - BACK_FIELDS_MIN/MAX: PassKit allows up to ~10 back fields per pass.
 *     Min 1 enforced by UI because the Apple EULA requires contact info
 *     (Rule 019 § EULA translation) — empty backFields would violate the
 *     EULA at runtime.
 *   - LINKS_MAX: PassKit spec allows up to 4 links per pass (verified via
 *     PassCreator documentation 2026-09-04). No min — links are optional
 *     (the user already provides required contact info via backFields).
 *   - *MAX_LENGTH: Apple Wallet per-field byte limit is 2048. Back-field
 *     `value` is short text (max 80) while links can be long URLs (max 2048).
 *     Labels are short (max 40).
 */

export const DESCRIPTION_MAX_LENGTH = 200;

export const BACK_FIELDS_MIN = 1;
export const BACK_FIELDS_MAX = 10;
export const BACK_FIELD_LABEL_MAX_LENGTH = 40;
export const BACK_FIELD_VALUE_MAX_LENGTH = 80;

export const LINKS_MAX = 4;
export const LINK_LABEL_MAX_LENGTH = 40;
export const LINK_VALUE_MAX_LENGTH = 2048;

// ===== Step 5 — 地理位置 + 推播訊息 (2026-09-05) =====
//
// Aligns with Passcreator API: each location has { name, latitude, longitude }.
// Apple Wallet pkpass caps `relevantLocations` at LOCATIONS_MAX; the
// Passcreator panel also uses this cap. Step 5 keeps the row shape minimal —
// altitude and "arrival text" are deferred to a future iteration when their
// UX is finalised. `name` is the user-facing label that will later map to
// pkpass's `relevantText` field at generation time.
//
// INITIAL_MESSAGE_MAX_LENGTH is the push-notification body shown after a
// pass is downloaded (Passcreator "Initial message" field). 50 chars is
// Passcreator's UI cap (matches push-notification preview thumb space).
export const INITIAL_MESSAGE_MAX_LENGTH = 50;

export const LOCATIONS_MAX = 10;
export const LOCATION_NAME_MAX_LENGTH = 40;
/**
 * Max length for `relevantText` — the lock-screen message shown when the
 * user arrives at a location (Apple Wallet pkpass `relevantLocations[].relevantText`).
 * 100 chars matches Passcreator UI default; long enough for a sentence, short
 * enough for one-line lock-screen preview.
 */
export const RELEVANT_TEXT_MAX_LENGTH = 100;

// Inclusive range for lat/lng — matches WGS84 spec exactly.
// Parsing of pasted Google Maps coordinates uses these bounds to reject
// out-of-range values at the UI layer before they reach the zod schema.
export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;

// ===== Locations max distance (Step 5, 2026-09-06) =====
//
// Apple Wallet / PassKit `relevantText` companion radius. Renamed from
// `NOTIFICATION_RADIUS_*` (2026-09-05) to align with the Passcreator API
// field name `locationsMaxDistance`. Passcreator docs:
//   "The radius where this notification is shown. You may specify a value
//    between 100 and 1000 meters. Lower or higher values will be ignored.
//
//    If you don't specify a value the radius is depending on the pass type:
//      - Event tickets / boarding passes: large radius (up to 1000 m)
//      - Coupons / store cards / membership cards: small radius (up to 100 m)"
//
// We model this as a pass-level setting (`templateSettings.locationsMaxDistance`)
// rather than per-location. Per-location radius would require a separate
// Apple Wallet pkpass field (`maxDistance`) per `relevantLocations` row —
// that's deferred to a future iteration if UX calls for it.
export const LOCATIONS_MAX_DISTANCE_MIN = 100; // meters
export const LOCATIONS_MAX_DISTANCE_MAX = 1000; // meters

/**
 * Parses pasted Google Maps coordinates in the format `lat,lng`.
 *
 * The Google Maps share-sheet emits "lat, lng" with a space and up to 6
 * decimal places; the regex allows optional whitespace around the comma
 * and any number of decimals. `lng,lat` (the opposite order) would not
 * match — Google Maps always emits `lat,lng`.
 *
 * Used by the paste handler in Step5CardLocation/LocationRow.
 */
export const COORDINATE_PASTE_REGEX =
  /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;