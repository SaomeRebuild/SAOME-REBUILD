/**
 * Web platform `cropImage()` implementation — uses HTML5 Canvas API.
 *
 * Vite / Metro bundlers automatically select this file (via the `.web.ts`
 * extension) when bundling for browsers. On React Native, Metro would
 * instead resolve `.native.ts`.
 *
 * Pure function — no React state. Exports the actual Canvas-based drawImage
 * + toBlob pipeline. Mirrored exactly in `useImageCrop.native.ts` (which
 * currently throws NotImplementedError — RN migration backlog).
 *
 * @module hooks/useImageCrop.web
 */

import { computeSrcSquareSize } from '@saome/shared/logic/imageCrop';
import { LOGO_CROP_CONFIG } from '@saome/shared/constants/card-images';
import type { CropState } from '@saome/shared/types';

/**
 * Web-only: Crop the loaded image to a 960×960 PNG Blob using the current
 * CropState + the LOGO_CROP_CONFIG's OUTPUT_WIDTH as the output square size.
 *
 * @param image       HTMLImageElement (already loaded)
 * @param cropState   current cropping state (focal, scale, dimensions)
 * @param cropWindowSize  UI mask window size in CSS px (matches baseContainerW/2 etc.)
 * @param baseCanvasWidth UI canvas width in CSS px
 * @returns PNG blob (Promise)
 */
export function cropImageOnWeb(
  image: HTMLImageElement,
  cropState: CropState,
  cropWindowSize: number,
  baseCanvasWidth: number,
): Promise<Blob> {
  const { focalX, focalY, scale, naturalWidth, naturalHeight, resolvedBaseCanvasWidth } = cropState;
  if (naturalWidth === 0 || naturalHeight === 0) {
    return Promise.reject(new Error('Image dimensions not yet available'));
  }
  const effectiveBaseCanvasWidth = resolvedBaseCanvasWidth ?? baseCanvasWidth;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Failed to get canvas context'));
  }

  const MAX_LOGO_SIZE = LOGO_CROP_CONFIG.OUTPUT_WIDTH;

  // Mirror the srcSquareSize computation from cropImage() (see
  // shared/logic/imageCrop.computeSrcSquareSize).
  const srcSquareSize = computeSrcSquareSize(
    cropWindowSize,
    effectiveBaseCanvasWidth,
    scale,
    naturalWidth,
    naturalHeight,
  );

  const rawX = focalX * naturalWidth - srcSquareSize / 2;
  const rawY = focalY * naturalHeight - srcSquareSize / 2;
  const srcX = Math.max(0, rawX);
  const srcY = Math.max(0, rawY);
  const srcW = Math.min(srcSquareSize, naturalWidth - srcX);
  const srcH = Math.min(srcSquareSize, naturalHeight - srcY);

  canvas.width = MAX_LOGO_SIZE;
  canvas.height = MAX_LOGO_SIZE;
  ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, MAX_LOGO_SIZE, MAX_LOGO_SIZE);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob from canvas'))),
      'image/png',
      1.0,
    );
  });
}
