/**
 * Shared image crop pure functions.
 *
 * All functions in this module are PURE — no DOM, no Canvas, no React state.
 * This makes them:
 *   1. Cross-platform safe (web + RN).
 *   2. Unit-testable without jsdom / canvas mocks.
 *   3. Conformance-testable: any drift from the formula here silently changes
 *      the exported crop region, so shared tests pin the math.
 *
 * @module shared/logic/imageCrop
 * @see .cursor/skills/saome-image-upload/SKILL.md § Crop Window Invariant
 */

import { LOGO_CROP_CONFIG } from '../constants/card-images';
import type { CropState, FileLike, ValidationError } from '../types/imageCrop';

/**
 * Re-derive focalX/focalY from the current offset.
 *
 * focal is the normalized (0-1) position in the src image of the mask
 * window's center — it's the export source of truth (see
 * useImageCrop.cropImage).
 *
 * Geometry:
 *   - Image element rendered at baseContainerW × baseContainerH in the inner
 *     canvas, with transform: translate(offsetX, offsetY), transform-origin
 *     left top.
 *   - Inner canvas wraps with transform: scale(scale) from its center.
 *   - Mask is at outer box center (= baseContainerW/2, baseContainerH/2).
 *   - Mask center in inner-canvas coords (before scale) = baseContainerW/2,
 *     baseContainerH/2 — because scale around the same center is a fixed point.
 *   - Image element local at mask center = (baseContainerW/2 - offsetX,
 *     baseContainerH/2 - offsetY).
 *   - Source X at image local X = (baseContainerW/2 - offsetX) * (NW / baseW).
 *   - focalX = (baseContainerW/2 - offsetX) * NW / baseW / NW
 *             = 0.5 - offsetX / baseContainerW.
 *
 * The earlier formula `(offsetX * scale)` was a Bug-C root cause: drag at
 * scale=2 over-corrected the focal by 2×, causing the exported crop to slide
 * off-center as soon as the user dragged.
 *
 * Pure function — exported for testability.
 *
 * @see https://github.com/SaomeRebuild/SAOME-REBUILD/blob/main/runs/improvements/feedback/20260826-0827-logo-crop-zoom-full-trace.md
 */
export function syncFocalFromOffset(
  prev: CropState,
  baseContainerW: number,
  baseContainerH: number,
): CropState {
  const { offsetX = 0, offsetY = 0 } = prev;
  const focalX = 0.5 - offsetX / baseContainerW;
  const focalY = 0.5 - offsetY / baseContainerH;
  return {
    ...prev,
    focalX: Math.max(0, Math.min(1, focalX)),
    focalY: Math.max(0, Math.min(1, focalY)),
  };
}

/**
 * Compute the new CropState when scale changes, keeping the image's visual
 * position fixed (offsetX/offsetY unchanged). The mask-window center then
 * naturally shows a different — finer — slice of the src image, matching
 * how every photo-editor zoom behaves.
 *
 * focalX/focalY are re-derived from the offset so cropImage() exports
 * exactly the slice the user is currently looking at.
 *
 * EXPLICIT signature (no closure capture of constants) for shared-package
 * purity. The web/RN caller passes the 4 environment-derived parameters.
 *
 * Idempotent: if `targetScale` clamps to the same value as `prev.scale`,
 * returns `prev` unchanged (referential equality preserved for React
 * memo / useCallback bailout).
 *
 * @param prev            Current CropState
 * @param targetScale     Desired scale; will be clamped to [minScale, maxScale]
 * @param baseContainerW  Stage width in CSS px (the dimension offsetX is in)
 * @param baseContainerH  Stage height in CSS px (the dimension offsetY is in)
 * @param minScale        Lower clamp (typically LOGO_CROP_CONFIG.MIN_SCALE)
 * @param maxScale        Upper clamp (typically LOGO_CROP_CONFIG.MAX_SCALE)
 */
export function applyScaleChange(
  prev: CropState,
  targetScale: number,
  baseContainerW: number,
  baseContainerH: number,
  minScale: number,
  maxScale: number,
): CropState {
  const newScale = Math.max(minScale, Math.min(maxScale, targetScale));
  if (newScale === prev.scale) return prev;

  // Offset stays put — image keeps its visual position, mask window now
  // shows a finer slice of the src image. Re-derive focal so export
  // matches what's visible.
  return syncFocalFromOffset({ ...prev, scale: newScale }, baseContainerW, baseContainerH);
}

/**
 * Compute the src-side square size for the exported crop region.
 *
 * Pure function — exported so conformance tests can assert the formula
 * without instantiating React state or invoking canvas APIs.
 *
 * The `naturalHeight` cap is the safety net for landscape images where
 * the conceptual crop window exceeds the stage height — without it, the
 * exported region would be non-square (srcW > srcH) and Canvas would
 * squash the output to fit the 960×960 target.
 *
 * @see shared/logic/imageCrop.test.ts (Landscape srcW===srcH invariant)
 * @see runs/improvements/feedback/20260830-logo-uploader-landscape-squash.md
 */
export function computeSrcSquareSize(
  cropWindowSize: number,
  effectiveBaseCanvasWidth: number,
  scale: number,
  naturalWidth: number,
  naturalHeight: number,
): number {
  return Math.min(
    (cropWindowSize / (effectiveBaseCanvasWidth * scale)) * naturalWidth,
    naturalHeight,
  );
}

/**
 * Validate an uploaded file against the LOGO_CROP_CONFIG constraints.
 *
 * Pure function — returns a ValidationError (with i18n-key message) on
 * failure, or `null` on success. UI rendering of the error message is
 * the consumer's responsibility (translate the key).
 *
 * @param file  Any FileLike (web File, RN asset, etc.)
 * @returns     ValidationError | null
 */
export function validateLogoFile(file: FileLike): ValidationError | null {
  if (!LOGO_CROP_CONFIG.MIME_TYPES.includes(file.type as 'image/png' | 'image/jpeg')) {
    return {
      type: 'wrongFormat',
      message: 'validation.wrongFormat',
    };
  }
  if (file.size > LOGO_CROP_CONFIG.MAX_FILE_SIZE) {
    return {
      type: 'tooLarge',
      message: 'validation.tooLarge',
    };
  }
  return null;
}
