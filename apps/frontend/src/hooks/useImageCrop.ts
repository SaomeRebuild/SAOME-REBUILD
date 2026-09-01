/**
 * useImageCrop — Client-side image cropping hook with zoom support.
 *
 * RN migration:
 * - Canvas API is web-only — this hook MUST be wrapped with a platform check.
 * - For RN, use a native image cropping library (e.g., react-native-image-crop-picker).
 *
 * This hook stays identical; only the platform-specific cropImage() changes.
 *
 * @module hooks/useImageCrop
 * @description Handles image cropping with focal point and zoom scale.
 */

import { useState, useCallback, useRef } from 'react';
import type { CropState } from '@saome/shared/types';
import { cropImageOnWeb } from './useImageCrop.web';
// computeSrcSquareSize moved to @saome/shared/logic/imageCrop (Phase A).
// Imported here directly to avoid circular references through the barrel.
import { computeSrcSquareSize } from '@saome/shared/logic/imageCrop';
// Re-export for backwards-compatible `@/hooks/useImageCrop` consumers (single source).
export { computeSrcSquareSize };

/**
 * Platform-specific cropImage signature shared by web and native impls.
 * Both `useImageCrop.web.ts` and `useImageCrop.native.ts` conform to this.
 *
 * The 6 environment-derived parameters are passed explicitly (no closure
 * capture of constants) — this keeps the function pure and RN-migration-safe.
 *
 * outputWidth/outputHeight are the final canvas dimensions in pixels:
 *   - Logo (variant='logo'):      outputWidth=960, outputHeight=null  → 960×NH aspect
 *   - Icon (variant='icon'):       outputWidth=720, outputHeight=720  → 720×720 square
 *   - Background (variant='background'): outputWidth=1860, outputHeight=738 → 1860×738 landscape
 *
 * cropWindowWidth / cropWindowHeight describe the UI mask in CSS px.
 * They can be equal (square mask for logo/icon) or different (rectangular
 * mask for background). When they differ, the binding uses
 * `computeSrcRegion` instead of `computeSrcSquareSize`.
 */
export type CropImageFn = (
  image: HTMLImageElement,
  cropState: CropState,
  cropWindowWidth: number,
  cropWindowHeight: number,
  baseCanvasWidth: number,
  outputWidth: number,
  outputHeight: number | null,
) => Promise<Blob>;

/**
 * Currently active platform-specific cropImage function.
 *
 * Web build: imports `cropImageOnWeb` (Canvas-based drawImage + toBlob).
 * Native build (future RN): swap to `cropImageOnNative` stub here.
 *
 * `@/hooks/useImageCrop` consumers (LogoUploader.handleApplyCrop) receive the
 * resolved binding through the hook return value; they remain platform-agnostic.
 */
const cropImageImpl: CropImageFn = cropImageOnWeb;

export interface UseImageCropOptions {
  /** Output width in pixels (used for canvas width). */
  outputWidth: number;
  /** Output height in pixels. Pass null for flexible height (preserves aspect ratio). */
  outputHeight: number | null;
  /** UI crop window width in CSS px (default: 200). Must match the visible
      crop window in the editor so the exported crop region corresponds to
      what the user sees. */
  cropWindowWidth?: number;
  /** UI crop window height in CSS px (default: same as cropWindowWidth for
      backward compatibility with the legacy square-crop variants). For
      non-square masks (background, future variants), set this to the mask
      height — the binding will derive the rectangular src region via
      `computeSrcRegion` to preserve output aspect. */
  cropWindowHeight?: number;
  /** UI base canvas width in CSS px (default: 400). Must match the canvas
      the image is rendered into before the scale transform. */
  baseCanvasWidth?: number;
  /** Minimum zoom scale (default: 0.5). */
  minScale?: number;
  /** Maximum zoom scale (default: 3.0). */
  maxScale?: number;
  /** Initial scale (default: 1.0). */
  initialScale?: number;
}

export interface UseImageCropReturn {
  /** Current crop state. */
  cropState: CropState;
  /** Raw state setter (use for functional updates that need current state). */
  setCropState: React.Dispatch<React.SetStateAction<CropState>>;
  /** Image element reference (set by onImageLoad callback). */
  imageRef: React.RefObject<HTMLImageElement | null>;
  /** Callback to set image element and detect dimensions on load. */
  onImageLoad: (el: HTMLImageElement | null) => void;
  /** Load a new image file and reset crop state to center. */
  loadImage: (file: File) => Promise<void>;
  /** Update focal point (0-1 range). */
  setFocalPoint: (x: number, y: number) => void;
  /** Update zoom scale (clamped to min/max). */
  setScale: (scale: number) => void;
  /** Crop the loaded image to a Blob using the current crop state. */
  cropImage: () => Promise<Blob>;
  /** Reset crop state to defaults (center focal, default scale). */
  resetCrop: () => void;
  /** Whether an image is currently loaded. */
  hasImage: boolean;
  /** Original file (for upload). */
  originalFile: File | null;
  /** Loaded image URL (for preview). */
  imageUrl: string | null;
  /** Computed output dimensions based on natural dimensions (width capped at 960). */
  outputDimensions: { width: number; height: number };
}

/**
 * Hook for client-side image cropping with focal point and zoom.
 *
 * @example
 * ```tsx
 * const { loadImage, setFocalPoint, setScale, cropImage, hasImage, imageUrl } = useImageCrop({
 *   outputWidth: 960,
 *   outputHeight: 960,
 * });
 *
 * const handleCrop = async () => {
 *   const blob = await cropImage();
 *   // Upload blob to R2
 * };
 * ```
 */
const DEFAULT_MIN_SCALE = 0.5;
const DEFAULT_MAX_SCALE = 3.0;
const DEFAULT_INITIAL_SCALE = 1.0;
const DEFAULT_CROP_WINDOW_SIZE = 200;
const DEFAULT_BASE_CANVAS_WIDTH = 400;
/** Fallback output width — used only when caller does not supply outputWidth. */
const DEFAULT_OUTPUT_WIDTH = 960;

export function useImageCrop(options: UseImageCropOptions): UseImageCropReturn {
  const {
    outputWidth,
    outputHeight,
    cropWindowWidth = DEFAULT_CROP_WINDOW_SIZE,
    cropWindowHeight = cropWindowWidth, // backward compat: square crop when height not specified
    baseCanvasWidth = DEFAULT_BASE_CANVAS_WIDTH,
    minScale = DEFAULT_MIN_SCALE,
    maxScale = DEFAULT_MAX_SCALE,
    initialScale = DEFAULT_INITIAL_SCALE,
  } = options;

  const [cropState, setCropState] = useState<CropState>({
    focalX: 0.5,
    focalY: 0.5,
    scale: initialScale,
    naturalWidth: 0,
    naturalHeight: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  /**
   * Callback to set image element and detect dimensions when image loads.
   * Use this as the ref callback on the <img> element.
   */
  const onImageLoad = useCallback((el: HTMLImageElement | null) => {
    imageRef.current = el;
    if (el && el.complete && el.naturalWidth > 0) {
      // Image already loaded
      setCropState((prev) => ({
        ...prev,
        naturalWidth: el.naturalWidth,
        naturalHeight: el.naturalHeight,
      }));
      setIsImageLoaded(true);
    }
  }, []);

  const clamp = useCallback(
    (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    [],
  );

  const loadImage = useCallback(
    async (file: File) => {
      // Revoke previous object URL to avoid memory leaks
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      // Reset loaded state
      setIsImageLoaded(false);

      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setImageUrl(url);
      setOriginalFile(file);

      // We'll wait for the image to load via the ref callback
      // For now, just reset crop state and let the DOM img handle loading
      setCropState({
        focalX: 0.5,
        focalY: 0.5,
        scale: initialScale,
        naturalWidth: 0,
        naturalHeight: 0,
        offsetX: 0,
        offsetY: 0,
      });

      // The actual dimension detection happens via onLoad callback on the img element
      // This is handled by the component that passes setImageRef
    },
    [initialScale],
  );

  const setFocalPoint = useCallback(
    (x: number, y: number) => {
      setCropState((prev) => ({
        ...prev,
        focalX: clamp(x, 0, 1),
        focalY: clamp(y, 0, 1),
      }));
    },
    [clamp],
  );

  const setScale = useCallback(
    (scale: number) => {
      setCropState((prev) => ({
        ...prev,
        scale: clamp(scale, minScale, maxScale),
      }));
    },
    [clamp, minScale, maxScale],
  );

  const cropImage = useCallback(async (): Promise<Blob> => {
    const img = imageRef.current;
    if (!img) {
      throw new Error('No image loaded');
    }
    // Resolve fallback at call-time so callers can override defaults via options.
    const resolvedOutputWidth = outputWidth ?? DEFAULT_OUTPUT_WIDTH;
    const resolvedOutputHeight = outputHeight ?? null; // null → preserve aspect ratio (square-by-width)
    return cropImageImpl(
      img,
      cropState,
      cropWindowWidth,
      cropWindowHeight,
      baseCanvasWidth,
      resolvedOutputWidth,
      resolvedOutputHeight,
    );
  }, [cropState, cropWindowWidth, cropWindowHeight, baseCanvasWidth, outputWidth, outputHeight]);

  const resetCrop = useCallback(() => {
    setCropState({
      focalX: 0.5,
      focalY: 0.5,
      scale: initialScale,
      naturalWidth: cropState.naturalWidth,
      naturalHeight: cropState.naturalHeight,
      offsetX: 0,
      offsetY: 0,
    });
  }, [initialScale, cropState.naturalWidth, cropState.naturalHeight]);

  const hasImage = imageUrl !== null && isImageLoaded;

  // Output dimensions: width capped at 960, height flexible
  const MAX_LOGO_WIDTH = 960;
  const logoW = cropState.naturalWidth > 0
    ? Math.min(cropState.naturalWidth, MAX_LOGO_WIDTH)
    : MAX_LOGO_WIDTH;
  const logoH = cropState.naturalWidth > 0
    ? Math.round((cropState.naturalHeight / cropState.naturalWidth) * logoW)
    : 0;

  return {
    cropState,
    setCropState,
    imageRef,
    onImageLoad,
    loadImage,
    setFocalPoint,
    setScale,
    cropImage,
    resetCrop,
    hasImage,
    originalFile,
    imageUrl,
    outputDimensions: { width: logoW, height: logoH },
  };
}
