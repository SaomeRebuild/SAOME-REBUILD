/**
 * Shared image crop types for LogoUploader / useImageCrop.
 *
 * These types are platform-agnostic — both web (Vite) and RN (Metro)
 * import them. Web-only HTML / DOM types must NOT live here.
 *
 * @module shared/types/imageCrop
 */

/**
 * Crop state for the user's drag/zoom gesture.
 *
 * `offsetX`/`offsetY` are CSS pixels (web) or screen-independent units (RN).
 * `focalX`/`focalY` are the source-of-truth for export — re-derived from
 * the offset via `syncFocalFromOffset` (see shared/logic/imageCrop).
 */
export interface CropState {
  /** Focal point X (0-1, relative to original image width). */
  focalX: number;
  /** Focal point Y (0-1, relative to original image height). */
  focalY: number;
  /** Zoom scale (1 = 100%, 0.5 = 50%, 2 = 200%). */
  scale: number;
  /** Natural width of the original image. */
  naturalWidth: number;
  /** Natural height of the original image. */
  naturalHeight: number;
  /** Pan offset X in CSS pixels (drag-to-move on top of centered layout). */
  offsetX?: number;
  /** Pan offset Y in CSS pixels. */
  offsetY?: number;
  /** Resolved base canvas width in CSS px for the loaded image. For images
   *  smaller than the requested `baseCanvasWidth`, this stores
   *  `min(naturalWidth, baseCanvasWidth)` so the srcSquareSize formula uses
   *  the same base canvas the UI renders. Set by the component (e.g.
   *  LogoUploader) after image load; defaults to 0 before then. */
  resolvedBaseCanvasWidth?: number;
}

/**
 * Validation error returned by `validateLogoFile`.
 *
 * `message` is an i18n KEY (not a literal string) so the same validation
 * works for both web and RN — each platform provides its own translations.
 *
 * @see apps/frontend/src/i18n/locales/logoUpload.{zh-TW,en}.ts
 *      (and the equivalent RN i18n module)
 */
export interface ValidationError {
  type: 'tooSmall' | 'tooLarge' | 'wrongFormat';
  /** i18n key (e.g. 'logoUpload.validation.tooLarge'). */
  message: string;
}

/**
 * Minimal file-like interface that both web `File` and RN native file
 * pickers conform to. The validation function only needs `type` and `size`,
 * so we keep the contract tiny for cross-platform reuse.
 */
export interface FileLike {
  /** MIME type (e.g. 'image/png', 'image/jpeg'). */
  type: string;
  /** File size in bytes. */
  size: number;
}
