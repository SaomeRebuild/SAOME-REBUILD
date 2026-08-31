/**
 * Phase 2 diagnostic test — Icon upload preview URL.
 *
 * Goal: isolate whether icon preview broken is a code bug (URL construction,
 * store updates) or a runtime issue (browser DevTools required for CORS,
 * cache, etc).
 *
 * If this test passes, the issue is downstream of the frontend code.
 * If it fails, we have a frontend bug to fix.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MediaAssetUploader } from './MediaAssetUploader';
import { useImageCrop } from '@/hooks/useImageCrop';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

// Mock cardService — return a deterministic R2 key
vi.mock('@/services/cardService', () => ({
  cardService: {
    generateUploadUrl: vi.fn().mockImplementation((_templateId: string, imageType: string) =>
      Promise.resolve({
        uploadUrl: 'https://r2.example.com/upload',
        key: `tenant-1/template-1/${imageType === 'icon' ? 'icon' : 'issuer-logo'}.png`,
        publicUrl: `https://saome-backend.josh1989213.workers.dev/api/cards/template-1/image/${imageType}`,
      }),
    ),
    update: vi.fn().mockResolvedValue({ template: { settings: {} } }),
    getById: vi.fn().mockResolvedValue({ settings: {} }),
  },
}));

// Mock fetch — PUT to R2 succeeds
const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

// Mock useImageCrop — provide a working cropImage
vi.mock('@/hooks/useImageCrop', () => ({
  useImageCrop: vi.fn(),
}));

const baseCropState = {
  focalX: 0.5,
  focalY: 0.5,
  scale: 1.0,
  naturalWidth: 1500,
  naturalHeight: 1500,
  offsetX: 0,
  offsetY: 0,
  resolvedBaseCanvasWidth: 300,
};

function mockImageCropReturn() {
  return {
    cropState: { ...baseCropState },
    imageUrl: null,
    imageRef: { current: { width: 1500, height: 1500 } as HTMLImageElement | null },
    setCropState: vi.fn(),
    onImageLoad: vi.fn(),
    loadImage: vi.fn().mockResolvedValue(undefined),
    setFocalPoint: vi.fn(),
    setScale: vi.fn(),
    cropImage: vi.fn().mockResolvedValue(new Blob(['fake-image-bytes'], { type: 'image/png' })),
    resetCrop: vi.fn(),
    hasImage: true,
    originalFile: null,
    outputDimensions: { width: 720, height: 720 },
  };
}

describe('Phase 2 diagnostic: icon preview after upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to clean state
    useCardBuilderStore.setState({
      iconImage: '',
      iconImageVersion: 0,
      issuerLogo: '',
      issuerLogoVersion: 0,
    });
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn());
    mockFetch.mockResolvedValue({ ok: true, status: 200 } as unknown as Response);
  });

  it('after icon upload, the preview img src contains /image/icon endpoint', async () => {
    render(
      <MediaAssetUploader
        templateId="template-1"
        variant="icon"
        onUploaded={vi.fn()}
      />,
    );

    // Trigger file selection
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'icon-source.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    // Wait for cropping UI
    await waitFor(() => {
      expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
    });

    // Click "套用裁切" (apply crop) — this triggers the full upload flow
    const applyButton = screen.getByRole('button', { name: /套用裁切/i });
    fireEvent.click(applyButton);

    // Wait for the preview to appear (state goes 'success' → idle)
    await waitFor(
      () => {
        const img = document.querySelector(
          'img[data-testid="asset-preview-img"]',
        ) as HTMLImageElement;
        expect(img).toBeTruthy();
      },
      { timeout: 3000 },
    );

    const img = document.querySelector(
      'img[data-testid="asset-preview-img"]',
    ) as HTMLImageElement;
    expect(img.src).toBeTruthy();

    // Critical assertion: the URL must point to the icon image endpoint
    expect(img.src).toMatch(/\/api\/cards\/template-1\/image\/icon/);
    // And must include a cache-busting v= param
    expect(img.src).toMatch(/[?&]v=\d+/);
  });

  it('icon store fields are set after upload (iconImage + iconImageVersion)', async () => {
    render(
      <MediaAssetUploader
        templateId="template-1"
        variant="icon"
        onUploaded={vi.fn()}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'icon-source.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
    });

    const applyButton = screen.getByRole('button', { name: /套用裁切/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      const state = useCardBuilderStore.getState();
      expect(state.iconImage).toBe('tenant-1/template-1/icon.png');
      expect(state.iconImageVersion).toBeGreaterThan(0);
    });
  });
});