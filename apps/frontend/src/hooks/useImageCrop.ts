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
import { LOGO_CROP_CONFIG } from '@saome/shared/constants/card-images';

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
}

export interface UseImageCropOptions {
  /** Output width in pixels (used for canvas width). */
  outputWidth: number;
  /** Output height in pixels. Pass null for flexible height (preserves aspect ratio). */
  outputHeight: number | null;
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

const DEFAULT_MIN_SCALE = 0.5;
const DEFAULT_MAX_SCALE = 3.0;
const DEFAULT_INITIAL_SCALE = 1.0;

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
export function useImageCrop(options: UseImageCropOptions): UseImageCropReturn {
  const {
    // Deprecated: output dimensions are now computed internally in cropImage()
    // (width capped at 960, height flexible). These are kept for interface compat.
    outputWidth: _outputWidth,
    outputHeight: _outputHeight,
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

    const { focalX, focalY, scale, naturalWidth, naturalHeight } = cropState;

    if (naturalWidth === 0 || naturalHeight === 0) {
      throw new Error('Image dimensions not yet available');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Output: square (OUTPUT_WIDTH × OUTPUT_WIDTH), matching the UI 200×200 crop window.
    const MAX_LOGO_SIZE = LOGO_CROP_CONFIG.OUTPUT_WIDTH;

    // Square source region size: use the tighter image dimension after zoom.
    // This keeps the crop square regardless of source aspect ratio.
    const sourceSizeW = naturalWidth / scale;
    const sourceSizeH = naturalHeight / scale;
    const squareSize = Math.min(sourceSizeW, sourceSizeH);

    // Center the square region on the focal point, clamped to image bounds.
    const rawX = focalX * naturalWidth - squareSize / 2;
    const rawY = focalY * naturalHeight - squareSize / 2;
    const srcX = Math.max(0, rawX);
    const srcY = Math.max(0, rawY);
    const srcW = Math.min(squareSize, naturalWidth - srcX);
    const srcH = Math.min(squareSize, naturalHeight - srcY);

    canvas.width = MAX_LOGO_SIZE;
    canvas.height = MAX_LOGO_SIZE;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, MAX_LOGO_SIZE, MAX_LOGO_SIZE);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        'image/png',
        1.0,
      );
    });
  }, [cropState]);

  const resetCrop = useCallback(() => {
    setCropState({
      focalX: 0.5,
      focalY: 0.5,
      scale: initialScale,
      naturalWidth: cropState.naturalWidth,
      naturalHeight: cropState.naturalHeight,
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
