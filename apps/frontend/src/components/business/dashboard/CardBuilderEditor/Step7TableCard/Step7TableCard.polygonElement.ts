/**
 * Step7TableCard — polygon element builder.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.polygonElement
 * @description Pure helpers shared by the canvas (Round 10 in-`<Group>`
 * finish button + Konva handler) and the Inspector ("完成" button
 * inside the `polygon-creation-hint` panel).
 *
 * Round 14 (2026-09-27) — extracted from `Step7TableCardCanvas.web.tsx`.
 * Before the refactor, the Inspector called `addShape('polygon', { points:
 * pts, vertexCount: n })` which hardcoded `x: 50, y: 50, width: 60,
 * height: 40` — so the resulting element rendered with a 60×40 bbox but
 * stored points in element-LOCAL coords (relative to `bboxOrigin`). When
 * the user's clicks spanned > 60 mm (the common case), most vertices
 * landed outside the bbox and the polygon appeared *off the canvas* in
 * the layers list (Bug 2).
 *
 * The fix: compute the bbox from the actual vertices, rebase points to
 * bbox-local coords, and let Canvas + Inspector share the same builder
 * so there's exactly ONE source of truth for the "polygon element from
 * raw pointer clicks" pipeline.
 *
 * Round 15 (2026-09-27) — coordinate-space fix (Bug 3).
 *
 * `buildPolygonElementFromVertices` previously returned an element with
 * `x = localMinX, y = localMinY` — i.e. coordinates in the LOCAL frame
 * (relative to `polygonCreation.bboxOrigin`). But the Konva renderer
 * treats `el.x / el.y` as **canvas-absolute mm**:
 *
 *   <Line x={mmToPx(el.x)} y={mmToPx(el.y)} points={pts} ... />
 *
 * The result: when the user drew near the canvas boundary (e.g. clicked
 * at canvas-mm (10, 10) with bboxOrigin = (50, 50)), the LOCAL vertex
 * was (-40, -40) and the stored element landed at el.x = -40, el.y = -40
 * — i.e. 50 mm **outside** the canvas. The user saw the polygon "jump
 * off the canvas" precisely because the resulting shape's bbox didn't
 * include the bboxOrigin offset.
 *
 * Fix: pass `bboxOrigin` (canvas-absolute mm) into the builder and
 * translate the local bbox into canvas-absolute before returning. The
 * stored `points` array remains bbox-local so the renderer's
 * `x + points[i]` math lines up with the preview's
 * `bboxOrigin + vertex` rendering math.
 *
 * ## Why a separate file (not in `shared/logic/`)
 *
 * The `TableCardElement` schema in `packages/shared/schemas/card.ts`
 * could host this helper, but the function touches React/Konva-adjacent
 * knowledge (we want to test it next to its callers). Co-locating with
 * the web-only Step 7 components is the pragmatic choice. If the
 * mobile (RN) side eventually grows the same pipeline, we move this to
 * `packages/shared/logic/tableCard.ts` at that point.
 */

import type { TableCardElement } from '@saome/shared/schemas/card';

/** Axis-aligned bounding box (top-left + size) in the same coords as the input. */
export interface PolygonBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the axis-aligned bbox of a Konva flat points array
 * `[x0, y0, x1, y1, ...]`.
 *
 * Returns `{ x: 0, y: 0, width: 0, height: 0 }` when there are fewer
 * than 2 vertices — the canvas calls this defensively while previewing.
 */
export function computePolygonBbox(points: readonly number[]): PolygonBbox {
  if (points.length < 2) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < points.length; i += 2) {
    const px = points[i];
    const py = points[i + 1];
    if (typeof px !== 'number' || typeof py !== 'number') continue;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  // The bbox must always have a positive area so the Konva.Line + hit
  // detection can pick it up. A degenerate polygon (all clicks land on
  // the same px) clamps to 1×1 so the user can still select + delete
  // it from the layers panel.
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Rebase a flat points array so the returned array is local to its own
 * bbox (top-left at 0,0). The Konva polygon `<Line>` is rendered inside
 * a `<Group>` positioned at the element's `(x, y)` on the canvas, so
 * the `points` field must be local-coords.
 *
 * Returns an empty array when input has fewer than 2 entries (defensive).
 */
export function rebasePolygonPointsToBboxLocal(
  points: readonly number[],
): number[] {
  if (points.length < 2) return [];
  const bbox = computePolygonBbox(points);
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const px = points[i];
    const py = points[i + 1];
    if (typeof px !== 'number' || typeof py !== 'number') continue;
    out.push(px - bbox.x, py - bbox.y);
  }
  return out;
}

/**
 * Build a `TableCardElement` of kind `'polygon'` from raw vertices
 * collected during polygon-creation mode.
 *
 * `vertices` is a Konva flat array of **element-LOCAL mm** coords
 * (relative to `polygonCreation.bboxOrigin`, the format the store
 * already stores). The element's returned `x` / `y` are
 * **CANVAS-ABSOLUTE mm** (the format the renderer expects):
 *
 *   el.x = localBbox.minX + bboxOrigin.x   (canvas-mm)
 *   el.y = localBbox.minY + bboxOrigin.y   (canvas-mm)
 *
 * `bboxOrigin` is required so this builder can perform the
 * local → canvas translation in one place; both Canvas and Inspector
 * callers pass `polygonCreation.bboxOrigin`.
 *
 * `width` / `height` are the bbox span (positive, ≥ 1) — same in
 * both frames since the offset cancels.
 *
 * `points` is rebased to bbox-local so the Konva renderer's
 * `x + points[i]` math (e.g. `<Line x={mmToPx(el.x)} points={[...]} />`)
 * matches the preview's `bboxOrigin + vertex` rendering math.
 *
 * Caller is responsible for passing a fresh `nextZ` (= max existing
 * zIndex + 1; the store's `addTableCardElement` doesn't auto-assign).
 *
 * @example
 *   // bboxOrigin = (50, 50); user clicks at canvas (60, 60), (110, 60),
 *   // (60, 90) → LOCAL vertices (10, 10), (60, 10), (10, 40).
 *   const el = buildPolygonElementFromVertices(
 *     [10, 10, 60, 10, 10, 40], // local mm
 *     1,                          // zIndex
 *     { x: 50, y: 50 },           // bboxOrigin
 *   );
 *   // el.x === 60   ← canvas-absolute (50 + 10)
 *   // el.y === 60   ← canvas-absolute (50 + 10)
 *   // el.width === 50  ← bbox span (same in local & canvas frames)
 *   // el.height === 30 ← bbox span
 *   // el.points === [0, 0, 50, 0, 0, 30]  ← rebased to bbox-local
 */
export function buildPolygonElementFromVertices(
  vertices: readonly number[],
  nextZ: number,
  bboxOrigin: { x: number; y: number },
  idFactory: () => string = () => crypto.randomUUID(),
): TableCardElement {
  const localBbox = computePolygonBbox(vertices);
  const localPts = rebasePolygonPointsToBboxLocal(vertices);
  return {
    id: idFactory(),
    type: 'shape',
    shape: 'polygon',
    // Translate local-bbox → canvas-absolute mm so the element lands
    // exactly where the user drew it (Round 15 Bug 3 fix). Without
    // this offset, vertices stored in bbox-local coords render at
    // canvas-mm (localBbox.x, localBbox.y) — which is `bboxOrigin`
    // short of where the user clicked.
    x: localBbox.x + bboxOrigin.x,
    y: localBbox.y + bboxOrigin.y,
    width: localBbox.width,
    height: localBbox.height,
    rotation: 0,
    zIndex: nextZ,
    // Polygon defaults match the canvas renderer (Round 10).
    fill: '#3b82f6',
    stroke: '#3b82f6',
    strokeWidth: 0,
    points: localPts,
    vertexCount: localPts.length / 2,
  };
}

/**
 * Helper for the Inspector / canvas finish handlers: compute the next
 * zIndex from existing elements + build a polygon element.
 *
 * Pure function; the caller still calls `addTableCardElement(el)`
 * to commit the result to the store (store keeps `addElement` as the
 * single mutation point).
 */
export function nextPolygonZIndex(
  existing: readonly TableCardElement[],
): number {
  return existing.reduce((max, el) => (el.zIndex > max ? el.zIndex : max), -1) + 1;
}
