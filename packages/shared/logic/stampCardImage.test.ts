/**
 * Stamp Card Image Composition Logic — unit tests (2026-10-13).
 *
 * All helpers in `stampCardImage.ts` are pure (no DOM, no canvas, no
 * fetch), so we exercise them directly. No test doubles needed.
 *
 * The numbers below come from the formulas documented in
 * `packages/shared/logic/stampCardImage.ts`. Any drift from these
 * values means the visual layout in `PassCardPreviewStrip` or the
 * rendered stamp card image has shifted away from the locked-in
 * design; fix the formula, not the tests.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveStampImagePath,
  calculateStampCellSize,
  computeStampGridLayout,
  resolveCellStampState,
  isGridFullyStampable,
} from './stampCardImage';
import {
  STAMP_FILL_CAP,
  STAMP_DEFAULT_CANVAS,
  STAMP_CELL_GAP,
  STAMP_CANVAS_INNER_PADDING,
} from '../constants/stampCard';

describe('resolveStampImagePath', () => {
  it('returns "0.png" for the empty template (CardBuilder pre-render target)', () => {
    expect(resolveStampImagePath(0)).toBe('0.png');
  });

  it('returns "N.png" for each fill count up to the cap', () => {
    for (let i = 0; i <= STAMP_FILL_CAP; i++) {
      expect(resolveStampImagePath(i)).toBe(`${i}.png`);
    }
  });

  it('returns "15.png" at the cap (the last file Scanner writes)', () => {
    expect(resolveStampImagePath(STAMP_FILL_CAP)).toBe(`${STAMP_FILL_CAP}.png`);
  });

  it('throws RangeError on negative fillCount', () => {
    expect(() => resolveStampImagePath(-1)).toThrow(RangeError);
    expect(() => resolveStampImagePath(-100)).toThrow(RangeError);
  });

  it('throws RangeError on fillCount above the cap (defense-in-depth)', () => {
    expect(() => resolveStampImagePath(STAMP_FILL_CAP + 1)).toThrow(RangeError);
  });

  it('throws RangeError on non-integer fillCount', () => {
    expect(() => resolveStampImagePath(1.5)).toThrow(RangeError);
    expect(() => resolveStampImagePath(0.1)).toThrow(RangeError);
  });

  it('error message references the cap constant (not a stale literal)', () => {
    expect(() => resolveStampImagePath(99)).toThrow(/out of range \[0, 15\]/);
  });
});

describe('calculateStampCellSize (default 1024×640 canvas)', () => {
  it('rows=1, cols=5 → width-bound (full cell width)', () => {
    // usableW = 1024 - 16 = 1008; cellByWidth = (1008 - 16)/5 = 198.4
    // usableH = 640 - 16 = 624; cellByHeight = 624
    // min = 198.4; floor = 198
    expect(calculateStampCellSize(1, 5, 1024, 640)).toBe(198);
  });

  it('rows=3, cols=5 → 3-row height-bound (the common case)', () => {
    // usableH = 624; cellByHeight = (624 - 8)/3 = 205.33
    // usableW = 1008; cellByWidth = 198.4
    // min = 198.4; floor = 198
    expect(calculateStampCellSize(3, 5, 1024, 640)).toBe(198);
  });

  it('rows=4, cols=5 → 4-row height-bound', () => {
    // usableH = 624; cellByHeight = (624 - 12)/4 = 153
    // cellByWidth = 198.4
    // min = 153; floor = 153
    expect(calculateStampCellSize(4, 5, 1024, 640)).toBe(153);
  });

  it('returns 1 (not 0) on degenerate inputs (rows=0 / cols=0)', () => {
    expect(calculateStampCellSize(0, 5, 1024, 640)).toBe(1);
    expect(calculateStampCellSize(1, 0, 1024, 640)).toBe(1);
  });

  it('returns 1 (not 0) on canvas too small for any cells', () => {
    // canvas 20x20: usableH = 4, usableW = 4; cellByHeight and cellByWidth are < 0
    expect(calculateStampCellSize(5, 5, 20, 20)).toBe(1);
  });
});

describe('computeStampGridLayout (3×5 default — CardBuilder common case)', () => {
  const layout = computeStampGridLayout(3, 5);

  it('returns the default canvas when no override is passed', () => {
    expect(layout.canvas).toEqual({
      width: STAMP_DEFAULT_CANVAS.width,
      height: STAMP_DEFAULT_CANVAS.height,
    });
  });

  it('returns 15 cells for a 3×5 grid (one per stamp position)', () => {
    expect(layout.cells).toHaveLength(15);
  });

  it('cells are in row-major order (row 0 left to right, then row 1, etc.)', () => {
    // Cell 0: top-left; cell 4: top-right; cell 5: second-row left; cell 9: second-row right; cell 10: third-row left; cell 14: bottom-right
    const c0 = layout.cells[0];
    const c4 = layout.cells[4];
    const c5 = layout.cells[5];
    const c9 = layout.cells[9];
    const c10 = layout.cells[10];
    const c14 = layout.cells[14];

    expect(c0.index).toBe(0);
    expect(c4.index).toBe(4);
    expect(c5.index).toBe(5);
    expect(c14.index).toBe(14);

    // Row 0 cells share the same y; row 1 cells share a different y; row 2 shares with row 1's neighbor.
    expect(c0.y).toBe(c4.y);
    expect(c5.y).toBe(c9.y);
    expect(c10.y).toBe(c14.y);
    expect(c5.y).not.toBe(c0.y);
    expect(c10.y).not.toBe(c5.y);

    // Cells in the same row have increasing x.
    expect(c0.x).toBeLessThan(c4.x);
    expect(c5.x).toBeLessThan(c9.x);
    expect(c10.x).toBeLessThan(c14.x);
  });

  it('all cells are equal-sized squares', () => {
    const firstSize = layout.cells[0].size;
    for (const cell of layout.cells) {
      expect(cell.size).toBe(firstSize);
    }
  });

  it('all cells are inside the canvas with positive coordinates', () => {
    for (const cell of layout.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.size).toBeLessThanOrEqual(layout.canvas.width);
      expect(cell.y + cell.size).toBeLessThanOrEqual(layout.canvas.height);
    }
  });

  it('uses the inner padding + cell gap constants (defense against drift)', () => {
    // The first cell must start at STAMP_CANVAS_INNER_PADDING + centering offset.
    // The second cell (column 1, row 0) must be exactly cellSize + STAMP_CELL_GAP
    // pixels to the right of the first.
    const c0 = layout.cells[0];
    const c1 = layout.cells[1];
    expect(c1.x - c0.x).toBe(c0.size + STAMP_CELL_GAP);
  });

  it('gridWidth = cellSize*cols + gap*(cols-1)', () => {
    expect(layout.gridWidth).toBe(
      layout.cellSize * 5 + STAMP_CELL_GAP * 4,
    );
  });

  it('gridHeight = cellSize*rows + gap*(rows-1)', () => {
    expect(layout.gridHeight).toBe(
      layout.cellSize * 3 + STAMP_CELL_GAP * 2,
    );
  });

  it('respects an explicit canvas override', () => {
    const small = computeStampGridLayout(3, 5, 256, 256);
    expect(small.canvas).toEqual({ width: 256, height: 256 });
    // Cell size must shrink to fit the smaller canvas.
    expect(small.cellSize).toBeLessThan(layout.cellSize);
  });
});

describe('resolveCellStampState (the first fillCount cells are stamped)', () => {
  it('returns "stamped" for indices below fillCount', () => {
    expect(resolveCellStampState(0, 5)).toBe('stamped');
    expect(resolveCellStampState(4, 5)).toBe('stamped');
  });

  it('returns "unstamped" for indices at or above fillCount', () => {
    expect(resolveCellStampState(5, 5)).toBe('unstamped');
    expect(resolveCellStampState(14, 5)).toBe('unstamped');
  });

  it('returns all "stamped" when fillCount=STAMP_FILL_CAP (the cap state)', () => {
    for (let i = 0; i < 15; i++) {
      expect(resolveCellStampState(i, STAMP_FILL_CAP)).toBe('stamped');
    }
  });

  it('returns all "unstamped" when fillCount=0 (the empty template)', () => {
    for (let i = 0; i < 15; i++) {
      expect(resolveCellStampState(i, 0)).toBe('unstamped');
    }
  });
});

describe('isGridFullyStampable (cap-vs-grid warning helper)', () => {
  it('returns true for grids that fit within the cap (1×5, 2×5, 3×5)', () => {
    expect(isGridFullyStampable(1, 5)).toBe(true);
    expect(isGridFullyStampable(2, 5)).toBe(true);
    expect(isGridFullyStampable(3, 5)).toBe(true);
  });

  it('returns false for 4×5 (20 cells) — clip happens at 15', () => {
    expect(isGridFullyStampable(4, 5)).toBe(false);
  });

  it('returns true for 3×3 (9 cells, common smaller config)', () => {
    expect(isGridFullyStampable(3, 3)).toBe(true);
  });
});
