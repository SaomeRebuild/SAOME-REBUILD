/**
 * PassCardPreviewStrip — tests for the stamp grid render-mode gating AND
 * the strip-width measurement behaviour (2026-09-04 stamp correction).
 *
 * Background (2026-09-04):
 *   The strip has two render modes — default hero (CreditCard + name) and
 *   stamp grid (<StampGridPreview>). `showStampGrid` is gated by THREE
 *   concurrent conditions: cardType ∈ {stamp_card, multipass}, stampIconId
 *   non-empty, stampGridRows defined. Manual testing only ever exercised
 *   the "everything set" path; this test file locks down the OTHER three
 *   failure modes so a future wiring change can't silently regress them.
 *
 *   The strip also measures its actual rendered width via ResizeObserver
 *   and forwards it to StampGridPreview. This test exercises that
 *   measurement by stubbing `getBoundingClientRect` to return narrow /
 *   wide widths and asserting the cell size changes accordingly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PassCardPreviewStrip } from './PassCardPreviewStrip';

// Stamp icon manifest is mocked so the strip grid (when shown) renders
// deterministic stubs without depending on real PNG asset URLs.
vi.mock('@/assets/icons/stamps/manifest', () => ({
  STAMP_ICONS: [
    { id: 'bell', stampedUrl: '/stamped/bell.png', unstampedUrl: '/unstamped/bell.png' },
    { id: 'fire', stampedUrl: '/stamped/fire.png', unstampedUrl: '/unstamped/fire.png' },
  ],
  STAMP_ICON_IDS: ['bell', 'fire'],
  getStampIcon: (id: string) => {
    const map: Record<string, { id: string; stampedUrl: string; unstampedUrl: string }> = {
      bell: { id: 'bell', stampedUrl: '/stamped/bell.png', unstampedUrl: '/unstamped/bell.png' },
      fire: { id: 'fire', stampedUrl: '/stamped/fire.png', unstampedUrl: '/unstamped/fire.png' },
    };
    return map[id];
  },
}));

/**
 * Override the strip's bounding-rect width. jsdom defaults to 1024px-wide
 * viewports and 0-width elements; we need to inject a realistic width
 * so the useLayoutEffect measurement picks up a non-zero value.
 */
function stubStripWidth(width: number) {
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    const rect = original.call(this);
    // Only override the top-level strip div. StampGridPreview (nested)
    // keeps the original rect so its inner cell math uses the same
    // measurement we just stubbed.
    if (this.getAttribute('data-testid') !== 'strip-content' && this.style.backgroundColor === 'rgb(31, 41, 55)') {
      return { ...rect, width, height: rect.height || 120 };
    }
    return rect;
  };
}

describe('PassCardPreviewStrip — render mode gating', () => {
  beforeEach(() => {
    stubStripWidth(256);
  });

  it('shows the strip-content container in all cases (it is always rendered)', () => {
    render(<PassCardPreviewStrip cardType="stamp_card" stampIconId="" stampGridRows={1} />);
    expect(screen.getByTestId('strip-content')).toBeInTheDocument();
  });

  it('renders the DEFAULT hero (no StampGridPreview) when stampIconId is empty even if cardType is stamp_card', () => {
    // The gating condition `Boolean(stampIconId)` prevents the grid from
    // showing when nothing was picked. This is by design (see plan 2026-09-04
    // § issue #5: keep current behavior, just verify it stays wired).
    render(<PassCardPreviewStrip cardType="stamp_card" stampIconId="" stampGridRows={1} />);
    expect(screen.queryByTestId('stamp-grid-preview')).toBeNull();
  });

  it('renders the StampGridPreview when ALL THREE gating conditions are met (stamp_card + icon + rows)', () => {
    render(<PassCardPreviewStrip cardType="stamp_card" stampIconId="bell" stampGridRows={2} />);
    expect(screen.getByTestId('stamp-grid-preview')).toBeInTheDocument();
    // Grid size matches the rows prop
    const preview = screen.getByTestId('stamp-grid-preview');
    expect(preview.getAttribute('data-rows')).toBe('2');
  });

  it('also renders the StampGridPreview for multipass card type (mirrors stamp_card gating)', () => {
    render(<PassCardPreviewStrip cardType="multipass" stampIconId="fire" stampGridRows={3} />);
    expect(screen.getByTestId('stamp-grid-preview')).toBeInTheDocument();
    expect(screen.getByTestId('stamp-grid-preview').getAttribute('data-rows')).toBe('3');
  });

  it('still renders the DEFAULT hero when cardType is NOT stamp_card or multipass (even with icon + rows set)', () => {
    // `cashback_card` should never trigger the stamp grid branch.
    render(<PassCardPreviewStrip cardType="cashback_card" stampIconId="bell" stampGridRows={2} />);
    expect(screen.queryByTestId('stamp-grid-preview')).toBeNull();
  });
});

describe('PassCardPreviewStrip — width measurement (2026-09-04 stamp correction)', () => {
  let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it('exposes the measured strip width via data-strip-width on the strip root', async () => {
    stubStripWidth(320);
    render(<PassCardPreviewStrip cardType="stamp_card" stampIconId="bell" stampGridRows={2} />);
    const strip = screen.getByTestId('strip-content').parentElement!;
    await waitFor(() => expect(strip.getAttribute('data-strip-width')).toBe('320'));
  });

  it('passes the measured strip width to StampGridPreview (wide vs narrow produce different cell sizes)', async () => {
    // Wide strip (320px) → width-bound cells are LARGER
    stubStripWidth(320);
    const { unmount } = render(
      <PassCardPreviewStrip cardType="stamp_card" stampIconId="bell" stampGridRows={3} />,
    );
    const widePreview = screen.getByTestId('stamp-grid-preview');
    await waitFor(() => {
      const size = Number(widePreview.getAttribute('data-cell-size'));
      expect(size).toBeGreaterThan(0);
    });
    const wideCellSize = Number(widePreview.getAttribute('data-cell-size'));
    unmount();

    // Narrow strip (160px) → width-bound cells are SMALLER
    stubStripWidth(160);
    render(<PassCardPreviewStrip cardType="stamp_card" stampIconId="bell" stampGridRows={3} />);
    const narrowPreview = screen.getByTestId('stamp-grid-preview');
    await waitFor(() => {
      const size = Number(narrowPreview.getAttribute('data-cell-size'));
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(wideCellSize);
    });
  });

  it('falls back to DEFAULT_STRIP_WIDTH when measurement is zero (SSR / pre-layout)', async () => {
    // Override getBoundingClientRect to return width=0 (simulating pre-layout)
    HTMLElement.prototype.getBoundingClientRect = function () {
      const rect = originalGetBoundingClientRect.call(this);
      return { ...rect, width: 0, height: 120 };
    };
    render(<PassCardPreviewStrip cardType="stamp_card" stampIconId="bell" stampGridRows={1} />);
    const strip = screen.getByTestId('strip-content').parentElement!;
    // Falls back to DEFAULT_STRIP_WIDTH = 256
    await waitFor(() => expect(strip.getAttribute('data-strip-width')).toBe('256'));
  });

  it('cell size differs across 1..4 rows at the same width (height-bound takes over for 4 rows)', async () => {
    stubStripWidth(320);
    const { unmount: unmount1 } = render(
      <PassCardPreviewStrip cardType="stamp_card" stampIconId="bell" stampGridRows={1} />,
    );
    const preview1 = screen.getByTestId('stamp-grid-preview');
    await waitFor(() => {
      const size = Number(preview1.getAttribute('data-cell-size'));
      expect(size).toBeGreaterThan(0);
    });
    const rows1 = Number(preview1.getAttribute('data-cell-size'));
    unmount1();

    // Re-render with rows=4; height-bound math should produce a smaller cell
    // than rows=1 (more rows means less vertical space per cell).
    render(<PassCardPreviewStrip cardType="stamp_card" stampIconId="bell" stampGridRows={4} />);
    const preview4 = screen.getByTestId('stamp-grid-preview');
    await waitFor(() => {
      const size = Number(preview4.getAttribute('data-cell-size'));
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(rows1);
    });
  });
});
