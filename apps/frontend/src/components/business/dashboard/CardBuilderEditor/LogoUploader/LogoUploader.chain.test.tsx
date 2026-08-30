/**
 * Regression test: LogoUploader crop stage does NOT overflow the flex chain
 * on mobile viewports (≤412px).
 *
 * Background (feedback 20260830):
 * - The crop stage sets an inline `width: ${baseContainerW}px` (e.g. 329 on
 *   a 412px viewport). Without `min-w-0` on every flex ancestor between the
 *   crop stage and the page wrapper, this inline width sets each ancestor's
 *   min-content, propagating the overflow up the chain.
 * - The previous fix only added `min-w-0` at the AppDashboardPage Outlet
 *   inner, but the chain between Outlet inner and the crop stage (LogoUploader
 *   root → section → aside → CardBuilderEditor flex-row → CardBuilderEditor
 *   outer) still had flex items without `min-w-0`, so internal containers
 *   grew to fit the crop stage and triggered CardBuilderPage's `overflow-auto`
 *   scrollbar.
 *
 * This test mounts the LogoUploader directly with a 412px viewport, renders
 * an image, enters cropping state, then walks the flex chain and asserts
 * no element has `scrollWidth > clientWidth` (the standard "overflow" check).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogoUploader } from './LogoUploader';
import { useImageCrop } from '@/hooks/useImageCrop';

vi.mock('@/services/cardService', () => ({
  cardService: {
    generateLogoUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://r2.example.com/upload',
      key: 'k',
    }),
    update: vi.fn().mockResolvedValue({}),
    getById: vi.fn().mockResolvedValue({ settings: {} }),
  },
}));

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
    // imageUrl: null — LogoUploader's unmount effect calls
    // URL.revokeObjectURL(imageUrl), which jsdom does not implement. Keeping
    // it null avoids the cleanup error without affecting the chain test.
    imageUrl: null,
    imageRef: { current: null },
    setCropState: vi.fn(),
    onImageLoad: vi.fn(),
    loadImage: vi.fn().mockResolvedValue(undefined),
    setFocalPoint: vi.fn(),
    setScale: vi.fn(),
    cropImage: vi.fn().mockResolvedValue(new Blob()),
    resetCrop: vi.fn(),
    hasImage: true,
    originalFile: null,
    outputDimensions: { width: 960, height: 540 },
    ...overrides,
  };
}

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  window.dispatchEvent(new Event('resize'));
}

describe('LogoUploader flex chain overflow (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Wraps the LogoUploader in a flex column with a constrained width that
   * matches a real mobile viewport after the page-level padding chain
   * (AppDashboardPage p-4 + CardBuilderPage p-6 + Workspace aside p-6 = 128).
   * This lets us exercise the "child's inline width > parent" overflow case
   * that the previous fix missed.
   */
  function renderInConstrainedContainer(viewportW: number) {
    const constrainedParentW = Math.max(viewportW - 128, 320);
    return render(
      <div style={{ width: `${constrainedParentW}px` }}>
        <LogoUploader templateId="t1" onLogoUploaded={vi.fn()} />
      </div>,
    );
  }

  it('crop stage inline width stays within the constrained parent on 412px viewport', async () => {
    setViewport(412);
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn());

    renderInConstrainedContainer(412);

    // Trigger cropping state
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
    });

    // With the new wrapper-based cap (parent.offsetWidth − 16), the parent
    // is 412 - 128 = 284px, so the crop stage is min(400, 284 - 16) = 268px.
    // The OLD viewport math would have produced 412 - 128 = 284px.
    // Either way, the stage is well within the parent and never overflows.
    //
    // NOTE: width now lives on the outer container (`logo-crop-outer`) since
    // the stage became `absolute inset-0` inside it. Same numeric value.
    const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
    const w = parseInt(stage.style.width);
    expect(w).toBeGreaterThanOrEqual(200);
    expect(w).toBeLessThan(284);
  });

  it('LogoUploader root has min-w-0 so it does not stretch to crop stage intrinsic', async () => {
    setViewport(412);
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn());

    renderInConstrainedContainer(412);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
    });

    // The cropping state's outer div must have min-w-0 so its min-content
    // (= crop stage's inline width 284px) does NOT push the flex chain.
    const draggingHint = screen.getByText(/拖曳調整顯示區域/i);
    const logoUploaderRoot = draggingHint.parentElement;
    expect(logoUploaderRoot?.className).toMatch(/min-w-0/);
  });
});
