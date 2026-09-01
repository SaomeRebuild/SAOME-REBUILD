/**
 * useImageCrop.web — Phase 7b regression test.
 *
 * Verifies that cropImageOnWeb uses the output dimensions passed in by the
 * caller, not a hardcoded `MAX_LOGO_SIZE = LOGO_CROP_CONFIG.OUTPUT_WIDTH`.
 *
 * Before this fix, calling cropImageOnWeb with `outputWidth: 720, outputHeight: 720`
 * would still produce a 960×960 canvas (the hardcoded LOGO size), violating
 * Passcreator's 720×720 push-notification icon spec and wasting 33% bandwidth.
 */

import { describe, it, expect, vi } from 'vitest';
import { cropImageOnWeb } from './useImageCrop.web';
import type { CropState } from '@saome/shared/types';

function makeCropState(overrides: Partial<CropState> = {}): CropState {
  return {
    focalX: 0.5,
    focalY: 0.5,
    scale: 1,
    naturalWidth: 1440,
    naturalHeight: 1440,
    offsetX: 0,
    offsetY: 0,
    resolvedBaseCanvasWidth: 300,
    ...overrides,
  };
}

describe('useImageCrop.web — Phase 7b: variant-driven output dimensions', () => {
  it('logo variant uses 960×NH aspect (outputHeight=null)', async () => {
    let captured: { width: number; height: number } | null = null;
    const toBlobSpy = vi.fn().mockImplementation((cb: (blob: Blob | null) => void) => {
      cb(new Blob(['x']));
    });
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
      }),
      toBlob: toBlobSpy,
    };
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          // Capture the dimensions set on the canvas right after creation.
          // (MediaAssetUploader sets canvas.width/height BEFORE toBlob.)
          Object.defineProperty(fakeCanvas, 'width', {
            set(v) {
              captured = { ...(captured ?? { width: 0, height: 0 }), width: v };
            },
            get() {
              return captured?.width ?? 0;
            },
          });
          Object.defineProperty(fakeCanvas, 'height', {
            set(v) {
              captured = { ...(captured ?? { width: 0, height: 0 }), height: v };
            },
            get() {
              return captured?.height ?? 0;
            },
          });
          return fakeCanvas as unknown as HTMLCanvasElement;
        }
        return document.createElement(tag);
      });

    const fakeImage = {
      naturalWidth: 1440,
      naturalHeight: 1440,
      complete: true,
    } as unknown as HTMLImageElement;

    try {
      // New 7-arg signature (Phase A — BackgroundUploader L2 plan 2026-09-01):
      // (image, cropState, cropWindowWidth, cropWindowHeight, baseCanvasWidth, outputWidth, outputHeight)
      await cropImageOnWeb(fakeImage, makeCropState(), 150, 300, 300, 960, null);
      expect(captured).toEqual({ width: 960, height: 960 });
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('icon variant uses 720×720 (square, NOT 960×960)', async () => {
    let captured: { width: number; height: number } | null = null;
    const toBlobSpy = vi.fn().mockImplementation((cb: (blob: Blob | null) => void) => {
      cb(new Blob(['x']));
    });
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
      }),
      toBlob: toBlobSpy,
    };
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          Object.defineProperty(fakeCanvas, 'width', {
            set(v) {
              captured = { ...(captured ?? { width: 0, height: 0 }), width: v };
            },
            get() {
              return captured?.width ?? 0;
            },
          });
          Object.defineProperty(fakeCanvas, 'height', {
            set(v) {
              captured = { ...(captured ?? { width: 0, height: 0 }), height: v };
            },
            get() {
              return captured?.height ?? 0;
            },
          });
          return fakeCanvas as unknown as HTMLCanvasElement;
        }
        return document.createElement(tag);
      });

    const fakeImage = {
      naturalWidth: 1440,
      naturalHeight: 1440,
      complete: true,
    } as unknown as HTMLImageElement;

    try {
      // New 7-arg signature (Phase A — BackgroundUploader L2 plan 2026-09-01):
      // (image, cropState, cropWindowWidth, cropWindowHeight, baseCanvasWidth, outputWidth, outputHeight)
      await cropImageOnWeb(fakeImage, makeCropState(), 150, 300, 300, 720, 720);
      expect(captured).toEqual({ width: 720, height: 720 });
    } finally {
      createElementSpy.mockRestore();
    }
  });
});
