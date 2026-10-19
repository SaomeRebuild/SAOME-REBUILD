/**
 * Passcreator error envelope types + helpers.
 *
 * @module shared/lib/passcreator/errors
 *
 * Phase 1 stub: contains only the exported types.
 * Phase 2 will add the helper functions (normalizePasscreatorErrorEntries,
 * isPasscreatorErrorEnvelope, extractUpstreamErrors, extractUpstreamErrorsFromArray).
 */

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
export type ErrorEnvelopeShape =
  | { entry: PasscreatorErrorEntry }
  | { entries: PasscreatorErrorEntry[] }
  | null;

// Phase 2 helpers — temporarily stubbed here so transport.ts can import them.
// They will be moved from passcreator.ts in Phase 2.

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
export function extractUpstreamErrorsFromArray(
  rawErrors: unknown[],
): PasscreatorErrorEntry[] {
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
export function isPasscreatorErrorEnvelope(
  parsed: unknown,
): parsed is PasscreatorErrorResponse {
  return normalizePasscreatorErrorEntries(parsed) !== null;
}

/**
 * Extract upstream errors from a V2 error envelope.
 *
 * Handles both `errors: PasscreatorErrorEntry[]` (array) and
 * `errors: PasscreatorErrorEntry` (singular object) shapes.
 */
export function extractUpstreamErrors(
  parsed: PasscreatorErrorResponse,
): Array<PasscreatorErrorEntry> {
  const rawErrors = parsed.errors;
  if (Array.isArray(rawErrors)) return extractUpstreamErrorsFromArray(rawErrors);
  if (typeof rawErrors === 'object' && rawErrors !== null) {
    const e = rawErrors as Record<string, unknown>;
    if (typeof e.property === 'string' && typeof e.message === 'string') {
      return [{ property: e.property, message: e.message }];
    }
  }
  return [];
}

/**
 * Type-guard + shape normalizer for the V2 error envelope.
 *
 * Conservative: we treat the response as an error envelope when
 * `success === false` AND `errors` is an array OR a `{property,
 * message}-shaped` object. False positives are avoided by:
 *   - Success responses (which also have `success: true`) won't match.
 *   - Non-V2 error formats (e.g. 5xx with a generic `{error: '...'}`
 *     won't have `success === false`.
 *   - Junk entries fail the inner `property`/`message` string check.
 *
 * Returns the parsed envelope PLUS the error entries as a single
 * array so the caller can iterate uniformly. When `errors` is a
 * single object it's wrapped into a 1-element array.
 */
export function normalizePasscreatorErrorEntries(parsed: unknown): {
  envelope: PasscreatorErrorResponse;
  entries: PasscreatorErrorEntry[];
} | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.success !== false) return null;
  const rawErrors = obj.errors;
  let entries: PasscreatorErrorEntry[] = [];
  if (Array.isArray(rawErrors)) {
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
