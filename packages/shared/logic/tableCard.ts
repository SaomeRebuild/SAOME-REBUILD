/**
 * Table Card Logic — Pure Business Functions
 *
 * @module shared/logic/tableCard
 * @description Pure functions used by both frontend (Konva canvas) and
 * backend (validation / sorting) for Step 7 (Customizable Table Card).
 *
 * TDD-driven; failing tests live in logic/tableCard.test.ts (Rule 003).
 *
 * Cross-platform: this module imports only from `shared/schemas/card` and
 * `shared/constants/table-card`, both of which are platform-agnostic
 * (no React/DOM/RN imports). React Native can reuse these directly
 * (Rule 024).
 */

import { z } from 'zod';
import {
  SAFE_ZONE_INSET_MM,
  TABLE_CARD_HEIGHT_MM,
  TABLE_CARD_WIDTH_MM,
} from '../constants/table-card';
import {
  tableCardSettingsSchema,
  type TableCardElement,
  type TableCardSettings,
} from '../schemas/card';

// ===== Validation =====

export type ValidateResult =
  | { success: true; data: TableCardSettings }
  | { success: false; error: z.ZodError };

/**
 * Validate a TableCardSettings payload against the shared zod schema.
 *
 * Used by:
 *   - Frontend autosave timer (Rule 032 client-side validation gate)
 *   - Backend POST /api/cards/:id/table-card/export (defense in depth)
 *
 * @param input - Unknown input (e.g. req.body.settings.tableCard)
 * @returns { success, data | error }
 */
export function validateTableCardSettings(input: unknown): ValidateResult {
  const result = tableCardSettingsSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as TableCardSettings };
  }
  return { success: false, error: result.error };
}

// ===== Z-order sorting =====

/**
 * Sort elements ascending by zIndex (lowest first = bottom layer).
 *
 * Konva draws elements in array order; callers (the canvas component)
 * pass the result to `<Stage>` to render bottom-to-top.
 *
 * Stable sort: elements with equal zIndex retain their relative input
 * order (Node.js Array.prototype.sort is stable since V8 7.0).
 *
 * Pure: does not mutate the input array (uses spread copy).
 *
 * @param elements - Read-only array of TableCardElement
 * @returns New sorted array
 */
export function sortByZIndex(elements: readonly TableCardElement[]): TableCardElement[] {
  return [...elements].sort((a, b) => a.zIndex - b.zIndex);
}

// ===== Stale detection =====

/**
 * Determine whether the canvas has changed since the last successful
 * export. Drives the 5-state export button (idle → generating → ready →
 * stale → error) per Step 7 plan.
 *
 * Both timestamps are ISO 8601 UTC strings (matches
 * `new Date().toISOString()`). String comparison is equivalent to
 * time comparison because ISO 8601 is lexicographically sortable.
 *
 * Decision matrix:
 *   - editedAt > exportedAt → STALE (canvas modified after last export)
 *   - editedAt ≤ exportedAt → NOT STALE
 *   - exportedAt undefined   → STALE (never exported)
 *   - editedAt undefined     → NOT STALE (never edited, edge case)
 *   - both undefined         → STALE (initial state — surface "Generate")
 *
 * @param editedAt - ISO timestamp of last canvas edit; undefined if never
 * @param exportedAt - ISO timestamp of last successful export; undefined if never
 * @returns true if canvas has unsaved changes since last export
 */
export function isStale(
  editedAt: string | undefined,
  exportedAt: string | undefined,
): boolean {
  if (editedAt === undefined && exportedAt === undefined) {
    return true; // initial state — surface "Generate" to user
  }
  if (exportedAt === undefined) {
    return true; // canvas edited but never exported
  }
  if (editedAt === undefined) {
    return false; // no edits recorded (edge case)
  }
  return editedAt > exportedAt;
}

// ===== Safe zone geometry =====

export type SafeZone = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Compute the safe zone rectangle (mm) for content placement.
 *
 * Safe zone = canvas − (bleed + SAFE_ZONE_INSET_MM) inset on every side.
 * Anything inside the safe zone is guaranteed to survive trim; anything
 * in the bleed area may be cropped on print.
 *
 * Used by the Step 7 inspector to draw a visual overlay (dashed rect)
 * warning users when an element extends into the bleed area.
 *
 * @param canvasWidthMm - Trim-edge width in mm (TABLE_CARD_WIDTH_MM = 210)
 * @param canvasHeightMm - Trim-edge height in mm (TABLE_CARD_HEIGHT_MM = 297)
 * @param bleedMm - User-selected bleed (3/5/10)
 * @returns Safe zone rectangle in mm, top-left origin
 */
export function computeSafeZone(
  canvasWidthMm: number,
  canvasHeightMm: number,
  bleedMm: 3 | 5 | 10,
): SafeZone {
  const inset = bleedMm + SAFE_ZONE_INSET_MM;
  return {
    x: inset,
    y: inset,
    width: canvasWidthMm - 2 * inset,
    height: canvasHeightMm - 2 * inset,
  };
}

// ===== Gradient geometry =====

export type GradientEndPoints = {
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/**
 * Convert a gradient angle (0–360°) into Konva
 * `fillLinearGradientStartPoint` / `fillLinearGradientEndPoint`.
 *
 * Convention: 0° = left→right, 90° = top→bottom, clockwise
 * (matches Photoshop / Figma). Endpoints sit on the rectangle edges
 * where the gradient line (drawn from canvas center at the given
 * angle) meets the box, so the gradient always covers the visible
 * canvas without overflowing.
 *
 * Pure, platform-agnostic. The web canvas passes the result straight
 * to Konva; React Native can map the same `{ start, end }` shape onto
 * Skia's `LinearGradient.fromPoints(...)` bridge.
 *
 * @param angle - Degrees, [0, 360); matches `tableCardBackgroundSchema.gradient.angle`
 * @param width - Canvas width in CSS pixels (or any unit, as long as it's the same for `height`)
 * @param height - Canvas height in the same unit
 * @returns `{ start, end }` ready to plug into Konva's fillLinearGradient props
 */
export function gradientAngleToEndPoints(
  angle: number,
  width: number,
  height: number,
): GradientEndPoints {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const halfW = width / 2;
  const halfH = height / 2;
  const cx = halfW;
  const cy = halfH;
  // Distance from center to the closest edge along the gradient
  // direction. Whichever side of the rectangle (vertical or horizontal)
  // is hit first limits t. Using `Infinity` when the direction has no
  // component toward an axis (e.g. dx === 0 means the line never hits
  // a vertical edge) keeps the `Math.min` branch alive.
  const tVertical = Math.abs(dx) > 1e-12 ? halfW / Math.abs(dx) : Infinity;
  const tHorizontal = Math.abs(dy) > 1e-12 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tVertical, tHorizontal);
  return {
    start: { x: cx - dx * t, y: cy - dy * t },
    end: { x: cx + dx * t, y: cy + dy * t },
  };
}

// Re-export constants for convenience
export { TABLE_CARD_WIDTH_MM, TABLE_CARD_HEIGHT_MM };
