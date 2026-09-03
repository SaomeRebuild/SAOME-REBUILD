/**
 * Tests for StampGridPreview — render behaviour.
 *
 * The manifest module is mocked so tests are deterministic (we don't need
 * real PNGs to verify the grid logic). The cellSize formula has its own
 * unit tests in StampGridPreview.utils.test.ts; here we focus on render
 * shape (cell count, stamped vs unstamped, fallback).
 *
 * 2026-09-04 stamp correction additions:
 *   - Lock down cell-size differences across 1..4 rows so a future
 *     formula tweak can't silently flatten the grid.
 *   - Lock down cell-size response to narrow strip widths so the strip
 *     measurement plumbing (PassCardPreviewStrip → StampGridPreview)
 *     stays effective.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StampGridPreview } from './StampGridPreview';

vi.mock('@/assets/icons/stamps/manifest', () => ({
  getStampIcon: vi.fn((id: string) => {
    if (id === 'bell') {
      return {
        id: 'bell',
        stampedUrl: '/stamped/bell.png',
        unstampedUrl: '/unstamped/bell.png',
      };
    }
    if (id === 'fire') {
      return {
        id: 'fire',
        stampedUrl: '/stamped/fire.png',
        unstampedUrl: '/unstamped/fire.png',
      };
    }
    return undefined;
  }),
}));

describe('StampGridPreview rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 1×5 = 5 cells for rows=1', () => {
    render(<StampGridPreview iconId="bell" rows={1} stripHeight={120} />);
    const grid = screen.getByTestId('stamp-grid-preview');
    expect(grid).toBeInTheDocument();
    expect(grid.getAttribute('data-rows')).toBe('1');
    expect(grid.getAttribute('data-cols')).toBe('5');
    expect(screen.getAllByTestId(/stamp-cell-/).length).toBe(5);
  });

  it('renders 2×5 = 10 cells for rows=2', () => {
    render(<StampGridPreview iconId="bell" rows={2} stripHeight={120} />);
    expect(screen.getAllByTestId(/stamp-cell-/).length).toBe(10);
  });

  it('renders 3×5 = 15 cells for rows=3', () => {
    render(<StampGridPreview iconId="bell" rows={3} stripHeight={120} />);
    expect(screen.getAllByTestId(/stamp-cell-/).length).toBe(15);
  });

  it('renders 4×5 = 20 cells for rows=4', () => {
    render(<StampGridPreview iconId="bell" rows={4} stripHeight={120} />);
    expect(screen.getAllByTestId(/stamp-cell-/).length).toBe(20);
  });

  it('marks the first 3 cells as stamped (default stampedCount)', () => {
    render(<StampGridPreview iconId="bell" rows={2} stripHeight={120} />);
    const stamped = screen.getAllByTestId('stamp-cell-stamped');
    const unstamped = screen.getAllByTestId('stamp-cell-unstamped');
    expect(stamped.length).toBe(3);
    expect(unstamped.length).toBe(7);
  });

  it('honours a custom stampedCount', () => {
    render(<StampGridPreview iconId="bell" rows={2} cols={5} stampedCount={5} stripHeight={120} />);
    expect(screen.getAllByTestId('stamp-cell-stamped').length).toBe(5);
    expect(screen.getAllByTestId('stamp-cell-unstamped').length).toBe(5);
  });

  it('uses stampedUrl for stamped cells and unstampedUrl for the rest', () => {
    render(<StampGridPreview iconId="bell" rows={1} stripHeight={120} />);
    const stampedImgs = screen.getAllByTestId('stamp-cell-stamped').map(
      (cell) => cell.querySelector('img'),
    );
    const unstampedImgs = screen.getAllByTestId('stamp-cell-unstamped').map(
      (cell) => cell.querySelector('img'),
    );
    stampedImgs.forEach((img) => expect(img).toHaveAttribute('src', '/stamped/bell.png'));
    unstampedImgs.forEach((img) => expect(img).toHaveAttribute('src', '/unstamped/bell.png'));
    // sanity: 1 row × 5 cols, 3 stamped + 2 unstamped
    expect(stampedImgs.length).toBe(3);
    expect(unstampedImgs.length).toBe(2);
    expect(stampedImgs.length + unstampedImgs.length).toBe(5);
  });

  it('renders placeholder block (no img) for unknown iconId', () => {
    render(<StampGridPreview iconId="unknown" rows={1} stripHeight={120} />);
    expect(screen.queryByRole('img')).toBeNull();
    // Each cell has a placeholder span instead
    const cells = screen.getAllByTestId(/stamp-cell-/);
    cells.forEach((cell) => expect(cell.querySelector('span')).not.toBeNull());
  });

  it('renders placeholder block (no img) when iconId is empty string', () => {
    render(<StampGridPreview iconId="" rows={1} stripHeight={120} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('iconOverride bypasses the manifest lookup', () => {
    render(
      <StampGridPreview
        iconId="bell"
        rows={1}
        stripHeight={120}
        iconOverride={{ stampedUrl: '/override-stamped.png', unstampedUrl: '/override-unstamped.png' }}
      />,
    );
    const stampedImg = screen.getAllByTestId('stamp-cell-stamped')[0]?.querySelector('img');
    expect(stampedImg).toHaveAttribute('src', '/override-stamped.png');
  });
});

describe('StampGridPreview cell size data attribute', () => {
  it('exposes the computed cellSize for tests / Storybook (rows=4, h=120 → 23)', () => {
    render(<StampGridPreview iconId="bell" rows={4} stripHeight={120} />);
    expect(screen.getByTestId('stamp-grid-preview').getAttribute('data-cell-size')).toBe('23');
  });

  // 2026-09-04 stamp correction: cell size MUST scale with stripWidth so
  // narrow cards (mobile bottom sheet, side-by-side previews) don't crop
  // icons. PassCardPreviewStrip now forwards its measured width; this test
  // confirms the cell-size formula actually responds to that input.
  it('cell size shrinks when stripWidth is narrow', () => {
    const { rerender } = render(
      <StampGridPreview iconId="bell" rows={2} stripHeight={120} stripWidth={320} />,
    );
    const wideCellSize = Number(
      screen.getByTestId('stamp-grid-preview').getAttribute('data-cell-size'),
    );

    rerender(
      <StampGridPreview iconId="bell" rows={2} stripHeight={120} stripWidth={160} />,
    );
    const narrowCellSize = Number(
      screen.getByTestId('stamp-grid-preview').getAttribute('data-cell-size'),
    );

    expect(narrowCellSize).toBeLessThan(wideCellSize);
  });

  // 2026-09-04 stamp correction: cell size MUST change across 1..4 rows
  // (height-bound math kicks in for 3+ rows). If a future refactor makes
  // the cell size independent of rows, the grid will visually collapse.
  it('cell size changes as rows increase (1 < 4)', () => {
    const { rerender } = render(
      <StampGridPreview iconId="bell" rows={1} stripHeight={120} stripWidth={320} />,
    );
    const rows1CellSize = Number(
      screen.getByTestId('stamp-grid-preview').getAttribute('data-cell-size'),
    );

    rerender(
      <StampGridPreview iconId="bell" rows={4} stripHeight={120} stripWidth={320} />,
    );
    const rows4CellSize = Number(
      screen.getByTestId('stamp-grid-preview').getAttribute('data-cell-size'),
    );

    expect(rows4CellSize).toBeLessThan(rows1CellSize);
    // Sanity: both values are positive and reasonable
    expect(rows1CellSize).toBeGreaterThan(0);
    expect(rows4CellSize).toBeGreaterThan(0);
  });
});
