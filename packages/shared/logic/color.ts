/**
 * Color helpers — shared between web and React Native.
 *
 * @module shared/logic/color
 * @description Pure helpers for parsing, validating, and matching 6-digit
 * hex color codes (PassCreator contract). Error messages are i18n keys,
 * not raw text (Rule 023 § Shared Validation 用 i18n Key).
 */

import type { ColorPreset } from '../constants/color-presets';
import { COLOR_PRESETS } from '../constants/color-presets';

const HEX6_RE = /^[0-9A-Fa-f]{6}$/;

export interface ColorValidationError {
  type: 'invalid';
  /** i18n key (e.g. 'colorPicker.validation.invalid'). */
  message: string;
}

/**
 * Parse user input → 6-char uppercase hex WITHOUT '#' prefix.
 *
 * Accepts: 'ffffff', '#FFFFFF' (with optional '#').
 * Rejects: 'FFF' (3-digit shorthand), 'GGGGGG' (invalid hex),
 *          'rgb(...)' (named color), '' (empty).
 *
 * Returns null on invalid input (callers should use `validateColor`
 * for i18n-key error reporting).
 */
export function normalizeHex(input: string): string | null {
  const trimmed = input.trim().replace(/^#/, '');
  if (HEX6_RE.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

/**
 * Parse + validate, returning either the normalized hex or a typed
 * error with i18n key for `colorPicker.validation.invalid`.
 *
 * Success branch is `{ hex }` (NOT `{ type: 'ok' }`) so callers can
 * discriminate via `'hex' in result` without a discriminator field.
 */
export function validateColor(input: string): { hex: string } | ColorValidationError {
  const hex = normalizeHex(input);
  if (!hex) return { type: 'invalid', message: 'colorPicker.validation.invalid' };
  return { hex };
}

/** True if hex matches one of the 20 COLOR_PRESETS (after normalization). */
export function isPresetColor(hex: string): hex is ColorPreset {
  const normalized = normalizeHex(hex);
  return normalized !== null && (COLOR_PRESETS as readonly string[]).includes(normalized);
}
