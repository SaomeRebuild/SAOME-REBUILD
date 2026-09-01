/**
 * MediaAssetUploader — Unified media-asset uploader for Card Builder.
 *
 * Refactored from the previous LogoUploader (332 lines, logo-only) to be
 * variant-driven via the `variant` prop. Each variant (logo / icon / future
 * background) reads its crop config, i18n namespace, validator, and
 * templateSettings field from `MEDIA_ASSET_CONFIG` in
 * `@saome/shared/constants/card-images`.
 *
 * Orchestration (state + handlers + ResizeObserver) lives here. JSX is
 * delegated to sub-components: `./UploadPrompt`, `./Preview`, `./UploadError`,
 * `./UploadingIndicator`, `./CropStage`, `./ScaleControl`, `./CropActions`.
 *
 * Features:
 * - File picker with validation (PNG/JPG only, ≤ 5MB) via shared factory
 * - Crop preview with draggable focal point (mouse/pen/touch)
 * - Scroll/wheel + slider zoom control (0.5x - 3x)
 * - Canvas cropping to variant-specific OUTPUT_WIDTH × OUTPUT_HEIGHT
 * - Direct R2 upload via pre-signed URL
 * - Updates template settings via cardService.update()
 *
 * RN migration: Canvas API → use react-native-image-crop-picker. All
 * business logic is platform-agnostic (see `packages/shared/logic/imageCrop`).
 *
 * @module components/business/dashboard/CardBuilderEditor/MediaAssetUploader
 */

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useImageCrop } from '@/hooks/useImageCrop';
import type { FileLike, ValidationError } from '@saome/shared/types';
import {
  applyScaleChange as applyScaleChangeShared,
  validateLogoFile,
  validateIconFile,
  validateBackgroundFile,
} from '@saome/shared/logic';
import { cardService } from '@/services/cardService';
import { api } from '@/config/api';
import { getAccessToken } from '@/services/authStore';
import { useCardBuilderStore, unwrapCardSettings } from '../CardBuilderEditor.store';
import { MEDIA_ASSET_CONFIG } from '@saome/shared/constants/card-images';
import type {
  MediaAssetUploaderProps,
  MediaAssetUploaderState,
} from './MediaAssetUploader.types';
import { UploadPrompt } from './UploadPrompt/UploadPrompt';
import { Preview } from './Preview/Preview';
import { UploadError } from './UploadError/UploadError';
import { UploadingIndicator } from './UploadingIndicator/UploadingIndicator';
import { ScaleControl } from './ScaleControl/ScaleControl';
import { CropActions } from './CropActions/CropActions';
import { CropStage } from './CropStage/CropStage';
import { MediaAssetUploaderHeader } from './MediaAssetUploaderHeader';
import type { CropStageRefs } from './CropStage';

export function MediaAssetUploader({
  templateId,
  variant,
  onUploaded,
  className = '',
  showHeader = true,
}: MediaAssetUploaderProps) {
  const config = MEDIA_ASSET_CONFIG[variant]!;
  const { t } = useTranslation(config.i18nNamespace);
  const cropConfig = config.cropConfig;

  const MAX_SCALE = cropConfig.MAX_SCALE;
  const MIN_SCALE = cropConfig.MIN_SCALE;
  // MediaAssetCropConfig is a union (LogoCropConfig | IconCropConfig | BackgroundCropConfig).
  // Background variant has CROP_WINDOW_WIDTH/HEIGHT; logo/icon variants have
  // CROP_WINDOW_SIZE (square). Cast to a structural shape that includes both
  // possible field names so TypeScript can resolve them.
  const cropWindowLike = cropConfig as unknown as {
    CROP_WINDOW_WIDTH?: number;
    CROP_WINDOW_HEIGHT?: number;
    CROP_WINDOW_SIZE?: number;
  };
  const CROP_WINDOW_WIDTH = cropWindowLike.CROP_WINDOW_WIDTH ?? cropWindowLike.CROP_WINDOW_SIZE ?? 0;
  const CROP_WINDOW_HEIGHT = cropWindowLike.CROP_WINDOW_HEIGHT ?? CROP_WINDOW_WIDTH;
  const BASE_CANVAS_WIDTH = cropConfig.BASE_CANVAS_WIDTH;

  // Variant-specific store action: logo → setIssuerLogo, icon → setIconImage, background → setBackgroundImage.
  const setStoreField = useCardBuilderStore(
    variant === 'logo'
      ? (s) => s.setIssuerLogo
      : variant === 'icon'
        ? (s) => s.setIconImage
        : (s) => s.setBackgroundImage,
  );

  // Component state
  const [state, setState] = useState<MediaAssetUploaderState>('idle');
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadedKey, setLastUploadedKey] = useState<string | null>(null);

  // Refs (shared with CropStage for drag/pan/momentum bookkeeping)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });
  const liveOffsetXRef = useRef(0);
  const liveOffsetYRef = useRef(0);
  const moveHistoryRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const momentumRafRef = useRef<number | null>(null);

  // Cancel in-flight momentum on unmount
  useEffect(() => {
    return () => {
      if (momentumRafRef.current !== null) {
        cancelAnimationFrame(momentumRafRef.current);
        momentumRafRef.current = null;
      }
    };
  }, []);

  // Image crop hook — output size driven by variant config.
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
    outputWidth: cropConfig.OUTPUT_WIDTH,
    outputHeight: cropConfig.OUTPUT_HEIGHT,
    cropWindowWidth: CROP_WINDOW_WIDTH,
    cropWindowHeight: CROP_WINDOW_HEIGHT,
    baseCanvasWidth: BASE_CANVAS_WIDTH,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
    initialScale: 1,
  });

  // ResizeObserver for stage width (replaces hard-coded VIEWPORT_PADDING math)
  const [availableWidth, setAvailableWidth] = useState<number>(BASE_CANVAS_WIDTH);
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !wrapperRef.current) return;
    const el = wrapperRef.current;
    const update = (entries?: ResizeObserverEntry[]) => {
      const w =
        entries && entries[0] ? entries[0].contentRect.width : el.offsetWidth;
      setAvailableWidth(w);
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => update(entries));
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', () => update());
    return () => window.removeEventListener('resize', () => update());
  }, []);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  // Derived geometry (Rule 028 § 12 Stage Height Invariant — same formula for both variants)
  const naturalCap =
    cropState.naturalWidth > 0 ? cropState.naturalWidth : BASE_CANVAS_WIDTH;
  const STAGE_SAFETY_MARGIN = 16;
  // Floor at MIN_STAGE_WIDTH (200) instead of CROP_WINDOW_WIDTH. The previous
  // floor (CROP_WINDOW_WIDTH = 800 for background variant) forced the stage
  // to 800px on a 376px phone viewport, overflowing the viewport and making
  // the white frame (480px wide, centered in the 360px-capped outer) appear
  // as full-width horizontal lines outside the container. The crop window
  // itself scales to `min(baseContainerW * 0.6, CROP_WINDOW_WIDTH)`, so it
  // always fits inside the stage regardless of stage size. The 200 floor
  // also covers the jsdom test case where `offsetWidth` reports 0 (so the
  // ResizeObserver-based `availableWidth` collapses to 0 and the floor
  // prevents a degenerate 0px-wide stage).
  const MIN_STAGE_WIDTH = 200;
  const baseContainerW = Math.min(
    naturalCap,
    BASE_CANVAS_WIDTH,
    Math.max(availableWidth - STAGE_SAFETY_MARGIN, MIN_STAGE_WIDTH),
  );

  const CROP_WINDOW_SHARE = 0.6;
  const responsiveCropWindowWidth = Math.min(
    baseContainerW * CROP_WINDOW_SHARE,
    CROP_WINDOW_WIDTH,
  );
  // For square crops (logo/icon), height equals width. For rectangular (background),
  // height = width × outputHeight/outputWidth (preserves output aspect).
  const responsiveCropWindowHeight = cropConfig.OUTPUT_HEIGHT !== null
    ? Math.round(responsiveCropWindowWidth * (cropConfig.OUTPUT_HEIGHT / cropConfig.OUTPUT_WIDTH))
    : responsiveCropWindowWidth;

  const FRAME_PADDING = 16;
  const aspectMatchedH =
    cropState.naturalWidth > 0
      ? Math.round(baseContainerW * (cropState.naturalHeight / cropState.naturalWidth))
      : BASE_CANVAS_WIDTH;
  const baseContainerH = Math.max(
    aspectMatchedH,
    responsiveCropWindowHeight + 2 * FRAME_PADDING,
  );
  // Apply same FRAME_PADDING floor to outer height for ALL variants (logo / icon / background).
  // Without this, portrait images make the stage much taller than the mask + padding,
  // causing the SVG mask hole and the white frame to center at different y-positions
  // (mask in stage coords, frame in outer coords), producing a visual misalignment.
  const outerContainerH = baseContainerH;

  // Sync resolvedBaseCanvasWidth into cropState
  useEffect(() => {
    if (
      cropState.naturalWidth > 0 &&
      cropState.resolvedBaseCanvasWidth !== baseContainerW
    ) {
      setCropState((prev) => ({ ...prev, resolvedBaseCanvasWidth: baseContainerW }));
    }
  }, [baseContainerW, cropState.naturalWidth, cropState.resolvedBaseCanvasWidth, setCropState]);

  // Refs held for the non-passive wheel listener
  const stateRef = useRef(state);
  stateRef.current = state;

  // Wheel-to-zoom (non-passive so preventDefault actually stops page scroll)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!hasImage || stateRef.current !== 'cropping') return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setCropState((prev) =>
        applyScaleChangeShared(prev, prev.scale + delta, baseContainerW, baseContainerH, MIN_SCALE, MAX_SCALE),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [hasImage, baseContainerW, baseContainerH, setCropState]);

  // Cancel any in-flight momentum + clear live offsets (used by CropStage on drag start)
  const stopMomentum = useCallback(() => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
    liveOffsetXRef.current = 0;
    liveOffsetYRef.current = 0;
  }, []);

  // Validator: variant-driven. The factory `validateMediaFile` (in shared) handles the actual logic.
  const validateFile = useCallback(
    (file: FileLike): ValidationError | null =>
      variant === 'logo'
        ? validateLogoFile(file)
        : variant === 'icon'
          ? validateIconFile(file)
          : validateBackgroundFile(file),
    [variant],
  );

  // File picker
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const fileError = validateFile(file);
      if (fileError) {
        setValidationError(fileError);
        setState('error');
        return;
      }

      try {
        await loadImage(file);
        setValidationError(null);
        setUploadError(null);
        setState('cropping');
      } catch {
        setUploadError(t('error'));
        setState('error');
      }

      e.target.value = '';
    },
    [loadImage, t, validateFile],
  );

  // Apply: crop → upload → persist template → notify parent
  const handleApplyCrop = useCallback(async () => {
    if (!hasImage) return;
    const img = imageRef.current;
    if (!img) {
      setUploadError(t('error'));
      setState('error');
      return;
    }
    setState('uploading');
    setUploadError(null);
    try {
      const blob = await cropImage();
      const { uploadUrl, key } = await cardService.generateUploadUrl(
        templateId,
        config.cardImageType,
      );
      // Defensive: verify R2 PUT actually succeeded. If it failed silently
      // (CORS rejection, network error, etc.), the key would be saved to
      // settings but R2 would have no object — leaving the preview broken.
      // Rule 028 § upload-error-handling: surface the failure to the user
      // instead of pretending success.
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/png' },
      });
      if (!putRes.ok) {
        throw new Error(
          `[MediaAssetUploader] R2 PUT failed: ${putRes.status} ${putRes.statusText}`,
        );
      }

      const currentTemplate = await cardService.getById(templateId);
      // Bug #8.5 defensive: use the shared unwrapCardSettings helper so we
      // handle object / JSON string / array-of-partials uniformly with the store.
      const safeSettings: Record<string, unknown> = unwrapCardSettings(currentTemplate.settings);
      await cardService.update(templateId, {
        settings: { ...safeSettings, [config.settingsField]: key },
      });

      // Variant-specific store setter
      setStoreField(key);
      setLastUploadedKey(key);
      setState('success');
      onUploaded?.(key);

      setTimeout(() => {
        setState('idle');
      }, 2000);
    } catch (err) {
      console.error('[MediaAssetUploader] Upload failed:', err);
      setUploadError(t('error'));
      setState('error');
    }
  }, [hasImage, imageRef, cropImage, templateId, onUploaded, setStoreField, t, config.cardImageType, config.settingsField]);

  const handleCancel = useCallback(() => {
    resetCrop();
    setValidationError(null);
    setUploadError(null);
    setState('idle');
  }, [resetCrop]);

  const handleScaleChange = useCallback(
    (newScale: number) => {
      setCropState((prev) =>
        applyScaleChangeShared(prev, newScale, baseContainerW, baseContainerH, MIN_SCALE, MAX_SCALE),
      );
    },
    [baseContainerW, baseContainerH, setCropState],
  );

  // ====================== Render ======================

  // Idle / Success: preview OR upload prompt
  if (state === 'idle' || state === 'success') {
    // Variant-specific store reads for the existing preview (when no fresh upload).
    const storeState = useCardBuilderStore.getState();
    const existingKey = variant === 'logo'
      ? storeState.issuerLogo
      : variant === 'icon'
        ? storeState.iconImage
        : storeState.backgroundImage;
    const existingVersion = variant === 'logo'
      ? storeState.issuerLogoVersion
      : variant === 'icon'
        ? storeState.iconImageVersion
        : storeState.backgroundImageVersion;
    const previewKey = lastUploadedKey ?? existingKey ?? null;
    const displayUrl = previewKey
      ? `${api.baseUrl}${api.paths.cardImage(templateId, config.cardImageType)}?token=${getAccessToken() ?? ''}&v=${existingVersion}`
      : undefined;

    return (
      <div
        ref={wrapperRef}
        data-testid="asset-crop-wrapper"
        className={`flex min-w-0 flex-col items-center gap-4 ${className}`}
      >
        {showHeader && (
          <MediaAssetUploaderHeader
            title={t('title')}
            description={t('hint')}
          />
        )}
        {displayUrl ? (
          <Preview
            displayUrl={displayUrl}
            showSuccessBadge={state === 'success'}
            replaceLabel={t('replace')}
            successLabel={t('success')}
            loadErrorLabel={t('loadError')}
            onReplace={() => fileInputRef.current?.click()}
          />
        ) : (
          <UploadPrompt
            selectFileLabel={t('selectFile')}
            hintLabel={t('hint')}
            onSelectFile={() => fileInputRef.current?.click()}
          />
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

  // Error
  if (state === 'error') {
    const errorMessage = validationError
      ? t(validationError.message)
      : uploadError ?? t('error');
    return (
      <div className={`flex min-w-0 flex-col items-center gap-4 ${className}`}>
        {showHeader && (
          <MediaAssetUploaderHeader
            title={t('title')}
            description={t('hint')}
          />
        )}
        <UploadError
          message={errorMessage}
          cancelLabel={t('cancel')}
          onCancel={handleCancel}
        />
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

  // Cropping / Uploading
  const cropStageRefs: CropStageRefs = {
    containerRef,
    isDraggingRef,
    liveOffsetXRef,
    liveOffsetYRef,
    moveHistoryRef,
    momentumRafRef,
    dragStartRef,
    offsetStartRef,
  };

  return (
    <div
      ref={wrapperRef}
      data-testid="asset-crop-wrapper"
      className={`flex min-w-0 flex-col items-center gap-4 ${className}`}
    >
      {showHeader && (
        <MediaAssetUploaderHeader
          title={t('title')}
          description={t('hint')}
        />
      )}
      {state === 'uploading' && <UploadingIndicator uploadingLabel={t('uploading')} />}

      {state === 'cropping' && (
        <>
          <p className="text-sm text-muted-foreground">{t('dragging')}</p>
          <CropStage
            baseContainerW={baseContainerW}
            baseContainerH={baseContainerH}
            outerContainerH={outerContainerH}
            responsiveCropWindowWidth={responsiveCropWindowWidth}
            responsiveCropWindowHeight={responsiveCropWindowHeight}
            cropState={cropState}
            setCropState={setCropState}
            imageUrl={imageUrl}
            imageRef={imageRef}
            onImageLoad={onImageLoad}
            isCroppingActive={state === 'cropping'}
            hasImage={hasImage}
            refs={cropStageRefs}
            stopMomentum={stopMomentum}
          />
          <ScaleControl
            scale={cropState.scale}
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.1}
            onChange={handleScaleChange}
            ariaLabel={t('scale')}
          />
          <CropActions
            cancelLabel={t('cancel')}
            resetLabel={t('reset')}
            applyLabel={t('apply')}
            onCancel={handleCancel}
            onReset={resetCrop}
            onApply={handleApplyCrop}
          />
        </>
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