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