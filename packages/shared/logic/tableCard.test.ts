/**
 * Table Card Logic Tests (Vitest)
 *
 * Per `.specify/memory/constitution.md` TDD-Mandatory:
 * - Red-Green-Refactor cycle.
 * - Each test names one observable behavior; no over-mocking.
 *
 * Pure functions under test (跨 web + RN shared):
 *   - validateTableCardSettings
 *   - sortByZIndex
 *   - isStale
 *   - computeSafeZone
 */

import { describe, expect, it } from 'vitest';
import {
  computeSafeZone,
  gradientAngleToEndPoints,
  isStale,
  sortByZIndex,
  validateTableCardSettings,
} from './tableCard';
import type {
  TableCardBackground,
  TableCardElement,
  TableCardSettings,
} from '../schemas/card';

const baseBackground: TableCardBackground = {
  type: 'solid',
  color: '#ffffff',
};

const baseElement: TableCardElement = {
  id: '11111111-1111-1111-1111-111111111111',
  type: 'text',
  x: 10,
  y: 10,
  width: 50,
  height: 10,
  rotation: 0,
  zIndex: 0,
  text: 'Hello',
  fontSize: 12,
  fontWeight: 'normal',
  color: '#000000',
};

const baseSettings: TableCardSettings = {
  elements: [baseElement],
  background: baseBackground,
  bleedMm: 3,
};

describe('validateTableCardSettings', () => {
  it('returns parsed settings for a valid payload', () => {
    const result = validateTableCardSettings(baseSettings);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bleedMm).toBe(3);
      expect(result.data.elements).toHaveLength(1);
    }
  });

  it('rejects invalid hex color on text element', () => {
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [{ ...baseElement, color: 'red' }], // not hex 6-digit
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown bleed value (not in 3/5/10)', () => {
    const result = validateTableCardSettings({
      ...baseSettings,
      bleedMm: 7 as unknown as 3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty elements array (must have at least zero — array allowed empty)', () => {
    // 0 elements is allowed (template just started); ≥ 51 rejected
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects elements array exceeding MAX_ELEMENTS=50', () => {
    const manyElements = Array.from({ length: 51 }, (_, i) => ({
      ...baseElement,
      id: `00000000-0000-0000-0000-${i.toString().padStart(12, '0')}`,
    }));
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: manyElements,
    });
    expect(result.success).toBe(false);
  });

  it('rejects text exceeding 200 chars', () => {
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [{ ...baseElement, text: 'a'.repeat(201) }],
    });
    expect(result.success).toBe(false);
  });
});

describe('sortByZIndex', () => {
  it('sorts elements ascending by zIndex (lowest = bottom layer)', () => {
    const e0: TableCardElement = { ...baseElement, id: 'a', zIndex: 2 };
    const e1: TableCardElement = { ...baseElement, id: 'b', zIndex: 0 };
    const e2: TableCardElement = { ...baseElement, id: 'c', zIndex: 1 };
    const sorted = sortByZIndex([e0, e1, e2]);
    expect(sorted.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate input array', () => {
    const e0: TableCardElement = { ...baseElement, id: 'a', zIndex: 1 };
    const e1: TableCardElement = { ...baseElement, id: 'b', zIndex: 0 };
    const input = [e0, e1];
    sortByZIndex(input);
    expect(input[0]?.id).toBe('a');
    expect(input[1]?.id).toBe('b');
  });

  it('handles empty array', () => {
    expect(sortByZIndex([])).toEqual([]);
  });

  it('preserves order when zIndex values are equal (stable sort)', () => {
    const e0: TableCardElement = { ...baseElement, id: 'a', zIndex: 1 };
    const e1: TableCardElement = { ...baseElement, id: 'b', zIndex: 1 };
    const e2: TableCardElement = { ...baseElement, id: 'c', zIndex: 1 };
    const sorted = sortByZIndex([e0, e1, e2]);
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('isStale', () => {
  it('returns true when editedAt > exportedAt (canvas changed after last export)', () => {
    expect(isStale('2026-09-27T10:00:00.000Z', '2026-09-27T09:00:00.000Z')).toBe(true);
  });

  it('returns false when editedAt < exportedAt (no change after last export)', () => {
    expect(isStale('2026-09-27T09:00:00.000Z', '2026-09-27T10:00:00.000Z')).toBe(false);
  });

  it('returns false when editedAt === exportedAt', () => {
    expect(isStale('2026-09-27T10:00:00.000Z', '2026-09-27T10:00:00.000Z')).toBe(false);
  });

  it('returns true when exportedAt is undefined (never exported but edited)', () => {
    expect(isStale('2026-09-27T10:00:00.000Z', undefined)).toBe(true);
  });

  it('returns false when editedAt is undefined (never edited — edge case for empty canvas)', () => {
    expect(isStale(undefined, '2026-09-27T10:00:00.000Z')).toBe(false);
  });

  it('returns true when both are undefined (never exported, never edited = stale)', () => {
    expect(isStale(undefined, undefined)).toBe(true);
  });
});

describe('computeSafeZone', () => {
  it('returns inner rectangle inset by SAFE_ZONE_INSET_MM from trim edge', () => {
    const zone = computeSafeZone(210, 297, 3);
    // trim width = 210, safe zone width = 210 - 2 × (3 + 5) = 194
    // trim height = 297, safe zone height = 297 - 2 × (3 + 5) = 281
    expect(zone.width).toBe(194);
    expect(zone.height).toBe(281);
    expect(zone.x).toBe(8); // bleed + safe zone inset
    expect(zone.y).toBe(8);
  });

  it('grows safe zone shrink as bleed increases (more inner protection)', () => {
    const z3 = computeSafeZone(210, 297, 3);
    const z10 = computeSafeZone(210, 297, 10);
    expect(z10.width).toBeLessThan(z3.width);
    expect(z10.height).toBeLessThan(z3.height);
  });

  it('safe zone remains positive for all valid bleeds', () => {
    [3, 5, 10].forEach((bleed) => {
      const zone = computeSafeZone(210, 297, bleed as 3 | 5 | 10);
      expect(zone.width).toBeGreaterThan(0);
      expect(zone.height).toBeGreaterThan(0);
    });
  });
});

// =====================================================================
// 2026-09-27 Step 7 Round 7 — gradientAngleToEndPoints
// =====================================================================
//
// Bug: `renderBackground` ignored `bg.gradient.angle` and always drew
// the gradient as a fixed top-left → bottom-right diagonal. New pure
// helper computes Konva fillLinearGradient{Start,End}Point from an
// angle (Photoshop / Figma convention: 0° = left→right, clockwise).
//
// Convention under test:
//   - 0°   = left→right   (start at left-midpoint, end at right-midpoint)
//   - 90°  = top→bottom   (start at top-midpoint, end at bottom-midpoint)
//   - 180° = right→left   (start at right-midpoint, end at left-midpoint)
//   - 270° = bottom→top   (start at bottom-midpoint, end at top-midpoint)
//   - 45°  = diagonal top-left → bottom-right (start at top-left corner)

describe('gradientAngleToEndPoints', () => {
  it('angle 0°: start at left midpoint, end at right midpoint (left→right)', () => {
    const { start, end } = gradientAngleToEndPoints(0, 100, 50);
    expect(start.x).toBeCloseTo(0, 5);
    expect(start.y).toBeCloseTo(25, 5);
    expect(end.x).toBeCloseTo(100, 5);
    expect(end.y).toBeCloseTo(25, 5);
  });

  it('angle 90°: start at top midpoint, end at bottom midpoint (top→bottom)', () => {
    const { start, end } = gradientAngleToEndPoints(90, 100, 50);
    expect(start.x).toBeCloseTo(50, 5);
    expect(start.y).toBeCloseTo(0, 5);
    expect(end.x).toBeCloseTo(50, 5);
    expect(end.y).toBeCloseTo(50, 5);
  });

  it('angle 180°: start at right midpoint, end at left midpoint (right→left)', () => {
    const { start, end } = gradientAngleToEndPoints(180, 100, 50);
    expect(start.x).toBeCloseTo(100, 5);
    expect(start.y).toBeCloseTo(25, 5);
    expect(end.x).toBeCloseTo(0, 5);
    expect(end.y).toBeCloseTo(25, 5);
  });

  it('angle 270°: start at bottom midpoint, end at top midpoint (bottom→top)', () => {
    const { start, end } = gradientAngleToEndPoints(270, 100, 50);
    expect(start.x).toBeCloseTo(50, 5);
    expect(start.y).toBeCloseTo(50, 5);
    expect(end.x).toBeCloseTo(50, 5);
    expect(end.y).toBeCloseTo(0, 5);
  });

  it('angle 45° (square canvas): endpoints land on the corners (top-left → bottom-right)', () => {
    // For a square 100×100 canvas at 45°, the gradient line from
    // center hits the vertical edge and horizontal edge at the same
    // distance — so the endpoints sit exactly on the corners.
    const { start, end } = gradientAngleToEndPoints(45, 100, 100);
    expect(start.x).toBeCloseTo(0, 5);
    expect(start.y).toBeCloseTo(0, 5);
    expect(end.x).toBeCloseTo(100, 5);
    expect(end.y).toBeCloseTo(100, 5);
  });

  it('angle 45° (rectangular canvas): endpoints sit on the canvas edges, not beyond', () => {
    // For a 100×50 rectangle at 45°, the gradient line from center
    // hits the horizontal edge (y = 0 or y = 50) first because
    // height < width. Endpoints should sit ON those edges, not
    // extend past the canvas corners.
    const { start, end } = gradientAngleToEndPoints(45, 100, 50);
    expect(start.x).toBeCloseTo(25, 5);
    expect(start.y).toBeCloseTo(0, 5);
    expect(end.x).toBeCloseTo(75, 5);
    expect(end.y).toBeCloseTo(50, 5);
  });
});

// =====================================================================
// 2026-09-27 Step 7 Round 6 — image clipShape / clipRadius conformance
// =====================================================================
//
// Backward-compatible: existing image elements (without clipShape) MUST
// still validate. New fields are optional; only their bounds are checked.

const baseImageElement: TableCardElement = {
  id: '22222222-2222-2222-2222-222222222222',
  type: 'image',
  x: 10,
  y: 10,
  width: 60,
  height: 40,
  rotation: 0,
  zIndex: 0,
  imageKey: 'tenant/template/table-card/abc.png',
};

describe('image element clipShape / clipRadius (Round 6 schema conformance)', () => {
  it('accepts image element without clipShape (backward-compat with pre-Round-6 data)', () => {
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [baseImageElement],
    });
    expect(result.success).toBe(true);
  });

  it('accepts image element with clipShape: "circle" + clipRadius: 5', () => {
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [{ ...baseImageElement, clipShape: 'circle', clipRadius: 5 }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts image element with clipShape: "triangle" (clipRadius ignored when not rect)', () => {
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [{ ...baseImageElement, clipShape: 'triangle', clipRadius: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects image element with clipShape: "invalid" (not in enum)', () => {
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [{ ...baseImageElement, clipShape: 'invalid' as unknown as 'rect' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects clipRadius: -1 (below min 0)', () => {
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [{ ...baseImageElement, clipShape: 'rect', clipRadius: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects clipRadius: 51 (above max 50)', () => {
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [{ ...baseImageElement, clipShape: 'rect', clipRadius: 51 }],
    });
    expect(result.success).toBe(false);
  });
});

// =====================================================================
// 2026-09-27 Step 7 Round 6 — multi-line text conformance
// =====================================================================
//
// Inspector switched <input> to <textarea> to support \n characters.
// Schema's z.string().max(200) counts characters including \n.

describe('text element multi-line support (Round 6 conformance)', () => {
  it('accepts text containing \\n (line break) within 200 char limit', () => {
    const multiline = 'Line 1\nLine 2\nLine 3';
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [{ ...baseElement, text: multiline }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Narrow the discriminated union to the `text` variant before
      // accessing the `text` field (TS strict mode otherwise rejects
      // the access because `image` / `shape` variants don't carry it).
      const first = result.data.elements[0];
      if (first?.type === 'text') {
        expect(first.text).toBe(multiline);
      }
    }
  });

  it('rejects text with \\n exceeding 200 chars total (counter includes newlines)', () => {
    // 'a'.repeat(50) + '\n' × 4 + 'b'.repeat(150) = 50 + 4 + 150 = 204 chars > 200
    const tooLong = `${'a'.repeat(50)}\n\n\n\n${'b'.repeat(150)}`;
    const result = validateTableCardSettings({
      ...baseSettings,
      elements: [{ ...baseElement, text: tooLong }],
    });
    expect(result.success).toBe(false);
  });
});
