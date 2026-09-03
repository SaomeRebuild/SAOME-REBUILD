/**
 * Unit tests for StampGridPreview.utils.ts.
 *
 * `calculateCellSize` is a pure function with no DOM dependencies, so we
 * exercise it directly. The expected values come from the formula in
 * StampGridPreview.utils.ts:
 *
 *   usableH = stripHeight - 2*STRIP_INNER_PADDING
 *   usableW = stripWidth - 2*STRIP_INNER_PADDING
 *   cellByHeight = (usableH - CELL_GAP*(rows-1)) / rows
 *   cellByWidth  = (usableW - CELL_GAP*4) / 5
 *   return max(MIN_CELL_SIZE, floor(min(cellByHeight, cellByWidth)))
 *
 * Worked examples (STRIP_INNER_PADDING=8, CELL_GAP=4, stripWidth=256):
 *
 *   stripHeight=120:
 *     rows 1 → 44, rows 2 → 44, rows 3 → 32, rows 4 → 23
 *
 *   stripHeight=100 (compact):
 *     rows 1 → 44, rows 2 → 40, rows 3 → 25, rows 4 → 18
 *
 * Any drift from these numbers means the visual layout in PassCardPreviewStrip
 * has shifted away from the locked-in design; fix the formula, not the tests.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCellSize,
  STRIP_INNER_PADDING,
  CELL_GAP,
  MIN_CELL_SIZE,
  DEFAULT_STRIP_WIDTH,
} from './StampGridPreview.utils';

describe('StampGridPreview.utils constants', () => {
  it('STRIP_INNER_PADDING is 8 (matches plan §3)', () => {
    expect(STRIP_INNER_PADDING).toBe(8);
  });

  it('CELL_GAP is 4 (matches plan §3)', () => {
    expect(CELL_GAP).toBe(4);
  });

  it('MIN_CELL_SIZE is 8 (matches plan §3)', () => {
    expect(MIN_CELL_SIZE).toBe(8);
  });

  it('DEFAULT_STRIP_WIDTH is 256 (matches plan §3)', () => {
    expect(DEFAULT_STRIP_WIDTH).toBe(256);
  });
});

describe('calculateCellSize (normal strip h=120)', () => {
  it('rows=1 → 44 (capped by width)', () => {
    expect(calculateCellSize(1, 120, 256)).toBe(44);
  });

  it('rows=2 → 44 (capped by width)', () => {
    expect(calculateCellSize(2, 120, 256)).toBe(44);
  });

  it('rows=3 → 32 (capped by height)', () => {
    expect(calculateCellSize(3, 120, 256)).toBe(32);
  });

  it('rows=4 → 23 (capped by height)', () => {
    expect(calculateCellSize(4, 120, 256)).toBe(23);
  });
});

describe('calculateCellSize (compact strip h=100)', () => {
  it('rows=1 → 44 (still width-bound)', () => {
    expect(calculateCellSize(1, 100, 256)).toBe(44);
  });

  it('rows=2 → 40 (height-bound)', () => {
    expect(calculateCellSize(2, 100, 256)).toBe(40);
  });

  it('rows=3 → 25 (height-bound)', () => {
    expect(calculateCellSize(3, 100, 256)).toBe(25);
  });

  it('rows=4 → 18 (height-bound; corrected from plan §3 typo of 19)', () => {
    expect(calculateCellSize(4, 100, 256)).toBe(18);
  });
});

describe('calculateCellSize edge cases', () => {
  it('falls back to MIN_CELL_SIZE when rows=0 (defensive)', () => {
    expect(calculateCellSize(0, 120, 256)).toBe(MIN_CELL_SIZE);
  });

  it('falls back to MIN_CELL_SIZE when strip is too short (h=50, rows=5)', () => {
    // usableH = 50 - 16 = 34; cellByHeight = (34 - 16)/5 = 3.6
    // cellByWidth = 44.8; min = 3.6, floor = 3, max(MIN_CELL_SIZE, 3) = 8
    expect(calculateCellSize(5, 50, 256)).toBe(MIN_CELL_SIZE);
  });

  it('uses DEFAULT_STRIP_WIDTH when stripWidth is omitted', () => {
    // Same as calculateCellSize(1, 120) with stripWidth=256
    expect(calculateCellSize(1, 120)).toBe(44);
  });

  it('result is always >= MIN_CELL_SIZE even when floor(min) is negative', () => {
    // rows=1, stripHeight=8: usableH = 8 - 16 = -8 (negative)
    // cellByHeight = (-8 - 0)/1 = -8; min = -8; floor = -8; max(MIN, -8) = MIN
    expect(calculateCellSize(1, 8, 256)).toBe(MIN_CELL_SIZE);
  });
});
