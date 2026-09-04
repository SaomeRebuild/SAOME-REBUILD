/**
 * Link / URL helpers — shared between web and React Native.
 *
 * @module shared/logic/links
 * @description Pure URL / phone / email validation helpers for the
 * CardBuilder Step 4 Links section. No DOM / RN-specific dependencies;
 * uses the cross-platform `URL` parser available in both environments
 * (browsers, Node.js ≥10, React Native ≥0.72 with `URL` polyfill).
 *
 * Error messages are intentionally NOT included here — callers should map
 * the boolean result to their own i18n keys at the UI layer (Rule 023 §
 * Shared Validation 用 i18n Key).
 */

/**
 * Per-country phone patterns. Add a new country by inserting one entry —
 * the matching loop in {@link isPhoneLike} picks it up automatically.
 *
 * Convention: the regex is applied to the **separator-stripped** string
 * (see {@link PHONE_SEPARATOR_STRIP}). Common separators (space / hyphen
 * / parens / dot) are removed before matching so users can type
 * `082 123 4567` or `+27 (0) 82 123 4567` interchangeably.
 *
 * Phone-shape formats covered:
 *   - Local (0-prefixed): 0 + 8~10 digits (mobile + landline combined).
 *     Local is intentionally permissive — Taiwan mobile (09X) and South
 *     Africa mobile (06/07/08) share the same 0+9-digit shape; we accept
 *     both. Server-side (or future locale picker) can tighten if needed.
 *   - International (+886 or +27 prefix): country code + 7~12 digits.
 *
 * Future entries (HK, SG, JP, ...) follow the same shape — add one line.
 */
export const PHONE_COUNTRY_PATTERNS: Record<string, RegExp> = {
  /** Taiwan — local 0-prefix (landline 02-08, mobile 09), international +886. */
  TW: /^(?:\+?886\d{7,12}|0\d{8,10})$/,
  /** South Africa — local 0-prefix (mobile 06/07/08, landline 01-05), international +27. */
  ZA: /^(?:\+?27\d{7,12}|0\d{8,10})$/,
  // Future: HK: /.../, SG: /.../, JP: /.../
};

/**
 * Separators stripped from the input before phone-pattern matching.
 * Covers ASCII whitespace, hyphen (visually common in `021-123-4567`),
 * parentheses (`+27 (0) 82 123 4567`), and dot.
 */
const PHONE_SEPARATOR_STRIP = /[\s\-().]/g;

/**
 * Phone fallback for {@link isValidUrl}. Returns `true` if the input
 * matches any registered country pattern after separator normalization.
 *
 * Empty string returns `false` here — callers should treat empty as
 * "not yet typed" before consulting this helper (see {@link isValidUrl}).
 */
export function isPhoneLike(raw: string): boolean {
  if (raw === '') return false;
  const cleaned = raw.replace(PHONE_SEPARATOR_STRIP, '');
  for (const pattern of Object.values(PHONE_COUNTRY_PATTERNS)) {
    if (pattern.test(cleaned)) return true;
  }
  return false;
}

/**
 * RFC-5322-lite email shape check. Intentionally permissive — the real
 * authoritative validation lives at server-side and any non-ASCII or
 * edge-case address passes this regex (good — we don't want to block
 * legit addresses client-side).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lightweight URL format check with phone / email fallback.
 *
 * Accepts, in this order:
 *   1. Anything the platform-native `URL` parser accepts:
 *      - `http://` / `https://` (web URLs)
 *      - `tel:+1234567890` (Apple Wallet phone links)
 *      - `mailto:user@example.com` (Apple Wallet email links)
 *      - Custom URL schemes registered on the device (e.g. `myapp://path`)
 *   2. Phone shapes from {@link PHONE_COUNTRY_PATTERNS} (TW + ZA + future).
 *   3. Email shapes per {@link EMAIL_RE}.
 *
 * Empty string is treated as valid — an unfilled field is not a validation
 * error; callers should only show format errors when the user has typed
 * something that cannot parse.
 *
 * **Note**: phone / email hits return `true` *without* auto-prefixing
 * `tel:` / `mailto:`. The user-typed value is preserved as-is; Apple
 * Wallet's `relevantDate` / `webServiceURL` fields can accept raw phone
 * numbers and email addresses in some contexts, but the safe default is
 * "accept-as-is" so a stored row's value remains exactly what the user
 * typed. Callers that need a normalized form should wrap the value
 * explicitly (e.g. before persisting to Apple PassKit).
 *
 * @returns `true` if the value parses as URL, phone, email, or empty;
 *          `false` otherwise.
 */
export function isValidUrl(value: string): boolean {
  if (value === '') return true;
  // 1. URL parser — covers http(s)://, tel:, mailto:, custom schemes.
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    // 2. Phone fallback (TW + ZA + future countries via PHONE_COUNTRY_PATTERNS).
    if (isPhoneLike(value)) return true;
    // 3. Email fallback.
    if (EMAIL_RE.test(value)) return true;
    return false;
  }
}
