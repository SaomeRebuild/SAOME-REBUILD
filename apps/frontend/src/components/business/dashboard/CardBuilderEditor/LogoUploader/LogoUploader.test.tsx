/**
 * LogoUploader tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogoUploader } from './LogoUploader';
import { useImageCrop } from '@/hooks/useImageCrop';

// Mock the cardService
vi.mock('@/services/cardService', () => ({
  cardService: {
    generateLogoUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://r2.example.com/upload',
      key: 'tenant1/template1/issuer-logo.png',
    }),
    update: vi.fn().mockResolvedValue({}),
    getById: vi.fn().mockResolvedValue({ settings: {} }),
  },
}));

// Mock the useImageCrop hook as a vi.fn() so each test can override the
// return value via vi.mocked(useImageCrop).mockReturnValue(...).
vi.mock('@/hooks/useImageCrop', () => ({
  useImageCrop: vi.fn(),
}));

const baseCropState = {
  focalX: 0.5,
  focalY: 0.5,
  scale: 1.0,
  naturalWidth: 1920,
  naturalHeight: 1080,
  offsetX: 0,
  offsetY: 0,
  resolvedBaseCanvasWidth: 400,
};

function mockImageCropReturn(overrides: Record<string, unknown> = {}) {
  return {
    cropState: baseCropState,
    imageUrl: null,
    imageRef: { current: null },
    setCropState: vi.fn(),
    onImageLoad: vi.fn(),
    loadImage: vi.fn().mockResolvedValue(undefined),
    setFocalPoint: vi.fn(),
    setScale: vi.fn(),
    cropImage: vi.fn().mockResolvedValue(new Blob()),
    resetCrop: vi.fn(),
    hasImage: false,
    originalFile: null,
    outputDimensions: { width: 960, height: 540 },
    ...overrides,
  };
}

describe('LogoUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn());
  });

  it('renders upload button when idle', () => {
    render(
      <LogoUploader
        templateId="test-id"
        onLogoUploaded={vi.fn()}
      />,
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows select file button', () => {
    render(
      <LogoUploader
        templateId="test-id"
        onLogoUploaded={vi.fn()}
      />,
    );

    // Button with select file text should exist (i18n: 選擇圖片)
    expect(screen.getByText(/選擇圖片/i)).toBeInTheDocument();
  });

  describe('responsive crop container (mobile)', () => {
    /**
     * Render LogoUploader inside a parent with a known content-box width and
     * trigger ResizeObserver to fire with that width. With the new
     * wrapper-based responsive cap (replaces the old viewport − 128 math),
     * the crop stage width is `min(400, parentWidth − 16)` so the stage
     * NEVER overflows the parent regardless of how many padding wrappers
     * exist above LogoUploader.
     */
    async function renderInParent(parentWidth: number) {
      // Re-mock useImageCrop so each render is fresh
      vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn());
      const { container } = render(
        <div style={{ width: `${parentWidth}px` }} data-testid="constrained-parent">
          <LogoUploader templateId="t1" onLogoUploaded={vi.fn()} />
        </div>,
      );
      // Trigger cropping UI
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['x'], 'logo.png', { type: 'image/png' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
      });
      // Fire ResizeObserver on the LogoUploader root with the parent's content-box width.
      // jsdom offsetWidth is always 0, so we have to drive the measurement via the polyfill.
      // The cropping state's outer wrapper is identified by `data-testid="logo-crop-wrapper"`
      // — that's where the ResizeObserver is attached in LogoUploader. Note: the stage
      // is now `absolute inset-0` inside an outer container, so we can no longer use
      // `cropStage.parentElement` to find the wrapper.
      const { triggerResize } = await import('@/test/setup');
      const root = container.querySelector('[data-testid="logo-crop-wrapper"]');
      // eslint-disable-next-line no-console
      console.log(`[TEST] root=${!!root}, rootTag=${root?.tagName}, rootClassList=${root?.className.slice(0, 60)}`);
      if (!root) throw new Error('cropping wrapper not found');
      triggerResize(root, parentWidth, 800);
      // eslint-disable-next-line no-console
      console.log(`[TEST] triggered resize on root with width=${parentWidth}`);
      // The polyfill schedules the callback via queueMicrotask, then React
      // re-renders. Wait for the new width to land in the DOM.
      const expectedW = Math.min(400, Math.max(parentWidth - 16, 200));
      await waitFor(() => {
        const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
        expect(stage.style.width).toBe(`${expectedW}px`);
      });
    }

    it('caps crop container at parentWidth − 16px on iPhone (375px parent)', async () => {
      await renderInParent(375);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // 375 − 16 (STAGE_SAFETY_MARGIN) = 359px (still < BASE 400)
      expect(stage.style.width).toBe('359px');
    });

    it('respects narrow phone viewport (parentWidth 320 → 304px container)', async () => {
      await renderInParent(320);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // 320 − 16 = 304px (still > CROP_WINDOW_SIZE 200)
      expect(stage.style.width).toBe('304px');
    });

    /**
     * Bug regression: iPhone 12 Pro Max (428×926 native, ~412px CSS after browser chrome).
     * The old viewport-padding math (viewport − 128) missed some wrappers and
     * overflowed by 32px. The new wrapper-based cap uses actual offsetWidth,
     * so the stage always fits the parent content-box minus a 16px safety.
     * Parent cap 412 > BASE 400, so the BASE cap wins (min(400, 412) = 400).
     */
    it('caps crop container at 400px (BASE_CANVAS_WIDTH) on iPhone 12 Pro Max (428px parent)', async () => {
      await renderInParent(428);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // 428 − 16 = 412, but min(400, 412) = 400 (BASE wins)
      expect(stage.style.width).toBe('400px');
    });

    it('uses BASE_CANVAS_WIDTH (400px) on desktop (parentWidth 1024)', async () => {
      await renderInParent(1024);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // Desktop: parent cap is 1008px, but BASE_CANVAS_WIDTH=400 wins (min(400, 1008))
      expect(stage.style.width).toBe('400px');
    });

    it('has maxWidth safety net so container never overflows its parent', async () => {
      await renderInParent(375);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      expect(stage.style.maxWidth).toBe('100%');
    });

    /**
     * Regression: iPhone 12/13/14 standard (390×844 CSS).
     * Confirms the crop stage never overflows on the most common mobile
     * viewport — 390 − 16 = 374px should fit comfortably inside any parent.
     */
    it('caps crop container at 374px on iPhone 12/13/14 (390px parent)', async () => {
      await renderInParent(390);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // 390 − 16 = 374px
      expect(stage.style.width).toBe('374px');
    });

    /**
     * New behavior (regression-proof): the stage is ALWAYS capped at
     * `parentWidth − 16`, regardless of how many wrappers exist. This
     * guarantees no horizontal overflow regardless of how the page layout
     * changes around LogoUploader.
     */
    it('never overflows parent even with multiple padding wrappers (parentWidth 280)', async () => {
      await renderInParent(280);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // 280 − 16 = 264px. Floor at CROP_WINDOW_SIZE 200 (so 264 wins).
      expect(stage.style.width).toBe('264px');
      expect(parseInt(stage.style.width)).toBeLessThan(280);
    });
  });
});
