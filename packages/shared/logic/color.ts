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

/**
 * 2026-10-05 PR — Normalize a stored-or-prop color value to a CSS-valid
 * `#RRGGBB` hex string with the leading `#`.
 *
 * Why this exists (regression — 2026-10-05 library preview):
 *   `CardBuilderEditorWorkspace.tsx` writes `backgroundColor` / `textColor`
 *   into `templates.settings` JSONB in **PassCreator contract format** —
 *   6-char uppercase hex WITHOUT the leading `#`:
 *     `backgroundColor: backgroundColor.replace('#', '').toUpperCase()`
 *   The matching read side `unwrapCardSettings(...)` returns the value
 *   unchanged, so the DB value `FFFFFF` reaches the library preview
 *   `TemplateCardPreview` as the bare 6-char string.
 *
 *   A previous PR wired the value into inline style via
 *   `style={{ backgroundColor: effectiveBackgroundColor, color: ... }}`,
 *   but `background-color: FFFFFF` is **invalid CSS** — the browser
 *   discards the entire declaration, the inner card surface falls back
 *   to the outer phone-frame `bg-white` Tailwind class, and the user
 *   sees a white card regardless of what color they actually saved.
 *
 * PassCreator contract (strip '#' on save) is the source of truth — we
 * must NOT change the editor write side. Instead, every read side that
 * puts the value into CSS MUST run it through `normalizeToCssColor`.
 * Today that's the library `TemplateCardPreview` (renderer); if other
 * read surfaces appear later (e.g. an "asset preview" page) they MUST
 * use this helper too, NOT a hand-rolled `value.startsWith('#')` check.
 *
 * Behavior contract:
 *   - Input `undefined` / empty string → return `fallback` (no color
 *     means "use the default", matching the J2 empty-string regression
 *     test for `backgroundColor` / `textColor`).
 *   - Input `#rrggbb` / `rrggbb` / `#RRGGBB` / `RRGGBB` / `RrGgBb`
 *     → return `#RRGGBB` (always 6-char uppercase with leading `#`).
 *   - Input anything else (named color like `red`, 3-char `#fff`,
 *     `rgb(...)`, garbage) → return `fallback`. Better to render the
 *     default than to silently emit invalid CSS that the browser
 *     discards and the user can't debug.
 *
 * Pure function — no side effects, no i18n, no DOM access. Safe to
 * call in render. Reuses `normalizeHex` so the regex + casing rules
 * stay single-sourced.
 */
export function normalizeToCssColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const normalized = normalizeHex(raw);
  return normalized ? `#${normalized}` : fallback;
}
