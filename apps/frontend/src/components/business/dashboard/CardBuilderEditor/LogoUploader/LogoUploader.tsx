/**
 * LogoUploader — Card builder Step 3: Logo upload with crop + zoom preview.
 *
 * Features:
 * - File picker with validation (width >= 960px, size <= 5MB, PNG/JPG only)
 * - Crop preview with draggable focal point
 * - Scroll/pinch zoom control (0.5x - 3x)
 * - Canvas cropping to 960x960px
 * - Direct R2 upload via pre-signed URL
 * - Updates template issuerLogo via cardService.update()
 *
 * RN migration:
 * - Canvas API → use react-native-image-crop-picker or expo-image-manipulator
 * - Rest of the component logic is RN-compatible
 *
 * @module components/business/dashboard/CardBuilderEditor/LogoUploader
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, ZoomIn, ZoomOut, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { useImageCrop } from '@/hooks/useImageCrop';
import { cardService } from '@/services/cardService';
import { LOGO_CROP_CONFIG } from '@saome/shared/constants/card-images';
import type {
  LogoUploaderProps,
  LogoUploaderState,
  ValidationError,
} from './LogoUploader.types';

const CROP_SIZE = 200; // Preview window size in pixels
const MAX_SCALE = LOGO_CROP_CONFIG.MAX_SCALE;
// Fixed floor for the hook's internal state management
const MIN_SCALE = LOGO_CROP_CONFIG.MIN_SCALE;

/**
 * Dynamic minimum scale so the image ALWAYS fills (or exceeds) the crop window.
 * This prevents the "stuck in middle" bug where the user can't pan beyond
 * the fully-visible image bounds.
 *
 * For a 1920×960 image (landscape): baseScale=0.208, so minScale must be >= 1
 * For a 960×1920 image (portrait): baseScale=0.104, so minScale must be >= 1
 * For a 960×960 image (square): baseScale=1, so minScale can be 0.5
 *
 * We compute this in the render function using actual natural dimensions.
 */
function computeMinScale(naturalWidth: number, naturalHeight: number): number {
  if (naturalWidth === 0 || naturalHeight === 0) return 0.5;
  const shorter = Math.min(naturalWidth, naturalHeight);
  // baseScale = CROP_SIZE / shorter → scale needed to make shorter fill 200px
  // To fill the window, we need: shorter * baseScale * minScale >= CROP_SIZE
  // → minScale >= 1 (always, for non-square images)
  const baseScale = CROP_SIZE / shorter;
  const minScale = 1 / baseScale; // = shorter / CROP_SIZE
  return Math.max(0.5, minScale); // never go below 0.5
}

/**
 * Validate uploaded file.
 */
function validateFile(file: File): ValidationError | null {
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

/**
 * Validate image dimensions.
 * The image must be large enough that when the SHORTER edge fills the 960px output,
 * the LONGER edge is still >= 960px.
 *
 * For example:
 * - 960x960 image: shorter=960, longer=960 → PASS
 * - 1920x960 image: shorter=960, longer=1920 → PASS (crop to 960x960 leaves 960px headroom)
 * - 480x960 image: shorter=480, longer=960 → FAIL (shorter < 960)
 * - 960x480 image: shorter=480, longer=960 → FAIL (shorter < 960)
 */
async function validateImageDimensions(
  file: File,
): Promise<{ isValid: boolean; width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Check: can we crop 960x960 from this image?
      // We need the shorter edge >= 960 so the 960px output doesn't exceed image bounds
      const shorter = Math.min(img.naturalWidth, img.naturalHeight);
      const isValid = shorter >= LOGO_CROP_CONFIG.OUTPUT_WIDTH;
      resolve({
        isValid,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      resolve({ isValid: false, width: 0, height: 0 });
    };
    img.src = URL.createObjectURL(file);
  });
}

export function LogoUploader({
  templateId,
  currentLogoUrl,
  onLogoUploaded,
  onLogoRemoved,
  className = '',
}: LogoUploaderProps) {
  const { t } = useTranslation('cardBuilder');

  // Component state
  const [state, setState] = useState<LogoUploaderState>('idle');
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** True when image is loaded but too small to save */
  const [isImageTooSmall, setIsImageTooSmall] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const focalStartRef = useRef({ x: 0.5, y: 0.5 });

  // Image ref (set by useImageCrop hook)

  // Image crop hook
  const {
    cropState,
    imageUrl,
    onImageLoad,
    loadImage,
    setFocalPoint,
    setScale,
    cropImage,
    resetCrop,
    hasImage,
  } = useImageCrop({
    outputWidth: LOGO_CROP_CONFIG.OUTPUT_WIDTH,
    outputHeight: LOGO_CROP_CONFIG.OUTPUT_HEIGHT,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
    initialScale: 1,
  });

  // Dynamic min scale: never allow zoom-out beyond filling the window
  const dynamicMinScale = computeMinScale(cropState.naturalWidth, cropState.naturalHeight);

  // Sync image element ref
  useEffect(() => {
    // The onImageLoad callback handles setting the ref and detecting dimensions
  }, []);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  /**
   * Handle file selection.
   */
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type and size
      const fileError = validateFile(file);
      if (fileError) {
        setValidationError(fileError);
        setState('error');
        return;
      }

      // Validate image dimensions
      const { isValid } = await validateImageDimensions(file);
      if (!isValid) {
        setValidationError({
          type: 'tooSmall',
          message: 'validation.tooSmall',
        });
        // Still load the image so user can see the crop UI,
        // but will be blocked from saving
        try {
          await loadImage(file);
          setIsImageTooSmall(true);
          setState('cropping');
        } catch {
          setUploadError(t('logoUpload.error'));
          setState('error');
        }
        e.target.value = '';
        return;
      }

      // Load image and enter cropping mode
      try {
        await loadImage(file);
        setValidationError(null);
        setUploadError(null);
        setState('cropping');
      } catch {
        setUploadError(t('logoUpload.error'));
        setState('error');
      }

      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [loadImage, t],
  );

  /**
   * Handle apply crop — crop image, upload to R2, update template.
   */
  const handleApplyCrop = useCallback(async () => {
    if (!hasImage || isImageTooSmall) return;

    setState('uploading');
    setUploadError(null);

    try {
      // 1. Crop image to blob
      const blob = await cropImage();

      // 2. Get pre-signed URL from backend
      const { uploadUrl, key } = await cardService.generateLogoUploadUrl(
        templateId,
        'logo',
      );

      // 3. Upload directly to R2
      await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': 'image/png',
        },
      });

      // 4. Update template with issuerLogo (store the R2 key)
      await cardService.update(templateId, {
        settings: {
          issuerLogo: key,
        },
      });

      // 5. Success — report to parent
      setState('success');
      onLogoUploaded(key);

      // Reset to idle after showing success
      setTimeout(() => {
        setState('idle');
      }, 2000);
    } catch (err) {
      console.error('[LogoUploader] Upload failed:', err);
      setUploadError(t('error'));
      setState('error');
    }
  }, [hasImage, isImageTooSmall, cropImage, templateId, onLogoUploaded, t]);

  /**
   * Handle cancel cropping — reset to idle.
   */
  const handleCancel = useCallback(() => {
    resetCrop();
    setValidationError(null);
    setUploadError(null);
    setIsImageTooSmall(false);
    setState('idle');
  }, [resetCrop]);

  /**
   * Handle remove logo — reset template issuerLogo.
   */
  const handleRemove = useCallback(async () => {
    try {
      await cardService.update(templateId, {
        settings: {
          issuerLogo: undefined,
        },
      });
      onLogoRemoved?.();
      setIsImageTooSmall(false);
      setState('idle');
    } catch (err) {
      console.error('[LogoUploader] Remove failed:', err);
      setUploadError(t('error'));
    }
  }, [templateId, onLogoRemoved, t]);

  // ===== Compute derived values for rendering and drag =====

  // At scale=1, the image's shorter edge fills CROP_SIZE.
  // This is the "base" scale that shows the full image letterboxed.
  const baseScale = cropState.naturalWidth > 0
    ? CROP_SIZE / Math.min(cropState.naturalWidth, cropState.naturalHeight)
    : 1;

  // Actual display dimensions after zoom
  const displayWidth = cropState.naturalWidth * baseScale * cropState.scale;
  const displayHeight = cropState.naturalHeight * baseScale * cropState.scale;

  // ===== Drag to pan (update focal point) =====

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!hasImage || state !== 'cropping') return;
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      focalStartRef.current = { x: cropState.focalX, y: cropState.focalY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [hasImage, state, cropState.focalX, cropState.focalY],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      // focalX in [0,1] maps to image pixel [0, naturalWidth]
      // Drag RIGHT → want image to appear to move RIGHT
      //   → want focal point to show more of the LEFT side of the image
      //   → focalX should DECREASE (focal moves left in image space)
      // So: focalDx = -dx / displayWidth
      const focalDx = -dx / displayWidth;
      const focalDy = -dy / displayHeight;

      const newFocalX = Math.max(0, Math.min(1, focalStartRef.current.x + focalDx));
      const newFocalY = Math.max(0, Math.min(1, focalStartRef.current.y + focalDy));
      setFocalPoint(newFocalX, newFocalY);
    },
    [setFocalPoint, displayWidth, displayHeight],
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // ===== Scroll to zoom =====

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!hasImage || state !== 'cropping') return;
      e.preventDefault();

      // Delta-based zoom (never zoom out beyond filling the window)
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(
        dynamicMinScale,
        Math.min(MAX_SCALE, cropState.scale + delta),
      );
      setScale(newScale);
    },
    [hasImage, state, cropState.scale, setScale],
  );

  // ===== Scale slider =====

  const handleScaleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setScale(parseFloat(e.target.value));
    },
    [setScale],
  );

  // ===== Calculate image CSS for the crop window =====

  /**
   * Position the image so the focal point aligns with the crop window center.
   *
   * The crop window is a fixed 200×200 square in the container center.
   * The image is letterboxed inside this window (shorter edge = 200px at scale=1).
   *
   * Math:
   * - window center is at container center (relative offset = 0 in absolute positioning)
   * - image position: we want focalX * displayWidth to be at window center
   * - left = windowCenter - focalX * displayWidth
   */
  function calculateImageStyle(): React.CSSProperties {
    const { focalX, focalY, scale, naturalWidth, naturalHeight } = cropState;

    if (naturalWidth === 0 || naturalHeight === 0) {
      return { display: 'none' };
    }

    // At scale=1: shorter edge fills CROP_SIZE (letterboxed)
    const shorterEdge = Math.min(naturalWidth, naturalHeight);
    const baseScale = CROP_SIZE / shorterEdge;

    const dw = naturalWidth * baseScale * scale;
    const dh = naturalHeight * baseScale * scale;

    // Position so focal point is at the window center
    const left = CROP_SIZE / 2 - focalX * dw;
    const top = CROP_SIZE / 2 - focalY * dh;

    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${dw}px`,
      height: `${dh}px`,
    };
  }

  // ===== Idle state: show upload button or current logo =====

  if (state === 'idle') {
    return (
      <div className={`flex flex-col items-center gap-4 ${className}`}>
        {currentLogoUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={currentLogoUrl}
              alt="Current logo"
              className="h-24 w-24 rounded-lg object-contain bg-muted"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="
                flex items-center gap-2 rounded-lg border border-destructive/50 px-3 py-1.5
                text-sm font-medium text-destructive
                transition-all duration-150
                hover:bg-destructive/10
              "
            >
              <X size={14} aria-hidden="true" />
              {t('logoUpload.remove')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="
              flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30
              bg-muted/30 p-8 transition-all duration-150
              hover:border-primary hover:bg-primary/5
            "
          >
            <Upload size={32} className="text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium text-muted-foreground">
              {t('logoUpload.selectFile')}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {t('logoUpload.hint')}
            </span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileSelect}
          className="sr-only"
        />
      </div>
    );
  }

  // ===== Error state =====

  if (state === 'error') {
    return (
      <div className={`flex flex-col items-center gap-4 ${className}`}>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <AlertCircle size={32} className="text-destructive" aria-hidden="true" />
          <p className="text-sm text-destructive">
            {validationError ? t(`logoUpload.${validationError.message}`) : uploadError}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="
            flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2
            text-sm font-medium text-foreground transition-all duration-150
            hover:border-primary hover:text-primary
          "
        >
          {t('logoUpload.cancel')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileSelect}
          className="sr-only"
        />
      </div>
    );
  }

  // ===== Success state =====

  if (state === 'success') {
    return (
      <div className={`flex flex-col items-center gap-4 ${className}`}>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-6">
              <Check size={32} className="text-success" aria-hidden="true" />
          <p className="text-sm font-medium text-success">
            {t('logoUpload.success')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="
            flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2
            text-sm font-medium text-foreground transition-all duration-150
            hover:border-primary hover:text-primary
          "
        >
          <Upload size={14} aria-hidden="true" />
          {t('selectFile')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileSelect}
          className="sr-only"
        />
      </div>
    );
  }

  // ===== Cropping / Uploading state =====

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* Upload progress */}
      {state === 'uploading' && (
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t('logoUpload.uploading')}</p>
        </div>
      )}

      {/* Crop editor */}
      {state === 'cropping' && (
        <>
          {/* Hint */}
          <p className="text-sm text-muted-foreground">
            {t('logoUpload.dragging')}
          </p>

          {/* Crop container — full image visible, square window as overlay indicator */}
          <div
            ref={containerRef}
            className="relative flex items-center justify-center overflow-hidden rounded-xl bg-[#1a1a1a]"
            style={{
              width: '100%',
              height: 280,
              cursor: 'grab',
              touchAction: 'none',
              userSelect: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* Full image — letterboxed in a virtual 200x200 crop area */}
            {imageUrl && cropState.naturalWidth > 0 && (
              <img
                src={imageUrl}
                alt=""
                className="pointer-events-none"
                style={calculateImageStyle()}
              />
            )}

            {/* Hidden image for dimension detection */}
            <img
              ref={onImageLoad}
              src={imageUrl ?? ''}
              alt=""
              className="absolute opacity-0"
              style={{ width: 1, height: 1 }}
              draggable={false}
            />

            {/* Semi-transparent mask everywhere except the crop window */}
            <div
              className="pointer-events-none absolute rounded"
              style={{
                width: CROP_SIZE,
                height: CROP_SIZE,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
              }}
            />

            {/* Crop border — white square outline */}
            <div
              className="pointer-events-none absolute rounded border-2 border-white/80"
              style={{
                width: CROP_SIZE,
                height: CROP_SIZE,
              }}
            />
          </div>

          {/* Scale control */}
          <div className="flex w-full items-center gap-3 px-2">
            <ZoomOut size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="range"
              min={dynamicMinScale}
              max={MAX_SCALE}
              step={0.1}
              value={cropState.scale}
              onChange={handleScaleChange}
              className="flex-1 cursor-pointer"
              aria-label={t('logoUpload.scale')}
            />
            <ZoomIn size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-12 text-center text-sm font-mono text-muted-foreground">
              {cropState.scale.toFixed(1)}x
            </span>
          </div>

          {/* Size warning */}
          {isImageTooSmall && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 px-4 py-2">
              <AlertCircle size={14} className="shrink-0 text-warning" aria-hidden="true" />
              <p className="text-xs text-warning">
                {t('logoUpload.validation.tooSmallForSave')}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2
                text-sm font-medium text-foreground transition-all duration-150
                hover:border-muted-foreground hover:text-muted-foreground
              "
            >
              <X size={14} aria-hidden="true" />
              {t('logoUpload.cancel')}
            </button>
            <button
              type="button"
              onClick={resetCrop}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2
                text-sm font-medium text-foreground transition-all duration-150
                hover:border-muted-foreground hover:text-muted-foreground
              "
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('logoUpload.reset')}
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={isImageTooSmall}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2
                text-sm font-semibold text-on-primary transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              <Check size={14} aria-hidden="true" />
              {t('logoUpload.apply')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
