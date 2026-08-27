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
import { Upload, X, ZoomIn, ZoomOut, Check, AlertCircle, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { useImageCrop, type CropState } from '@/hooks/useImageCrop';
import { cardService } from '@/services/cardService';
import { api } from '@/config/api';
import { getAccessToken } from '@/services/authStore';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { LOGO_CROP_CONFIG } from '@saome/shared/constants/card-images';
import type {
  LogoUploaderProps,
  LogoUploaderState,
  ValidationError,
} from './LogoUploader.types';

const MAX_SCALE = LOGO_CROP_CONFIG.MAX_SCALE;
const MIN_SCALE = LOGO_CROP_CONFIG.MIN_SCALE;
const CROP_WINDOW_SIZE = LOGO_CROP_CONFIG.CROP_WINDOW_SIZE;
const BASE_CANVAS_WIDTH = LOGO_CROP_CONFIG.BASE_CANVAS_WIDTH;

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
 * Re-derive focalX/focalY from the current offset.
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
 *   - Image element visual center in outer box =
 *       (baseContainerW/2 + offsetX * scale, baseContainerH/2 + offsetY * scale)
 *   - Mask center in image content normalized =
 *       ((baseContainerW/2 - (baseContainerW/2 + offsetX*scale)) / (baseContainerW*scale),
 *        same for Y)
 *     = (-offsetX / baseContainerW, -offsetY / baseContainerH)
 *     → focalX = 0.5 - offsetX / baseContainerW (no scale — the scale factor
 *       appears symmetrically in numerator and denominator and cancels out).
 *
 * The earlier formula `(offsetX * scale)` was a Bug-A root cause: drag at
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


export function LogoUploader({
  templateId,
  onLogoUploaded,
  className = '',
}: LogoUploaderProps) {
  const { t } = useTranslation('logoUpload');
  const setIssuerLogo = useCardBuilderStore((s) => s.setIssuerLogo);

  // Component state
  const [state, setState] = useState<LogoUploaderState>('idle');
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** Tracks the last uploaded logo key for reliable preview display after success. */
  const [lastUploadedLogoKey, setLastUploadedLogoKey] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  // Image ref (set by useImageCrop hook)

  // Image crop hook
  const {
    cropState,
    setCropState,
    imageUrl,
    imageRef,
    onImageLoad,
    loadImage,
    cropImage,
    resetCrop,
    hasImage,
  } = useImageCrop({
    outputWidth: LOGO_CROP_CONFIG.OUTPUT_WIDTH,
    outputHeight: LOGO_CROP_CONFIG.OUTPUT_HEIGHT,
    cropWindowSize: CROP_WINDOW_SIZE,
    baseCanvasWidth: BASE_CANVAS_WIDTH,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
    initialScale: 1,
  });

  // Sync image element ref via callback ref
  useEffect(() => {
    // The onImageLoad callback handles setting imageRef.current via the ref attribute
  }, []);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  // ===== Compute derived values for rendering and drag =====

  // Base container size — the unscaled fit-to-natural-aspect crop canvas.
  // Container itself stays this size in layout (so zoom-in doesn't reflow
  // the surrounding UI); image and mask are scaled visually via a transform
  // applied to the inner stage so the user sees the image get bigger.
  const baseContainerW = cropState.naturalWidth > 0
    ? Math.min(cropState.naturalWidth, BASE_CANVAS_WIDTH)
    : BASE_CANVAS_WIDTH;
  const baseContainerH = cropState.naturalWidth > 0
    ? Math.round(baseContainerW * (cropState.naturalHeight / cropState.naturalWidth))
    : BASE_CANVAS_WIDTH;

  // Sync resolvedBaseCanvasWidth into cropState so useImageCrop.cropImage()
  // uses the same base canvas width as the UI for small src images (NW < BASE).
  // Without this, cropImage falls back to BASE_CANVAS_WIDTH and computes a
  // srcSquareSize that's smaller than the UI mask's actual src-side size.
  useEffect(() => {
    if (cropState.naturalWidth > 0 && cropState.resolvedBaseCanvasWidth !== baseContainerW) {
      setCropState((prev) => ({ ...prev, resolvedBaseCanvasWidth: baseContainerW }));
    }
  }, [baseContainerW, cropState.naturalWidth, cropState.resolvedBaseCanvasWidth]);

  // The fixed-size container and inner stage both stay at base size in layout.
  const containerW = baseContainerW;
  const containerH = baseContainerH;

  // Refs to hold latest values for the non-passive wheel listener (avoids re-attaching on every render)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Non-passive wheel listener: preventDefault() actually fires, stopping page scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!hasImage || stateRef.current !== 'cropping') return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setCropState((prev) => applyScaleChange(prev, prev.scale + delta));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [hasImage, applyScaleChange]);

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

      // Load image and enter cropping mode
      try {
        await loadImage(file);
        setValidationError(null);
        setUploadError(null);
        setState('cropping');
      } catch {
        setUploadError(t('error'));
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
    if (!hasImage) return;

    // Defensive: ensure imageRef is actually populated before drawing.
    // Even if hasImage is true, imageRef.current may lag by one render.
    const img = imageRef.current;
    if (!img) {
      setUploadError(t('error'));
      setState('error');
      return;
    }

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

      // 4. Fetch current settings, merge with new issuerLogo, then write back.
      //    This avoids wiping out other fields (barcodeType, storeName, etc.)
      const currentTemplate = await cardService.getById(templateId);
      // Defensive: settings can be a string (malformed DB row) or object
      const rawSettings = currentTemplate.settings;
      const safeSettings: Record<string, unknown> =
        typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings ?? {});
      await cardService.update(templateId, {
        settings: {
          ...safeSettings,
          issuerLogo: key,
        },
      });

      // 5. Success — report to parent
      setIssuerLogo(key); // Sync to Zustand store so Step 2 save includes it
      setLastUploadedLogoKey(key); // Capture key for reliable preview display
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
  }, [hasImage, imageRef, cropImage, templateId, onLogoUploaded, setIssuerLogo, t]);

  /**
   * Handle cancel cropping — reset to idle.
   */
  const handleCancel = useCallback(() => {
    resetCrop();
    setValidationError(null);
    setUploadError(null);
    setState('idle');
  }, [resetCrop]);

  // ===== Drag to pan (update focal point) =====

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!hasImage || state !== 'cropping') return;
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      // Snapshot drag origin offsets so pointermove is delta-based.
      offsetStartRef.current = {
        x: cropState.offsetX ?? 0,
        y: cropState.offsetY ?? 0,
      };
      containerRef.current?.setPointerCapture(e.pointerId);
    },
    [hasImage, state, cropState.offsetX, cropState.offsetY],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      // Apply pan offset in pre-scale canvas space so 1 mouse px = 1 visual px
      // regardless of the current zoom scale.
      setCropState((prev) => ({
        ...prev,
        offsetX: offsetStartRef.current.x + dx,
        offsetY: offsetStartRef.current.y + dy,
      }));
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Sync focal to the final offset so crop export reflects what the user
    // sees in the mask window. Focal is the export's source of truth (see
    // useImageCrop.cropImage); offset is only for display positioning.
    setCropState((prev) => syncFocalFromOffset(prev, baseContainerW, baseContainerH));
  }, []);

  // ===== Scroll to zoom =====

  // ===== Scale helper =====

  /**
   * Compute new state for a scale change while keeping the image's visual
   * position fixed (offsetX/offsetY unchanged). The mask-window center then
   * naturally shows a different — finer — slice of the src image, matching
   * how every photo-editor zoom behaves.
   *
   * focalX/focalY are re-derived from the offset so cropImage() exports
   * exactly the slice the user is currently looking at.
   */
  function applyScaleChange(prev: CropState, targetScale: number): CropState {
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, targetScale));
    if (newScale === prev.scale) return prev;

    // Offset stays put — image keeps its visual position, mask window now
    // shows a finer slice of the src image. Re-derive focal so export
    // matches what's visible.
    return syncFocalFromOffset({ ...prev, scale: newScale }, baseContainerW, baseContainerH);
  }

  // ===== Scale slider =====

  const handleScaleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newScale = e.target.valueAsNumber;
      setCropState((prev) => applyScaleChange(prev, newScale));
    },
    [containerW, containerH],
  );

  // ===== Calculate image CSS for the crop window =====

  /**
   * Image is rendered at the base container size (baseW × baseH) inside the
   * inner canvas. A CSS transform applies: scale first (around the canvas center),
   * then translate for the pan offset. This means 1 mouse px of drag = 1 visual px
   * of motion at any scale, and zoom-in visually enlarges the image from the
   * canvas center outward.
   */
  function calculateImageStyle(): React.CSSProperties {
    const { naturalWidth, naturalHeight, offsetX = 0, offsetY = 0 } = cropState;

    if (naturalWidth === 0 || naturalHeight === 0) {
      return { display: 'none' };
    }

    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: `${baseContainerW}px`,
      height: `${baseContainerH}px`,
      objectFit: 'contain',
      userSelect: 'none',
      pointerEvents: 'none',
      transform: `translate(${offsetX}px, ${offsetY}px)`,
      transformOrigin: 'left top',
    };
  }

  // ===== Idle / Success state: show cropped preview with "replace" option =====

  if (state === 'idle' || state === 'success') {
    // Priority for display URL:
    // 1. lastUploadedLogoKey — just uploaded, supersedes everything
    // 2. Zustand store issuerLogo — from prior sessions or parent init
    const issuerLogo = useCardBuilderStore.getState().issuerLogo;
    const previewKey = lastUploadedLogoKey ?? issuerLogo ?? null;
    const displayUrl = previewKey
      ? `${api.baseUrl}${api.paths.cardImage(templateId, 'logo')}?token=${getAccessToken() ?? ''}`
      : undefined;

    const showPreview = Boolean(displayUrl);

    return (
      <div className={`flex flex-col items-center gap-4 ${className}`}>
        {showPreview && displayUrl ? (
          <div className="flex flex-col items-center gap-3">
            {/* Cropped logo preview — maintain square ratio */}
            <div className="relative h-32 w-32 overflow-hidden rounded-xl bg-muted">
              <img
                src={displayUrl}
                alt="Logo"
                className="h-full w-full object-contain"
              />
              {/* Success badge — visible for 2 seconds after upload */}
              {state === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success">
                    <Check size={16} className="text-white" aria-hidden="true" />
                  </div>
                </div>
              )}
            </div>

            {/* Replace button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2
                text-sm font-medium text-foreground transition-all duration-150
                hover:border-primary hover:text-primary
              "
            >
              <ImageIcon size={14} aria-hidden="true" />
              {t('replace')}
            </button>
          </div>
        ) : (
          /* No logo yet: show upload prompt */
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
              {t('selectFile')}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {t('hint')}
            </span>
          </button>
        )}

        {state === 'success' && (
          <p className="text-xs text-success/80">{t('success')}</p>
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
          {t('cancel')}
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
          <p className="text-sm text-muted-foreground">{t('uploading')}</p>
        </div>
      )}

      {/* Crop editor */}
      {state === 'cropping' && (
        <>
          {/* Hint */}
          <p className="text-sm text-muted-foreground">
            {t('dragging')}
          </p>

          {/* Crop stage — outer container is fixed in layout so zoom-in doesn't
              reflow the page. The inner canvas applies a CSS scale transform
              (around the canvas center) so the user sees the image visually
              enlarge from the center outward. */}
          <div
            ref={containerRef}
            className="relative rounded-xl"
            style={{
              width: baseContainerW,
              height: baseContainerH,
              cursor: 'grab',
              touchAction: 'none',
              userSelect: 'none',
              backgroundColor: '#1a1a1a',
              overflow: 'hidden',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Inner canvas — fixed base size in layout but transform: scale lets
                the image visually grow without changing layout. SVG mask and
                mask border sit OUTSIDE this canvas so they stay 200x200 — only
                the image scales, so the user sees the same crop window frame
                while the image inside it shows more detail. */}
            <div
              className="absolute"
              style={{
                width: baseContainerW,
                height: baseContainerH,
                transform: `scale(${cropState.scale})`,
                transformOrigin: `${baseContainerW / 2}px ${baseContainerH / 2}px`,
              }}
            >
              {/* Bright full image — visible through the SVG mask "hole" */}
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  ref={onImageLoad}
                  className="pointer-events-none select-none"
                  draggable={false}
                  style={calculateImageStyle()}
                  onLoad={(e) => onImageLoad(e.currentTarget)}
                />
              )}
            </div>

            {/* SVG mask layer — stays at base container size and is NOT scaled.
                Dim everything except a fixed 200x200 center crop window. */}
            <svg
              className="pointer-events-none absolute inset-0"
              width={baseContainerW}
              height={baseContainerH}
              style={{ display: 'block' }}
            >
              <defs>
                <mask id="logo-crop-mask">
                  {/* Outer rect: full container = white (mask shows the overlay) */}
                  <rect width={baseContainerW} height={baseContainerH} fill="white" />
                  {/* Inner rect: 200x200 center crop window = black (mask hides overlay there,
                    letting bright image show through) */}
                  <rect
                    x={(baseContainerW - CROP_WINDOW_SIZE) / 2}
                    y={(baseContainerH - CROP_WINDOW_SIZE) / 2}
                    width={CROP_WINDOW_SIZE}
                    height={CROP_WINDOW_SIZE}
                    rx="0.5rem"
                    fill="black"
                  />
                </mask>
              </defs>
              {/* Dark overlay: visible in white mask areas (outside crop), hidden in black (crop window) */}
              <rect
                width={baseContainerW}
                height={baseContainerH}
                fill="rgba(0,0,0,0.5)"
                mask="url(#logo-crop-mask)"
              />
            </svg>

            {/* 200x200 crop window — fixed-size white border. Sits on top of the
                scaled image at the container center. NOT scaled, so the crop
                frame stays the same size while the image inside it gets bigger. */}
            <div
              className="pointer-events-none absolute rounded border-2 border-white/70"
              style={{
                width: CROP_WINDOW_SIZE,
                height: CROP_WINDOW_SIZE,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>

          {/* Scale control */}
          <div className="flex w-full items-center gap-3 px-2">
            <ZoomOut size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="range"
              min={0.5}
              max={MAX_SCALE}
              step={0.1}
              value={cropState.scale}
              onChange={handleScaleChange}
              className="flex-1 cursor-pointer"
              aria-label={t('scale')}
            />
            <ZoomIn size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-12 text-center text-sm font-mono text-muted-foreground">
              {cropState.scale.toFixed(1)}x
            </span>
          </div>

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
              {t('cancel')}
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
              {t('reset')}
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2
                text-sm font-semibold text-on-primary transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              <Check size={14} aria-hidden="true" />
              {t('apply')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
