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

import { computeSrcRegion, computeSrcSquareSize } from '@saome/shared/logic/imageCrop';
import type { CropState } from '@saome/shared/types';

/**
 * Web-only: Crop the loaded image to a variant-driven OUTPUT_WIDTH × OUTPUT_HEIGHT PNG Blob.
 *
 * Output dimensions are passed in (not hardcoded) so the same hook chain can
 * serve any MediaAssetUploader variant:
 *   - Logo (variant='logo'):      outputWidth=960, outputHeight=null  → 960×NH landscape
 *   - Icon (variant='icon'):        outputWidth=720, outputHeight=720  → 720×720 square
 *   - Background (variant='background'): outputWidth=1860, outputHeight=738 → 1860×738 landscape
 *
 * @param image       HTMLImageElement (already loaded)
 * @param cropState   current cropping state (focal, scale, dimensions)
 * @param cropWindowWidth   UI mask window width in CSS px (matches baseContainerW)
 * @param cropWindowHeight  UI mask window height in CSS px (for non-square variants)
 * @param baseCanvasWidth   UI canvas width in CSS px
 * @param outputWidth        Final canvas width in pixels (e.g. 960 for logo, 1860 for background)
 * @param outputHeight       Final canvas height in pixels, or null to preserve aspect ratio
 * @returns PNG blob (Promise)
 */
export function cropImageOnWeb(
  image: HTMLImageElement,
  cropState: CropState,
  cropWindowWidth: number,
  cropWindowHeight: number,
  baseCanvasWidth: number,
  outputWidth: number,
  outputHeight: number | null,
): Promise<Blob> {
  const {
    focalX,
    focalY,
    scale,
    naturalWidth,
    naturalHeight,
    resolvedBaseCanvasWidth,
  } = cropState;
  if (naturalWidth === 0 || naturalHeight === 0) {
    return Promise.reject(new Error('Image dimensions not yet available'));
  }
  const effectiveBaseCanvasWidth = resolvedBaseCanvasWidth ?? baseCanvasWidth;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Failed to get canvas context'));
  }

  // Determine whether this is a square or rectangular crop.
  // Square: cropWindowWidth === cropWindowHeight (logo, icon).
  // Rectangular: cropWindowWidth !== cropWindowHeight (background).
  const isSquare = cropWindowWidth === cropWindowHeight;

  let srcX: number;
  let srcY: number;
  let srcW: number;
  let srcH: number;

  if (isSquare) {
    // Square crop — use the legacy formula (same as before this refactor).
    const srcSquareSize = computeSrcSquareSize(
      cropWindowWidth,
      effectiveBaseCanvasWidth,
      scale,
      naturalWidth,
      naturalHeight,
    );
    const rawX = focalX * naturalWidth - srcSquareSize / 2;
    const rawY = focalY * naturalHeight - srcSquareSize / 2;
    srcX = Math.max(0, rawX);
    srcY = Math.max(0, rawY);
    srcW = Math.min(srcSquareSize, naturalWidth - srcX);
    srcH = Math.min(srcSquareSize, naturalHeight - srcY);
  } else {
    // Rectangular crop — use computeSrcRegion to guarantee output aspect.
    const region = computeSrcRegion({
      cropWindowWidth,
      cropWindowHeight,
      baseCanvasWidth: effectiveBaseCanvasWidth,
      outputWidth,
      outputHeight: outputHeight ?? outputWidth,
      scale,
      naturalWidth,
      naturalHeight,
      focalX,
      focalY,
    });
    srcX = region.srcX;
    srcY = region.srcY;
    srcW = region.srcW;
    srcH = region.srcH;
  }

  // outputHeight === null → preserve aspect ratio (square by width).
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
