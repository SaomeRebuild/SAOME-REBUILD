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
import type { CropState } from '@saome/shared/types';

/**
 * Web-only: Crop the loaded image to a variant-driven OUTPUT_WIDTH × OUTPUT_HEIGHT PNG Blob.
 *
 * Output dimensions are passed in (not hardcoded) so the same hook chain can
 * serve any MediaAssetUploader variant:
 *   - Logo (variant='logo'):  outputWidth=960, outputHeight=null  → 960×NH aspect
 *   - Icon  (variant='icon'):  outputWidth=720, outputHeight=720  → 720×720 square
 *
 * @param image       HTMLImageElement (already loaded)
 * @param cropState   current cropping state (focal, scale, dimensions)
 * @param cropWindowSize   UI mask window size in CSS px (matches baseContainerW/2 etc.)
 * @param baseCanvasWidth  UI canvas width in CSS px
 * @param outputWidth    Final canvas width in pixels (e.g. 960 for logo, 720 for icon)
 * @param outputHeight   Final canvas height in pixels, or null to preserve aspect ratio
 * @returns PNG blob (Promise)
 */
export function cropImageOnWeb(
  image: HTMLImageElement,
  cropState: CropState,
  cropWindowSize: number,
  baseCanvasWidth: number,
  outputWidth: number,
  outputHeight: number | null,
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

  // outputHeight === null → preserve aspect ratio (square by outputWidth).
  const finalHeight = outputHeight ?? outputWidth;
  canvas.width = outputWidth;
  canvas.height = finalHeight;
  ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, outputWidth, finalHeight);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob from canvas'))),
      'image/png',
      1.0,
    );
  });
}
