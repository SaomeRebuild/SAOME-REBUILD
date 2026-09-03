/**
 * Pure helpers for the StampGridPreview component.
 *
 * `calculateCellSize` is the load-bearing function for the strip render in
 * PassCardPreviewStrip: it must return the largest square cell size that fits
 * inside the strip's usable area given the requested grid (rows × 5 cols) and
 * the gap between cells. We take `min` of the height-bound and width-bound
 * candidates so the grid never overflows the strip in either axis.
 *
 * Why this lives in `utils.ts` and not inline in the component:
 * - Pure function: trivial to unit-test without rendering React.
 * - Caller-agnostic: PassCardPreviewStrip, the icon picker preview, and the
 *   Storybook story all derive their cellSize from the same formula. If the
 *   design shifts, the formula shifts in exactly one place.
 */

/** Padding between the strip's inner edge and the stamp grid (px). */
export const STRIP_INNER_PADDING = 8;

/** Gap between adjacent stamp cells in the grid (px). */
export const CELL_GAP = 4;

/** Floor on the computed cellSize; prevents the grid from collapsing to 0. */
export const MIN_CELL_SIZE = 8;

/**
 * Default usable width (px) of the strip in the mobile preview canvas.
 *
 * The mobile preview wrapper is approximately 256px wide. We default to this
 * value when the caller does not pass `stripWidth` (e.g. in Storybook), so
 * the preview matches what the user actually sees.
 */
export const DEFAULT_STRIP_WIDTH = 256;

/**
 * Compute the largest square cell size (px) that fits inside the strip given
 * the requested number of rows and 5 columns.
 *
 * The formula takes the minimum of two constraints:
 *   - Height-bound: `(usableHeight - rowGaps) / rows`, where `usableHeight =
 *     stripHeight - 2 * STRIP_INNER_PADDING` and `rowGaps = CELL_GAP * (rows - 1)`.
 *   - Width-bound: `(usableWidth - colGaps) / 5`, where `usableWidth =
 *     stripWidth - 2 * STRIP_INNER_PADDING` and `colGaps = CELL_GAP * 4`
 *     (5 cols → 4 gaps).
 *
 * The result is floored (cells must be integer pixels to align cleanly) and
 * clamped to `MIN_CELL_SIZE` so degenerate inputs (rows=0, strip too short)
 * never produce a non-positive cellSize.
 *
 * @param rows Number of grid rows (1..4).
 * @param stripHeight Total strip height (px), e.g. 120 (normal) or 100 (compact).
 * @param stripWidth Total strip width (px); defaults to `DEFAULT_STRIP_WIDTH`.
 * @returns Cell size in pixels, integer, ≥ `MIN_CELL_SIZE`.
 */
export function calculateCellSize(
  rows: number,
  stripHeight: number,
  stripWidth: number = DEFAULT_STRIP_WIDTH,
): number {
  // Defensive guard: the type signature is `rows: 1 | 2 | 3 | 4`, but if a
  // buggy caller passes 0 or a negative value, the height constraint would
  // divide by zero (→ Infinity) or produce a non-positive cellSize. Return
  // MIN_CELL_SIZE so callers always get a renderable value.
  if (rows <= 0) return MIN_CELL_SIZE;

  const usableH = stripHeight - 2 * STRIP_INNER_PADDING;
  const usableW = stripWidth - 2 * STRIP_INNER_PADDING;
  const cellByHeight = (usableH - CELL_GAP * (rows - 1)) / rows;
  const cellByWidth = (usableW - CELL_GAP * 4) / 5; // 5 cols - 1 = 4 gaps
  return Math.max(
    MIN_CELL_SIZE,
    Math.floor(Math.min(cellByHeight, cellByWidth)),
  );
}
