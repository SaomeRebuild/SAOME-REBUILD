/**
 * Stamp Card Image Composition Logic (2026-10-13).
 *
 * @module shared/logic/stampCardImage
 * @description Pure helpers for the stamp card image composition pipeline.
 *
 * Two responsibilities:
 *   1. `resolveStampImagePath` — convert a fill count to the canonical R2
 *      file name (`{n}.png`). Centralized so the upload service, the
 *      DB row writer, and the renderer's "what file would I write"
 *      queries all agree on the file naming.
 *   2. `computeStampGridLayout` — pure layout math: given a stamp card
 *      configuration, return the per-cell `(x, y, size)` coordinates
 *      that the renderer draws to. The same math is used by the React
 *      preview (`StampGridPreview`) and the Canvas renderer, so visual
 *      parity is enforced at the source of truth rather than re-derived
 *      in two places.
 *
 * Both helpers are **0 platform dependencies** (no DOM, no canvas, no
 * fetch). They can be unit-tested without any test doubles and are
 * safe to import from React Native (Rule 024 § Mobile Future-Proof).
 *
 * Cross-references:
 *   - packages/shared/constants/stampCard.ts (STAMP_FILL_CAP, STAMP_GRID_LINE_COLOR, STAMP_DEFAULT_CANVAS, STAMP_CELL_GAP, STAMP_CANVAS_INNER_PADDING)
 *   - apps/frontend/src/components/business/stampCard/StampGridPreview/StampGridPreview.utils.ts (the legacy layout math — `calculateCellSize`)
 *   - apps/frontend/src/components/business/stampCard/StampCardImageComposer/composeStampCardImage.web.ts (the only consumer of these helpers)
 */

import {
  STAMP_FILL_CAP,
  STAMP_DEFAULT_CANVAS,
  STAMP_CANVAS_INNER_PADDING,
  STAMP_CELL_GAP,
} from '../constants/stampCard';

/**
 * Resolve a fill count to the canonical R2 file name.
 *
 * Convention: `${fillCount}.png`. Returns `'0.png'` for the empty
 * template (CardBuilder's pre-render target), `'1.png'` through
 * `'15.png'` for the filled states (Scanner's incremental writes).
 *
 * Throws `RangeError` on out-of-range input:
 *   - Negative `fillCount` (would generate files like `-1.png`)
 *   - `fillCount > STAMP_FILL_CAP` (cost cap exceeded; should not happen
 *     because the schema rejects the input earlier, but this is a
 *     defense-in-depth guard for direct callers)
 *
 * The error message references the constant so a future bump to
 * `STAMP_FILL_CAP` (e.g. from 15 to 30) does not produce a stale
 * "out of [0, 15]" string in the runtime error.
 *
 * @param fillCount Number of cells to mark as stamped. Must be an integer
 *                  in `[0, STAMP_FILL_CAP]`.
 * @returns Canonical file name (e.g. `'0.png'`, `'15.png'`).
 * @throws RangeError on out-of-range input.
 */
export function resolveStampImagePath(fillCount: number): string {
  if (!Number.isInteger(fillCount)) {
    throw new RangeError(
      `resolveStampImagePath: fillCount must be an integer, got ${fillCount}`,
    );
  }
  if (fillCount < 0 || fillCount > STAMP_FILL_CAP) {
    throw new RangeError(
      `resolveStampImagePath: fillCount ${fillCount} out of range [0, ${STAMP_FILL_CAP}]`,
    );
  }
  return `${fillCount}.png`;
}

/**
 * Per-cell layout descriptor. `x` and `y` are the cell's top-left
 * position in canvas pixels; `size` is the cell's square dimension
 * (cells are always square, mirroring the existing preview layout).
 */
export interface StampCellLayout {
  x: number;
  y: number;
  size: number;
  /** Index of this cell in row-major order (0..rows*cols-1). */
  index: number;
}

/**
 * Full grid layout — the renderer iterates over `cells` and draws
 * each one in turn. `gridWidth` / `gridHeight` describe the bounding
 * box of the grid itself (excluding the canvas's outer padding).
 */
export interface StampGridLayout {
  cells: StampCellLayout[];
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  /** Canvas dimensions used (defaults to `STAMP_DEFAULT_CANVAS` when no override). */
  canvas: { width: number; height: number };
}

/**
 * Compute the largest square cell size that fits inside the given
 * canvas, given the requested grid (rows × cols) and the gap between
 * cells.
 *
 * The formula takes the minimum of two constraints:
 *   - Height-bound: `(usableHeight - rowGaps) / rows`
 *   - Width-bound: `(usableWidth - colGaps) / cols`
 *
 * Returns the floored minimum, clamped to at least `1` (zero would
 * produce invisible cells).
 *
 * Mirrors the `calculateCellSize` function in
 * `StampGridPreview.utils.ts` but generalized to take `cols` as a
 * parameter (the existing utility hard-codes 5 columns via
 * `STAMPS_PER_ROW`).
 *
 * @param rows Grid row count (1..4 per the existing UI constraint).
 * @param cols Grid column count (1..5 per the schema constraint).
 * @param canvasWidth Canvas width in pixels.
 * @param canvasHeight Canvas height in pixels.
 * @returns Square cell size in pixels (≥ 1, integer).
 */
export function calculateStampCellSize(
  rows: number,
  cols: number,
  canvasWidth: number,
  canvasHeight: number,
): number {
  if (rows <= 0 || cols <= 0) return 1;
  const usableH = canvasHeight - 2 * STAMP_CANVAS_INNER_PADDING;
  const usableW = canvasWidth - 2 * STAMP_CANVAS_INNER_PADDING;
  if (usableH <= 0 || usableW <= 0) return 1;
  const cellByHeight = (usableH - STAMP_CELL_GAP * (rows - 1)) / rows;
  const cellByWidth = (usableW - STAMP_CELL_GAP * (cols - 1)) / cols;
  return Math.max(1, Math.floor(Math.min(cellByHeight, cellByWidth)));
}

/**
 * Compute the full grid layout: per-cell coordinates + bounding box.
 *
 * The grid is centered horizontally and vertically inside the canvas's
 * padded area. Cells are arranged in row-major order (row 0 left to
 * right, then row 1 left to right, etc.), which is the order the
 * `fillCount` index counts in: the first `fillCount` cells are
 * rendered as "stamped", the rest as "unstamped".
 *
 * The renderer does **not** read `fillCount` here — that decision is
 * made at the draw call. This function returns the layout only.
 *
 * @param rows Grid row count (1..4).
 * @param cols Grid column count (1..5).
 * @param canvasWidth Optional canvas width override (defaults to
 *                    `STAMP_DEFAULT_CANVAS.width`).
 * @param canvasHeight Optional canvas height override (defaults to
 *                     `STAMP_DEFAULT_CANVAS.height`).
 * @returns `StampGridLayout` with all per-cell positions and the
 *          bounding box dimensions.
 */
export function computeStampGridLayout(
  rows: number,
  cols: number,
  canvasWidth: number = STAMP_DEFAULT_CANVAS.width,
  canvasHeight: number = STAMP_DEFAULT_CANVAS.height,
): StampGridLayout {
  const cellSize = calculateStampCellSize(rows, cols, canvasWidth, canvasHeight);
  const gridWidth = cellSize * cols + STAMP_CELL_GAP * (cols - 1);
  const gridHeight = cellSize * rows + STAMP_CELL_GAP * (rows - 1);
  const offsetX = STAMP_CANVAS_INNER_PADDING
    + Math.max(0, Math.floor((canvasWidth - 2 * STAMP_CANVAS_INNER_PADDING - gridWidth) / 2));
  const offsetY = STAMP_CANVAS_INNER_PADDING
    + Math.max(0, Math.floor((canvasHeight - 2 * STAMP_CANVAS_INNER_PADDING - gridHeight) / 2));

  const cells: StampCellLayout[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      cells.push({
        x: offsetX + col * (cellSize + STAMP_CELL_GAP),
        y: offsetY + row * (cellSize + STAMP_CELL_GAP),
        size: cellSize,
        index,
      });
    }
  }

  return {
    cells,
    gridWidth,
    gridHeight,
    cellSize,
    canvas: { width: canvasWidth, height: canvasHeight },
  };
}

/**
 * Determine which icon variant a cell at the given index should use,
 * given a `fillCount`.
 *
 * Pure function: cells with `index < fillCount` are "stamped" (filled
 * icon); cells with `index >= fillCount` are "unstamped" (outline
 * icon). The decision is a single comparison — no side effects.
 *
 * @param cellIndex 0-based row-major cell index.
 * @param fillCount Number of cells to mark as stamped (0..15).
 * @returns `'stamped'` if the cell is in the first `fillCount`
 *          positions, `'unstamped'` otherwise.
 */
export function resolveCellStampState(
  cellIndex: number,
  fillCount: number,
): 'stamped' | 'unstamped' {
  return cellIndex < fillCount ? 'stamped' : 'unstamped';
}

/**
 * Sanity check: is the given `rows × cols` product within the cost cap?
 *
 * The cap is `STAMP_FILL_CAP = 15`, but a template can declare a
 * `rows × cols` larger than 15 (e.g. a 4×5 = 20 grid). When the
 * physical grid exceeds the cap, the renderer will only ever stamp
 * the first 15 cells, and the user is informed via this helper at
 * the call site (so the UI can show a "this template's max is 15
 * stamps" warning).
 *
 * @returns `true` if the entire grid can be fully stamped, `false` if
 *          the cap clips the grid.
 */
export function isGridFullyStampable(rows: number, cols: number): boolean {
  return rows * cols <= STAMP_FILL_CAP;
}
