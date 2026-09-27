/**
 * Step7TableCard.polygonElement — pure helper unit tests.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.polygonElement.test
 * @description Pins down the bbox / points / vertex-count math used by
 * both the Inspector "完成" button and the in-canvas floating finish
 * button. These tests live alongside the helper (rather than inside
 * the Inspector/Canvas tests) so the coordinate-space contract is
 * explicit:
 *
 *   vertices  = element-LOCAL mm  (relative to bboxOrigin)
 *   el.x, el.y = CANVAS-ABSOLUTE mm (renderer reads `mmToPx(el.x)` directly)
 *   el.points = bbox-LOCAL (subtract el.x - bboxOrigin.x)
 *
 * Round 15 (2026-09-27) — new file. Previously the math was covered
 * indirectly by Inspector + Canvas integration tests, but those tests
 * conflated "Inspector default bboxOrigin" with "the math itself". A
 * dedicated unit test makes the bboxOrigin offset explicit and lets
 * future callers verify their input shape without going through a
 * full React render.
 */

import { describe, expect, it } from 'vitest';
import {
  buildPolygonElementFromVertices,
  computePolygonBbox,
  nextPolygonZIndex,
  rebasePolygonPointsToBboxLocal,
} from './Step7TableCard.polygonElement';

// ============================================================================
// computePolygonBbox — bbox math over a flat points array
// ============================================================================

describe('Step7TableCard.polygonElement — computePolygonBbox', () => {
  it('returns 0×0 bbox when given fewer than 2 numbers', () => {
    expect(computePolygonBbox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(computePolygonBbox([10])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('returns correct bbox for a 3-vertex triangle (positive coords)', () => {
    // Vertices: (10, 10), (30, 10), (10, 30)
    expect(computePolygonBbox([10, 10, 30, 10, 10, 30])).toEqual({
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    });
  });

  it('returns correct bbox when some coords are negative', () => {
    // Vertices: (-5, -5), (15, -5), (-5, 15)
    expect(computePolygonBbox([-5, -5, 15, -5, -5, 15])).toEqual({
      x: -5,
      y: -5,
      width: 20,
      height: 20,
    });
  });

  it('clamps to 1×1 when all vertices coincide (degenerate polygon)', () => {
    // All clicks land on the same point → width/height = 0.
    // The clamp ensures the Konva hit region stays positive so the
    // user can still select + delete the shape from the layers panel.
    expect(computePolygonBbox([10, 10, 10, 10, 10, 10])).toEqual({
      x: 10,
      y: 10,
      width: 1,
      height: 1,
    });
  });

  it('skips non-numeric entries without crashing', () => {
    // `typeof NaN === 'number'` (NaN is the number type), so the
    // typeof guard passes. NaN comparisons are always false, so
    // NaN never updates minX/maxX; a *valid* companion coord still
    // updates minY/maxY as normal. This test pins that the loop
    // doesn't throw on garbage input — the bbox math is best-effort.
    const bbox = computePolygonBbox([10, 10, Number.NaN as unknown as number, 20]);
    // (10, 10) recorded; NaN skipped on minX/maxX; (NaN, 20) updates
    // maxY to 20. width = max(1, 10-10) = 1; height = max(1, 20-10) = 10.
    expect(bbox).toEqual({ x: 10, y: 10, width: 1, height: 10 });
  });
});

// ============================================================================
// rebasePolygonPointsToBboxLocal — translates flat points to (0, 0)-local
// ============================================================================

describe('Step7TableCard.polygonElement — rebasePolygonPointsToBboxLocal', () => {
  it('returns [] when given fewer than 2 numbers', () => {
    expect(rebasePolygonPointsToBboxLocal([])).toEqual([]);
    expect(rebasePolygonPointsToBboxLocal([5])).toEqual([]);
  });

  it('rebases positive-coord triangle to (0, 0)-local', () => {
    // (10, 10), (30, 10), (10, 30) → subtract (10, 10) → (0, 0), (20, 0), (0, 20)
    expect(rebasePolygonPointsToBboxLocal([10, 10, 30, 10, 10, 30])).toEqual([
      0, 0, 20, 0, 0, 20,
    ]);
  });

  it('rebases negative-coord triangle correctly', () => {
    // (-5, -5), (15, -5), (-5, 15) → subtract (-5, -5) → (0, 0), (20, 0), (0, 20)
    expect(rebasePolygonPointsToBboxLocal([-5, -5, 15, -5, -5, 15])).toEqual([
      0, 0, 20, 0, 0, 20,
    ]);
  });
});

// ============================================================================
// nextPolygonZIndex — utility for stack ordering
// ============================================================================

describe('Step7TableCard.polygonElement — nextPolygonZIndex', () => {
  it('returns 0 when no elements exist', () => {
    expect(nextPolygonZIndex([])).toBe(0);
  });

  it('returns max+1 across the existing elements', () => {
    expect(
      nextPolygonZIndex([
        { zIndex: 0 } as never,
        { zIndex: 2 } as never,
        { zIndex: 5 } as never,
      ]),
    ).toBe(6);
  });

  it('returns 0 when all existing elements have zIndex = -1', () => {
    expect(
      nextPolygonZIndex([
        { zIndex: -1 } as never,
        { zIndex: -1 } as never,
      ]),
    ).toBe(0);
  });
});

// ============================================================================
// buildPolygonElementFromVertices — Round 15 Bug 3 coordinate-space tests
// ============================================================================

describe('Step7TableCard.polygonElement — buildPolygonElementFromVertices (Round 15 Bug 3)', () => {
  // Round 15 (2026-09-27) — the helper's coordinate contract is now
  // explicit: input vertices are in element-LOCAL mm (relative to
  // bboxOrigin), output `el.x / el.y` are in canvas-ABSOLUTE mm. This
  // was previously wrong (Round 14 returned local-mm x/y), which made
  // every polygon land `bboxOrigin` mm short of where the user
  // clicked — visible as "the polygon jumps off the canvas" when the
  // user drew near the boundary.

  it('translates a positive-coord triangle into canvas-absolute bbox', () => {
    // LOCAL vertices: (10, 10), (60, 10), (10, 40)
    // bboxOrigin: (50, 50)
    // Expected canvas-mm bbox: (60, 60) → (110, 90)
    const el = buildPolygonElementFromVertices(
      [10, 10, 60, 10, 10, 40],
      1,
      { x: 50, y: 50 },
    );
    expect(el.type).toBe('shape');
    if (el.type === 'shape' && el.shape === 'polygon') {
      expect(el.x).toBe(60);  // canvas-absolute
      expect(el.y).toBe(60);  // canvas-absolute
      expect(el.width).toBe(50);
      expect(el.height).toBe(30);
      // Points rebased to bbox-local (subtract localMinX/Y = 10, 10).
      expect(el.points).toEqual([0, 0, 50, 0, 0, 30]);
      expect(el.vertexCount).toBe(3);
    } else {
      throw new Error('expected shape=polygon');
    }
  });

  it('places a polygon drawn at canvas (5, 5) at element x=5, y=5 (regression: jumps-out)', () => {
    // User clicks at canvas-mm (5, 5), (35, 5), (35, 35).
    // bboxOrigin = (50, 50), so LOCAL vertices are (-45, -45),
    // (-15, -45), (-15, -15) — all negative.
    //
    // Before Round 15 the helper returned `el.x = -45, el.y = -45`
    // and the renderer dropped the polygon 45 mm off the canvas.
    // After Round 15 it returns `el.x = 5, el.y = 5` — the actual
    // canvas-mm click position.
    const el = buildPolygonElementFromVertices(
      [-45, -45, -15, -45, -15, -15],
      1,
      { x: 50, y: 50 },
    );
    if (el.type === 'shape' && el.shape === 'polygon') {
      expect(el.x).toBe(5);
      expect(el.y).toBe(5);
      expect(el.width).toBe(30);
      expect(el.height).toBe(30);
      expect(el.points).toEqual([0, 0, 30, 0, 30, 30]);
    } else {
      throw new Error('expected shape=polygon');
    }
  });

  it('handles a polygon drawn entirely in the top-left with zero bboxOrigin', () => {
    // bboxOrigin (0, 0) → element coords === local coords.
    const el = buildPolygonElementFromVertices(
      [0, 0, 20, 0, 20, 20],
      0,
      { x: 0, y: 0 },
    );
    if (el.type === 'shape' && el.shape === 'polygon') {
      expect(el.x).toBe(0);
      expect(el.y).toBe(0);
      expect(el.width).toBe(20);
      expect(el.height).toBe(20);
      expect(el.points).toEqual([0, 0, 20, 0, 20, 20]);
    } else {
      throw new Error('expected shape=polygon');
    }
  });

  it('uses the supplied idFactory (deterministic IDs in tests)', () => {
    let i = 0;
    const idFactory = () => `test-id-${++i}`;
    const el1 = buildPolygonElementFromVertices(
      [0, 0, 10, 0, 10, 10],
      1,
      { x: 0, y: 0 },
      idFactory,
    );
    const el2 = buildPolygonElementFromVertices(
      [0, 0, 10, 0, 10, 10],
      2,
      { x: 0, y: 0 },
      idFactory,
    );
    expect(el1.id).toBe('test-id-1');
    expect(el2.id).toBe('test-id-2');
  });

  it('sets the default blue fill + zero stroke (matches canvas preview)', () => {
    const el = buildPolygonElementFromVertices(
      [0, 0, 10, 0, 10, 10],
      1,
      { x: 0, y: 0 },
    );
    if (el.type === 'shape' && el.shape === 'polygon') {
      expect(el.fill).toBe('#3b82f6');
      expect(el.stroke).toBe('#3b82f6');
      expect(el.strokeWidth).toBe(0);
      expect(el.rotation).toBe(0);
      expect(el.zIndex).toBe(1);
    } else {
      throw new Error('expected shape=polygon');
    }
  });

  it('a triangle drawn near the right-edge stays inside the canvas', () => {
    // Canvas is 210 mm wide. User clicks near the right edge at
    // canvas-mm (190, 5), (205, 5), (205, 25) with bboxOrigin (50, 50).
    // LOCAL: (140, -45), (155, -45), (155, -25).
    //
    // After Round 15 the element must land at canvas-mm (190, 5)
    // and span to (205, 25) — INSIDE the canvas.
    const el = buildPolygonElementFromVertices(
      [140, -45, 155, -45, 155, -25],
      1,
      { x: 50, y: 50 },
    );
    if (el.type === 'shape' && el.shape === 'polygon') {
      expect(el.x).toBe(190);
      expect(el.y).toBe(5);
      expect(el.x + el.width).toBeLessThanOrEqual(210);  // inside canvas
      expect(el.y + el.height).toBeLessThanOrEqual(297); // inside canvas
    } else {
      throw new Error('expected shape=polygon');
    }
  });
});
