/**
 * PreviewWrapper — tests for the prop-chain wiring (2026-09-04 stamp correction).
 *
 * The wrapper must forward every PassCardPreview prop, including
 * `stampGridRows` and `stampIconId`. Without this plumbing, the editor's
 * Step 3 stamp controls could mutate the store but the preview would
 * silently keep showing the default hero — exactly the bug we're fixing.
 *
 * Mobile preview size (2026-09-10): the wrapper must pass `compact={false}`
 * (non-compact sizing) when viewport < 1024px (Tailwind `lg:` breakpoint,
 * matching MobilePreviewPanel's `lg:hidden` and CardBuilderEditorPreview's
 * `hidden lg:flex`). The non-compact path produces a barcode that takes
 * ~25-30% of card width — matching real Apple Wallet on a phone. Desktop
 * (≥ 1024px) keeps `compact={true}` so the existing right-column preview
 * is unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PreviewWrapper } from './PreviewWrapper';

// Mock the manifest so any stamp lookup in PassCardPreview is deterministic.
vi.mock('@/assets/icons/stamps/manifest', () => ({
  STAMP_ICONS: [
    { id: 'bell', stampedUrl: '/stamped/bell.png', unstampedUrl: '/unstamped/bell.png' },
  ],
  STAMP_ICON_IDS: ['bell'],
  getStampIcon: (id: string) =>
    id === 'bell'
      ? { id: 'bell', stampedUrl: '/stamped/bell.png', unstampedUrl: '/unstamped/bell.png' }
      : undefined,
}));

/**
 * Helper: stub window.matchMedia so the wrapper's `useIsMobile(1024)`
 * returns the desired value. The query is `(max-width: 1023px)` (one less
 * than 1024 per useIsMobile convention, see Rule 014 sm/lg breakpoints).
 *
 * The global setup.ts mock returns `matches: false` for everything except
 * `(prefers-color-scheme: dark)`, so by default `useIsMobile(1024)` returns
 * false — meaning `compact={true}` (desktop right-column behavior, no test
 * override needed for existing assertions). Tests in the mobile describe
 * block override this with `matches: true`.
 */
function stubMatchMedia(matches: boolean): () => void {
  const original = window.matchMedia;
  const targetQuery = '(max-width: 1023px)';
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const isTarget = query === targetQuery;
    return {
      matches: isTarget ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
  return () => {
    window.matchMedia = original;
  };
}

describe('PreviewWrapper — stamp prop forwarding (2026-09-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards stampGridRows and stampIconId to PassCardPreview (PhoneFrame branch)', () => {
    // PhoneFrame branch is the default; we use the bare-card branch below
    // to bypass PhoneFrame DOM noise and assert PassCardPreview receives
    // the stamp props.
    const { container } = render(
      <PreviewWrapper
        name="Test"
        cardType="stamp_card"
        stampIconId="bell"
        stampGridRows={3}
        showPhoneFrame={false}
      />,
    );
    // PassCardPreview exposes the strip; the stamp grid test-id appears
    // when ALL THREE gating conditions are met (cardType + iconId + rows).
    const grid = container.querySelector('[data-testid="stamp-grid-preview"]');
    expect(grid).not.toBeNull();
    expect(grid?.getAttribute('data-rows')).toBe('3');
  });

  it('does NOT render the stamp grid when stampIconId is empty (gating contract)', () => {
    const { container } = render(
      <PreviewWrapper
        name="Test"
        cardType="stamp_card"
        stampIconId=""
        stampGridRows={2}
        showPhoneFrame={false}
      />,
    );
    expect(container.querySelector('[data-testid="stamp-grid-preview"]')).toBeNull();
  });

  it('does NOT render the stamp grid for non-stamp cardType', () => {
    const { container } = render(
      <PreviewWrapper
        name="Test"
        cardType="cashback_card"
        stampIconId="bell"
        stampGridRows={2}
        showPhoneFrame={false}
      />,
    );
    expect(container.querySelector('[data-testid="stamp-grid-preview"]')).toBeNull();
  });
});

// ─── Mobile preview size (2026-09-10) ──────────────────────────────────────
// The wrapper must pass `compact={false}` when the viewport is below the
// `lg` Tailwind breakpoint (1024px) so the barcode renders at real
// Apple-Wallet proportions on a phone (QR ~27% of card width vs 17% on
// desktop). Desktop keeps `compact={true}` so the existing right-column
// preview is unchanged.
describe('PreviewWrapper — mobile preview size (2026-09-10)', () => {
  let restoreMatchMedia: () => void;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses compact QR size (h-16 w-16) on desktop viewport (≥ lg)', () => {
    // Default global matchMedia mock returns matches=false for
    // (max-width: 1023px) → useIsMobile(1024) returns false →
    // compact={true} → QR uses h-16 w-16 (64px).
    const { container } = render(
      <PreviewWrapper name="Test" side="front" showPhoneFrame={true} />,
    );
    // Find the QR code <img> by its alt. PassCardPreviewFooter's
    // compact QR class is `h-16 w-16 object-contain`. Non-compact is
    // `h-20 w-20 object-contain`. Default barcodeType when omitted is
    // 'qr_code' (see PassCardPreviewFooter default).
    const qrImg = container.querySelector('img[alt="Barcode"]') as HTMLImageElement;
    expect(qrImg).toBeInTheDocument();
    expect(qrImg.className).toContain('h-16');
    expect(qrImg.className).toContain('w-16');
    expect(qrImg.className).not.toContain('h-20');
    expect(qrImg.className).not.toContain('w-20');
  });

  it('uses non-compact QR size (h-20 w-20) on mobile viewport (< lg)', () => {
    restoreMatchMedia = stubMatchMedia(true);
    try {
      const { container } = render(
        <PreviewWrapper name="Test" side="front" showPhoneFrame={true} />,
      );
      const qrImg = container.querySelector('img[alt="Barcode"]') as HTMLImageElement;
      expect(qrImg).toBeInTheDocument();
      expect(qrImg.className).toContain('h-20');
      expect(qrImg.className).toContain('w-20');
      expect(qrImg.className).not.toContain('h-16');
      expect(qrImg.className).not.toContain('w-16');
    } finally {
      restoreMatchMedia();
    }
  });

  it('uses non-compact PDF417 size (h-32 w-[200px]) on mobile viewport', () => {
    restoreMatchMedia = stubMatchMedia(true);
    try {
      const { container } = render(
        <PreviewWrapper
          name="Test"
          side="front"
          barcodeType="pdf_417"
          showPhoneFrame={true}
        />,
      );
      const pdfImg = container.querySelector('img[alt="Barcode"]') as HTMLImageElement;
      expect(pdfImg).toBeInTheDocument();
      // Non-compact PDF417: h-32 w-[200px]
      expect(pdfImg.className).toContain('h-32');
      expect(pdfImg.className).toContain('w-[200px]');
      // Should NOT have compact PDF417 classes
      expect(pdfImg.className).not.toContain('h-24');
      expect(pdfImg.className).not.toContain('w-[160px]');
    } finally {
      restoreMatchMedia();
    }
  });

  it('uses compact PDF417 size (h-24 w-[160px]) on desktop viewport (regression guard)', () => {
    // Default desktop matchMedia mock (matches=false) — existing behavior.
    const { container } = render(
      <PreviewWrapper
        name="Test"
        side="front"
        barcodeType="pdf_417"
        showPhoneFrame={true}
      />,
    );
    const pdfImg = container.querySelector('img[alt="Barcode"]') as HTMLImageElement;
    expect(pdfImg).toBeInTheDocument();
    expect(pdfImg.className).toContain('h-24');
    expect(pdfImg.className).toContain('w-[160px]');
  });

  it('bare-card branch (showPhoneFrame=false) is NOT affected by viewport — keeps compact=false default', () => {
    // Even on mobile, the bare-card branch should not flip compact based
    // on viewport — it's used by tests (jsdom has no real layout) and
    // non-preview embedding contexts. Mobile-aware sizing is meaningful
    // only inside the PhoneFrame + bottom-sheet container.
    restoreMatchMedia = stubMatchMedia(true);
    try {
      const { container } = render(
        <PreviewWrapper name="Test" side="front" showPhoneFrame={false} />,
      );
      const qrImg = container.querySelector('img[alt="Barcode"]') as HTMLImageElement;
      expect(qrImg).toBeInTheDocument();
      // Bare-card branch defaults to compact={false} (PassCardPreview prop
      // default), so the QR class is h-20 w-20 — NOT h-16 w-16.
      expect(qrImg.className).toContain('h-20');
      expect(qrImg.className).toContain('w-20');
    } finally {
      restoreMatchMedia();
    }
  });
});
