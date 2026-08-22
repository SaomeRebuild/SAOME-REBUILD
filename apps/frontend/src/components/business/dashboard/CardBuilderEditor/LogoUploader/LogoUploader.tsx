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
import { useImageCrop } from '@/hooks/useImageCrop';
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

const MAX_PREVIEW_W = 400; // Max preview container width in pixels (keeps UI sane)
const CROP_WINDOW_SIZE = 200; // Fixed-size crop window (export preview)
const MAX_SCALE = LOGO_CROP_CONFIG.MAX_SCALE;
const MIN_SCALE = LOGO_CROP_CONFIG.MIN_SCALE;

/**
 * Compute the minimum scale so the image ALWAYS fills (or exceeds) the crop window.
 * This prevents the "stuck in middle" bug where the user can't pan beyond
 * the fully-visible image bounds.
 *
 * The crop window is a fixed 200x200 square. The preview container is proportional
 * to the natural aspect ratio, capped at MAX_PREVIEW_W wide.
 * For non-square images, the image can't fully fit in the window without one axis
 * exceeding — so minScale must be >= 1 to prevent panning to empty space.
 */
function computeMinScale(
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number,
): number {
  if (naturalWidth === 0 || naturalHeight === 0) return 0.5;
  const shorter = Math.min(containerWidth, containerHeight);
  const baseScale = shorter / Math.min(naturalWidth, naturalHeight);
  const minScale = 1 / baseScale;
  return Math.max(0.5, minScale);
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


export function LogoUploader({
  templateId,
  onLogoUploaded,
  className = '',
}: LogoUploaderProps) {
  const { t } = useTranslation('cardBuilder');
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
  const focalStartRef = useRef({ x: 0.5, y: 0.5 });

  // Image ref (set by useImageCrop hook)

  // Image crop hook
  const {
    cropState,
    imageUrl,
    imageRef,
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

  // Refs to hold latest values for the non-passive wheel listener (avoids re-attaching on every render)
  const cropStateRef = useRef(cropState);
  const stateRef = useRef(state);
  cropStateRef.current = cropState;
  stateRef.current = state;

  // Non-passive wheel listener: preventDefault() actually fires, stopping page scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!hasImage || stateRef.current !== 'cropping') return;
      e.preventDefault();

      const safeMin = MIN_SCALE;
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(safeMin, Math.min(MAX_SCALE, cropStateRef.current.scale + delta));
      setScale(newScale);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [hasImage, setScale]);

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
    if (!hasImage) return;

    // Defensive: ensure imageRef is actually populated before drawing.
    // Even if hasImage is true, imageRef.current may lag by one render.
    const img = imageRef.current;
    if (!img) {
      setUploadError(t('logoUpload.error'));
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

  // ===== Compute derived values for rendering and drag =====

  // Container matches natural aspect ratio, capped at MAX_PREVIEW_W wide
  const containerW = cropState.naturalWidth > 0
    ? Math.min(cropState.naturalWidth, MAX_PREVIEW_W)
    : MAX_PREVIEW_W;
  const containerH = cropState.naturalWidth > 0
    ? Math.round(containerW * (cropState.naturalHeight / cropState.naturalWidth))
    : MAX_PREVIEW_W;

  // At scale=1: shorter edge of image fills the shorter edge of container.
  // This is the "base" scale that shows the full image letterboxed.
  const baseScale = cropState.naturalWidth > 0
    ? Math.min(containerW, containerH) / Math.min(cropState.naturalWidth, cropState.naturalHeight)
    : 1;

  // Actual display dimensions after zoom
  const displayWidth = cropState.naturalWidth * baseScale * cropState.scale;
  const displayHeight = cropState.naturalHeight * baseScale * cropState.scale;

  // Dynamic minimum scale for this image
  const dynamicMinScale = computeMinScale(
    cropState.naturalWidth,
    cropState.naturalHeight,
    containerW,
    containerH,
  );

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

  // ===== Scale slider =====

  const handleScaleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.valueAsNumber;
      // dynamicMinScale is the scale where the image just fills the crop window.
      // We allow zoom-out below that (user might want the image smaller intentionally),
      // but we never allow below 0.5 (too small to be useful).
      const safeMin = Math.min(dynamicMinScale, 0.5);
      const newScale = Math.max(safeMin, Math.min(MAX_SCALE, raw));
      setScale(newScale);
    },
    [setScale, dynamicMinScale],
  );

  // ===== Calculate image CSS for the crop window =====

  /**
   * Position the image so the focal point aligns with the container center.
   *
   * The container is a rectangle sized to the natural aspect ratio (capped at MAX_PREVIEW_W).
   * The image is letterboxed inside this container.
   */
  function calculateImageStyle(): React.CSSProperties {
    const { focalX, focalY, naturalWidth, naturalHeight } = cropState;

    if (naturalWidth === 0 || naturalHeight === 0) {
      return { display: 'none' };
    }

    const dw = displayWidth;
    const dh = displayHeight;

    // Position so focal point is at the container center
    const left = containerW / 2 - focalX * dw;
    const top = containerH / 2 - focalY * dh;

    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${dw}px`,
      height: `${dh}px`,
      objectFit: 'contain',
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
              {t('logoUpload.replace')}
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
              {t('logoUpload.selectFile')}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {t('logoUpload.hint')}
            </span>
          </button>
        )}

        {state === 'success' && (
          <p className="text-xs text-success/80">{t('logoUpload.success')}</p>
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

          {/* Crop container — full image visible, 200x200 window with SVG mask overlay */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-xl"
            style={{
              width: containerW,
              height: containerH,
              cursor: 'grab',
              touchAction: 'none',
              userSelect: 'none',
              backgroundColor: '#1a1a1a',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Bright full image — visible through the SVG mask "hole" */}
            {imageUrl && cropState.naturalWidth > 0 && (
              <img
                src={imageUrl}
                alt=""
                className="pointer-events-none"
                style={calculateImageStyle()}
              />
            )}

            {/* Hidden image for dimension detection — onLoad ensures dimensions
                are captured even when element mounts before image finishes loading. */}
            <img
              ref={onImageLoad}
              src={imageUrl ?? ''}
              alt=""
              className="absolute opacity-0"
              style={{ width: 1, height: 1 }}
              draggable={false}
              onLoad={(e) => onImageLoad(e.currentTarget)}
            />

            {/* SVG mask layer: dim everything except the 200x200 center crop window.
                Implementation:
                  - <mask> defines a hole: white = visible, black = hidden
                  - <rect> covers full container in dark color, masked so center is transparent
            */}
            <svg
              className="pointer-events-none absolute inset-0"
              width={containerW}
              height={containerH}
              style={{ display: 'block' }}
            >
              <defs>
                <mask id="logo-crop-mask">
                  {/* Outer rect: full container = white (mask shows the overlay) */}
                  <rect width={containerW} height={containerH} fill="white" />
                  {/* Inner rect: 200x200 center crop window = black (mask hides overlay there,
                    letting bright image show through) */}
                  <rect
                    x={(containerW - CROP_WINDOW_SIZE) / 2}
                    y={(containerH - CROP_WINDOW_SIZE) / 2}
                    width={CROP_WINDOW_SIZE}
                    height={CROP_WINDOW_SIZE}
                    rx="0.5rem"
                    fill="black"
                  />
                </mask>
              </defs>
              {/* Dark overlay: visible in white mask areas (outside crop), hidden in black (crop window) */}
              <rect
                width={containerW}
                height={containerH}
                fill="rgba(0,0,0,0.5)"
                mask="url(#logo-crop-mask)"
              />
            </svg>

            {/* 200x200 crop window — white border overlay */}
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
              aria-label={t('logoUpload.scale')}
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
