/**
 * Locations validation — shared between web and React Native.
 *
 * @module shared/logic/locations
 * @description Pure functions for parsing, validating, and counting
 * `templateSettings.locations` entries (CardBuilder Step 5).
 *
 * No DOM, no DB, no React state. This makes them:
 *   1. Cross-platform safe (web + RN + Cloudflare Worker).
 *   2. Unit-testable without jsdom / DB mocks.
 *
 * Error messages are intentionally i18n KEYS (not raw text) per
 * `frontend/023-shared-package.mdc § Shared Validation 用 i18n Key`.
 */

import {
  COORDINATE_PASTE_REGEX,
  LATITUDE_MAX,
  LATITUDE_MIN,
  LOCATION_NAME_MAX_LENGTH,
  LOCATIONS_MAX,
  LOCATIONS_MAX_DISTANCE_MAX,
  LOCATIONS_MAX_DISTANCE_MIN,
  LONGITUDE_MAX,
  LONGITUDE_MIN,
  RELEVANT_TEXT_MAX_LENGTH,
} from '../constants/card-back-fields';

/**
 * Single source of truth for the location shape stored in
 * `templateSettings.locations` (Passcreator API-aligned).
 *
 * Each row holds `name` (user-facing label) plus a coordinate pair
 * (latitude, longitude) parsed from a Google Maps paste. Step 5 keeps
 * the shape minimal — altitude is deferred to a future iteration.
 *
 * `relevantText` is the lock-screen message shown when the user arrives
 * at the location (Apple Wallet pkpass `relevantLocations[].relevantText`).
 * Optional — `null` means "no custom message, use pass-level default".
 *
 * 2026-09-06 refactor: `latitude` and `longitude` are REQUIRED fields
 * (no `.optional()`) when the row exists in the store. The schema layer
 * (`packages/shared/schemas/card.ts`) enforces non-null lat/lng; the UI
 * layer surfaces red borders until the user pastes coordinates.
 */
export interface LocationInput {
  name: string;
  latitude: number;
  longitude: number;
  relevantText: string | null;
}

/**
 * Parsed result of a coordinate paste action. Either a successful
 * `latitude` / `longitude` pair OR a `LocationValidationError` describing
 * why the paste failed.
 *
 * Discriminated union: success shape has `latitude`/`longitude` keys;
 * failure shape has `type` + `message`.
 */
export type ParseCoordinateResult =
  | { latitude: number; longitude: number }
  | LocationValidationError;

/**
 * Validation error types for `locations`.
 *
 * `message` is an i18n KEY, not a translated string. Consumers resolve the
 * key at the UI layer via `t('step5.locations.validation.<key>')`.
 *
 * `locationsMaxDistance*` variants cover the Step 5 distance field
 * (2026-09-06 rename from `notificationRadius*`). They reuse the
 * `step5.locations.validation.*` i18n namespace because the field belongs
 * to the same Step 5 surface; a separate namespace would split the
 * user-facing error UX across two unrelated trees.
 *
 * `*Required` variants cover Step 5's "must fill these before continuing"
 * requirement (when `locationsDisabled=false`).
 */
export interface LocationValidationError {
  type:
    | 'invalidFormat'
    | 'latitudeOutOfRange'
    | 'longitudeOutOfRange'
    | 'nameEmpty'
    | 'nameTooLong'
    | 'tooMany'
    | 'latitudeRequired'
    | 'longitudeRequired'
    | 'relevantTextTooLong'
    | 'locationsMaxDistanceInvalid'
    | 'locationsMaxDistanceOutOfRange'
    | 'locationsMaxDistanceRequired'
    | 'locationsMinOne';
  message: string;
}

/**
 * Parse a coordinate paste from Google Maps (e.g. "25.033,121.565" or
 * "25.033, 121.565"). Accepts surrounding whitespace and an arbitrary
 * number of decimal places.
 *
 * Format is `lat,lng` (Google Maps standard order). The Apple Wallet
 * pkpass spec is also `latitude, longitude` so no further mapping is
 * needed at pkpass generation time.
 *
 * @returns Parsed coords on success; a {@link LocationValidationError}
 *          (with `message` = i18n key) on any parse or range failure.
 */
export function parseCoordinatePaste(raw: string): ParseCoordinateResult {
  const match = COORDINATE_PASTE_REGEX.exec(raw);
  if (!match) {
    return {
      type: 'invalidFormat',
      message: 'step5.locations.validation.invalidFormat',
    };
  }
  // Regex guarantees two numeric captures; default to empty string only
  // for type narrowing satisfaction.
  const latRaw = match[1] ?? '';
  const lngRaw = match[2] ?? '';
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      type: 'invalidFormat',
      message: 'step5.locations.validation.invalidFormat',
    };
  }
  if (latitude < LATITUDE_MIN || latitude > LATITUDE_MAX) {
    return {
      type: 'latitudeOutOfRange',
      message: 'step5.locations.validation.latitudeOutOfRange',
    };
  }
  if (longitude < LONGITUDE_MIN || longitude > LONGITUDE_MAX) {
    return {
      type: 'longitudeOutOfRange',
      message: 'step5.locations.validation.longitudeOutOfRange',
    };
  }
  return { latitude, longitude };
}

/**
 * Validate a single location entry (Step 5 row). Returns `null` on
 * success or a {@link LocationValidationError} on the first failing field.
 *
 * Per-row validation covers `name`, `latitude`, `longitude`, and
 * `relevantText`. All checks are unconditional — every row in the store
 * is expected to be a "complete" row (lat/lng required, name required,
 * relevantText optional). Empty/incomplete rows are surface as
 * validation errors that block the user from continuing to Step 6
 * (when `locationsDisabled=false`).
 */
export function validateLocation(
  loc: Partial<LocationInput>,
): LocationValidationError | null {
  // Name — required, ≤ LOCATION_NAME_MAX_LENGTH chars.
  if (typeof loc.name !== 'string' || loc.name.trim() === '') {
    return {
      type: 'nameEmpty',
      message: 'step5.locations.validation.nameEmpty',
    };
  }
  if (loc.name.length > LOCATION_NAME_MAX_LENGTH) {
    return {
      type: 'nameTooLong',
      message: 'step5.locations.validation.nameTooLong',
    };
  }
  // Latitude — required, in [-90, 90].
  if (
    typeof loc.latitude !== 'number' ||
    !Number.isFinite(loc.latitude)
  ) {
    return {
      type: 'latitudeRequired',
      message: 'step5.locations.validation.latitudeRequired',
    };
  }
  if (loc.latitude < LATITUDE_MIN || loc.latitude > LATITUDE_MAX) {
    return {
      type: 'latitudeOutOfRange',
      message: 'step5.locations.validation.latitudeOutOfRange',
    };
  }
  // Longitude — required, in [-180, 180].
  if (
    typeof loc.longitude !== 'number' ||
    !Number.isFinite(loc.longitude)
  ) {
    return {
      type: 'longitudeRequired',
      message: 'step5.locations.validation.longitudeRequired',
    };
  }
  if (loc.longitude < LONGITUDE_MIN || loc.longitude > LONGITUDE_MAX) {
    return {
      type: 'longitudeOutOfRange',
      message: 'step5.locations.validation.longitudeOutOfRange',
    };
  }
  // relevantText — optional (nullable string), ≤ RELEVANT_TEXT_MAX_LENGTH.
  if (loc.relevantText !== null && loc.relevantText !== undefined) {
    if (typeof loc.relevantText !== 'string') {
      return {
        type: 'relevantTextTooLong',
        message: 'step5.locations.validation.relevantTextTooLong',
      };
    }
    if (loc.relevantText.length > RELEVANT_TEXT_MAX_LENGTH) {
      return {
        type: 'relevantTextTooLong',
        message: 'step5.locations.validation.relevantTextTooLong',
      };
    }
  }
  return null;
}

/**
 * Validate the entire `locations` array. Returns `null` on success or the
 * FIRST failing {@link LocationValidationError}.
 *
 * Checks:
 *   - `tooMany` (array-level): caps at LOCATIONS_MAX. Apple Wallet pkpass
 *     caps `relevantLocations` at this number; Passcreator API also caps.
 *   - `locationsMinOne` (array-level): at least 1 row required when
 *     `requireMinOne=true` (default). Matches Passcreator / Apple Wallet
 *     "geolocation enabled" requirement.
 *   - Row-level errors: nameEmpty / nameTooLong / lat/lng required /
 *     lat/lng out-of-range / relevantTextTooLong. Reported in array order
 *     so the UI can surface them on the offending row.
 *
 * 2026-09-06 refactor: `requireMinOne` was added to let the workspace
 * `isStep5Valid()` opt out of the "at least 1 row" check when
 * `locationsDisabled=true` (whole Step 5 is skipped).
 */
export function validateAllLocations(
  locs: ReadonlyArray<Partial<LocationInput>>,
  options?: { requireMinOne?: boolean },
): LocationValidationError | null {
  const requireMinOne = options?.requireMinOne ?? true;
  if (locs.length > LOCATIONS_MAX) {
    return {
      type: 'tooMany',
      message: 'step5.locations.validation.tooMany',
    };
  }
  if (requireMinOne && locs.length === 0) {
    return {
      type: 'locationsMinOne',
      message: 'step5.locations.validation.locationsMinOne',
    };
  }
  for (const row of locs) {
    const err = validateLocation(row);
    if (err !== null) return err;
  }
  return null;
}

// ============================================================
// Locations max distance (Step 5, 2026-09-06 rename)
// ============================================================
//
// Renamed from `notificationRadius` to align with Passcreator API field
// `locationsMaxDistance`. Behavior unchanged: integer in
// [LOCATIONS_MAX_DISTANCE_MIN=100, LOCATIONS_MAX_DISTANCE_MAX=1000].
// `null` means "use pass-type default" (Apple Wallet decides based on
// card type).
//
// Renamed in shared/constants/card-back-fields.ts (NOTIFICATION_RADIUS_*
// → LOCATIONS_MAX_DISTANCE_*) and shared/schemas/card.ts (templateSettings
// key `notificationRadius` → `locationsMaxDistance`).

/**
 * Result of parsing a locations-max-distance input value.
 *
 *   - `null`     → user cleared the field; pass-type default applies
 *   - `number`   → valid radius in [100, 1000] (integer)
 *   - `LocationValidationError` → invalid (out-of-range / NaN / not int)
 *
 * Consumers resolve the i18n `message` at the UI layer via
 * `t('step5.locations.validation.<type>')`.
 */
export type ParseLocationsMaxDistanceResult =
  | number
  | null
  | LocationValidationError;

/**
 * Parse and validate a locations-max-distance input value. Accepts:
 *   - `number`: must be an integer in [100, 1000]
 *   - `string`: a numeric string in the same range (UI <input> raw value);
 *     empty/whitespace → returns `null` (use pass-type default)
 *   - `null`: pass-type default sentinel (returned as-is)
 *   - `undefined` / non-numeric / out-of-range / non-integer: validation error
 *
 * The function intentionally does NOT clamp — PassKit's
 * "lower / higher values will be ignored" is a UX trap we want to
 * surface to the user via an error message, not silently swallow.
 */
export function parseLocationsMaxDistance(
  raw: unknown,
): ParseLocationsMaxDistanceResult {
  if (raw === null) {
    // `null` is a valid sentinel: the editor uses it to mean "use
    // pass-type default". The function returns null directly — consumers
    // see the same shape they sent.
    return null;
  }
  let n: number;
  if (typeof raw === 'number') {
    n = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      // Empty input — treat as "user cleared the field" → pass-type default.
      return null;
    }
    n = Number(trimmed);
  } else {
    return {
      type: 'locationsMaxDistanceInvalid',
      message: 'step5.locations.validation.locationsMaxDistanceInvalid',
    };
  }
  if (!Number.isFinite(n)) {
    return {
      type: 'locationsMaxDistanceInvalid',
      message: 'step5.locations.validation.locationsMaxDistanceInvalid',
    };
  }
  if (!Number.isInteger(n)) {
    return {
      type: 'locationsMaxDistanceInvalid',
      message: 'step5.locations.validation.locationsMaxDistanceInvalid',
    };
  }
  if (n < LOCATIONS_MAX_DISTANCE_MIN || n > LOCATIONS_MAX_DISTANCE_MAX) {
    return {
      type: 'locationsMaxDistanceOutOfRange',
      message: 'step5.locations.validation.locationsMaxDistanceOutOfRange',
    };
  }
  return n;
}

/**
 * Validate a locations-max-distance value already in the store. Returns
 * `null` on success or a {@link LocationValidationError} on the first
 * failing condition.
 *
 * `null` is valid (pass-type default sentinel). Numbers outside the
 * bound are rejected (same error as {@link parseLocationsMaxDistance}).
 */
export function validateLocationsMaxDistance(
  raw: unknown,
): LocationValidationError | null {
  if (raw === null || typeof raw === 'undefined') return null;
  const parsed = parseLocationsMaxDistance(raw);
  if (parsed === null) return null;
  if (typeof parsed === 'number') return null;
  return parsed;
}