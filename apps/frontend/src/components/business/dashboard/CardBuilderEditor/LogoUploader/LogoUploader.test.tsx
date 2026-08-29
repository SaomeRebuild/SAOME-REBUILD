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
    function setViewport(width: number) {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
      window.dispatchEvent(new Event('resize'));
    }

    /**
     * Trigger the cropping UI by firing a file change. The mocked
     * `loadImage` resolves immediately so LogoUploader flips its local
     * `state` to `'cropping'` and renders the crop stage.
     */
    async function enterCroppingState() {
      render(<LogoUploader templateId="t1" onLogoUploaded={vi.fn()} />);
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['x'], 'logo.png', { type: 'image/png' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
      // The cropping UI shows the "拖曳調整顯示區域" hint.
      await waitFor(() => {
        expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
      });
    }

    it('caps crop container at viewport − 128px (p-4 + p-6 + p-6 chain) on iPhone (375px)', async () => {
      setViewport(375);
      await enterCroppingState();
      const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
      // 375 − 128 (p-4 AppDashboardPage wrapper: 32 + CardBuilderPage p-6: 48 +
      // aside p-6: 48) = 247px. All three padding layers must be subtracted;
      // previously only the two p-6 layers were counted, causing a 32px
      // horizontal overflow on every mobile viewport that stretched the
      // CardBuilderPage wrapper's overflow-auto scrollbar.
      expect(stage.style.width).toBe('247px');
    });

    it('respects narrow phone viewport (320px → 192px container)', async () => {
      setViewport(320);
      await enterCroppingState();
      const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
      // 320 − 128 = 192px (still < CROP_WINDOW_SIZE 200, so the crop stage
      // is floored at 200px — see baseContainerW Math.max in component).
      expect(stage.style.width).toBe('200px');
    });

    /**
     * Bug regression: iPhone 12 Pro Max (1284×2778 native, 428×926 CSS).
     * Before the fix, VIEWPORT_PADDING was 96 (only the two p-6 layers),
     * but the actual horizontal padding chain was 128 (p-4 + p-6 + p-6).
     * The crop stage was sized at 332px but the section content area was
     * only 300px, causing a 32px horizontal overflow that stretched the
     * page and triggered the CardBuilderPage wrapper's `overflow-auto`
     * scrollbar.
     */
    it('caps crop container at viewport − 128px on iPhone 12 Pro Max (428px)', async () => {
      setViewport(428);
      await enterCroppingState();
      const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
      // 428 − 128 = 300px
      expect(stage.style.width).toBe('300px');
    });

    it('uses BASE_CANVAS_WIDTH (400px) on desktop (>= 528px viewport)', async () => {
      setViewport(1024);
      await enterCroppingState();
      const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
      // Desktop: viewport cap is 896px, but BASE_CANVAS_WIDTH=400 wins
      expect(stage.style.width).toBe('400px');
    });

    it('has maxWidth safety net so container never overflows its parent', async () => {
      setViewport(375);
      await enterCroppingState();
      const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
      expect(stage.style.maxWidth).toBe('100%');
    });

    /**
     * Regression: iPhone 12/13/14 standard (390×844 CSS).
     * Confirms the crop stage never overflows on the most common mobile
     * viewport — 390 − 128 = 262px should fit comfortably.
     */
    it('caps crop container at 262px on iPhone 12/13/14 (390px)', async () => {
      setViewport(390);
      await enterCroppingState();
      const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
      // 390 − 128 = 262px
      expect(stage.style.width).toBe('262px');
    });
  });
});
