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

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
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

  // ===== Momentum / inertia (mobile UX) =====
  // On phones, releasing the finger after a quick drag should "flick" the
  // image onward (iOS / Android photo crop standard). Without this:
  //   - User drags 50px, releases → image stops immediately
  //   - To reach the desired position, user must re-grab and drag again
  //     (often many times for a large image) → "一次只能移動一點，要滑好幾次"
  //     feedback 20260830.
  //
  // Mechanism:
  //   - handlePointerMove pushes {x, y, t} into moveHistoryRef (sliding window
  //     of recent events, kept under MOMENTUM_HISTORY_WINDOW_MS old).
  //   - handlePointerUp samples the oldest and newest entries, computes
  //     velocity (px/ms), and if above MOMENTUM_MIN_VELOCITY starts an rAF
  //     loop that decays velocity by MOMENTUM_FRICTION each frame and adds
  //     to offsetX/offsetY until both axes drop below threshold.
  //   - handlePointerDown cancels any running momentum so the new drag has
  //     full control (no surprise continuation from a previous flick).
  //   - useEffect cleanup cancels rAF on unmount to avoid setState after
  //     unmount warnings.
  //
  // DRAG_SENSITIVITY: multiplier on the raw pointer delta. At 1x zoom the
  // focal center-to-edge range = baseContainerW/2 = 200 CSS px. With 1:1
  // sensitivity, a user needs to drag 200 px to shift the focal from center
  // to edge — a long swipe on mobile. 2.0x means 200/2.0 ≈ 100 px per
  // swipe to edge, which matches native iOS / Android photo cropper feel.
  // The focal itself moves faster (focal shift = dx * sensitivity /
  // baseContainerW), but the focal shift is clamped so it can never exceed
  // the image bounds, so overshoot is impossible.
  //
  // History: 1.5x (2026-08-30 first pass) still felt "bit by bit" to mobile
  // users per feedback 20260830. 2.0x matches the native cropper feel.
  const moveHistoryRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const momentumRafRef = useRef<number | null>(null);
  const MOMENTUM_HISTORY_WINDOW_MS = 120; // widened from 100ms to capture slower swipes
  const MOMENTUM_MIN_VELOCITY = 0.015; // lowered from 0.02: even slower swipes (0.24 px/frame) trigger momentum
  const MOMENTUM_FRICTION = 0.97; // raised from 0.96: slightly longer glide (~33 frames vs ~25)
  const MOMENTUM_FRAME_MS = 16; // ~60fps timestep for the rAF loop
  const DRAG_SENSITIVITY = 3.0; // raised from 2.0: per feedback 20260830, finger drag still felt "bit by bit" — matches native iOS / Android photo cropper feel (200/3 ≈ 67 px to traverse focal from center to edge)

  // ===== Live offset refs (bypass React reconciliation during drag) =====
  // React state updates trigger a full LogoUploader re-render (SVG mask,
  // crop window, scale slider, action buttons all reconcile). On mobile
  // pointer events fire at 60-120 Hz and React's batched reconciliation
  // creates visible stutter — image appears to jump in steps rather than
  // glide with the finger (feedback 20260830, second iteration).
  //
  // Fix: during active drag, write to a ref + the img.style.transform
  // directly. NO setCropState. React state only catches up on pointer up
  // (or during momentum, which already runs in rAF and is cheap).
  //
  // Why this is safe:
  //   - Refs don't trigger re-renders → no reconciliation lag
  //   - Direct DOM style writes are the fastest possible visual update
  //   - calculateImageStyle() falls back to liveOffset*Ref when
  //     isDraggingRef is true, so even if React *does* re-render (e.g.
  //     scale slider change mid-drag), the image stays at the live position
  //   - handlePointerUp syncs the final live values into React state before
  //     syncFocalFromOffset runs, so focal stays correct
  const liveOffsetXRef = useRef(0);
  const liveOffsetYRef = useRef(0);

  const stopMomentum = useCallback(() => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
  }, []);

  // Cancel in-flight momentum on unmount to avoid setState-after-unmount.
  useEffect(() => {
    return () => {
      if (momentumRafRef.current !== null) {
        cancelAnimationFrame(momentumRafRef.current);
        momentumRafRef.current = null;
      }
    };
  }, []);

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

  // ===== Responsive width tracking (Replaces fragile VIEWPORT_PADDING math) =====
  // Earlier version subtracted a hard-coded 128px from window.innerWidth, which
  // broke whenever a new padding wrapper was added above LogoUploader (the user
  // reported this on 2026-08-30: "頁面還是被撐開，出現了Y軸").
  //
  // New approach: measure the LogoUploader root's actual offsetWidth at
  // runtime via ResizeObserver. This handles ANY wrapper padding/margin/sidebar
  // automatically — the crop stage always fits within whatever space the
  // flex chain actually gave us.
  //
  // SSR safety: ResizeObserver doesn't exist on the server; we fallback to
  // BASE_CANVAS_WIDTH so the desktop default (400) is used until the effect
  // runs on the client.
  //
  // IMPORTANT: use useLayoutEffect (NOT useEffect) for the initial measurement.
  // useEffect runs AFTER the browser paints, so the first paint would show the
  // crop stage at `BASE_CANVAS_WIDTH = 400px` which overflows ≤412px viewports
  // (causing the horizontal scrollbar the user reported on 2026-08-30).
  // useLayoutEffect runs synchronously before paint, so the first paint the
  // user sees already has the correct, measured width. This is a standard
  // React pattern for "measure-then-render without layout thrashing".
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number>(BASE_CANVAS_WIDTH);

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !wrapperRef.current) return;
    const el = wrapperRef.current;
    const update = (entries?: ResizeObserverEntry[]) => {
      // Prefer contentRect.width from the entry (works in jsdom via the
      // polyfill). Fall back to offsetWidth for browsers / environments
      // where the entry isn't passed.
      const w = entries && entries[0]
        ? entries[0].contentRect.width
        : el.offsetWidth;
      if (process.env.NODE_ENV === 'test') {
        // eslint-disable-next-line no-console
        console.log(`[LogoUploader] availableWidth update: ${w} (tag=${el.tagName}, classList=${el.className.slice(0, 50)})`);
      }
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

  // ===== Compute derived values for rendering and drag =====

  // Base container size — the unscaled fit-to-natural-aspect crop canvas.
  // Container itself stays this size in layout (so zoom-in doesn't reflow
  // the surrounding UI); image and mask are scaled visually via a transform
  // applied to the inner stage so the user sees the image get bigger.
  //
  // Responsive cap: measured at runtime via ResizeObserver on the wrapper
  // (availableWidth = wrapper's offsetWidth = the actual horizontal space
  // the flex chain gave us). Then `min(BASE_CANVAS_WIDTH, availableWidth - 16)`
  // caps at the desktop 400px max OR (parent width − 16px safety margin),
  // whichever is smaller. The 16px safety margin handles sub-pixel rounding
  // and any scrollbar that might appear transiently — guaranteeing the
  // crop stage NEVER overflows the page wrapper, regardless of how many
  // padding wrappers exist above LogoUploader.
  //
  // On phones smaller than CROP_WINDOW_SIZE we floor at CROP_WINDOW_SIZE
  // so the crop window still fits inside the canvas (anything smaller
  // would clip the mask frame).
  const naturalCap = cropState.naturalWidth > 0 ? cropState.naturalWidth : BASE_CANVAS_WIDTH;
  const STAGE_SAFETY_MARGIN = 16; // px — keeps crop stage inside parent even with sub-pixel rounding
  const baseContainerW = Math.min(
    naturalCap,
    BASE_CANVAS_WIDTH,
    Math.max(availableWidth - STAGE_SAFETY_MARGIN, CROP_WINDOW_SIZE),
  );
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

      // Cancel any in-flight momentum so the new drag has full control.
      // Without this, releasing a flick and immediately starting a new drag
      // would still have the momentum loop racing to set offsetX/Y in the
      // background, causing the image to "jump" or fight the user's input.
      stopMomentum();
      moveHistoryRef.current = [];

      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      // Snapshot drag origin offsets so pointermove is delta-based.
      offsetStartRef.current = {
        x: cropState.offsetX ?? 0,
        y: cropState.offsetY ?? 0,
      };
      containerRef.current?.setPointerCapture(e.pointerId);
    },
    [hasImage, state, cropState.offsetX, cropState.offsetY, stopMomentum],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const now = performance.now();
      // Slide window: append current sample, drop any older than the window.
      const hist = moveHistoryRef.current;
      hist.push({ x: e.clientX, y: e.clientY, t: now });
      const cutoff = now - MOMENTUM_HISTORY_WINDOW_MS;
      while (hist.length > 0 && hist[0].t < cutoff) {
        hist.shift();
      }

      const dx = (e.clientX - dragStartRef.current.x) * DRAG_SENSITIVITY;
      const dy = (e.clientY - dragStartRef.current.y) * DRAG_SENSITIVITY;

      // Apply pan offset in pre-scale canvas space so 1 mouse px = 1 visual px
      // regardless of the current zoom scale.
      const newX = offsetStartRef.current.x + dx;
      const newY = offsetStartRef.current.y + dy;

      // === Direct DOM path (bypass React reconciliation for smooth drag) ===
      // Write to live refs first (no re-render), then push the transform
      // directly to the img element. This is the standard high-performance
      // drag pattern: visual feedback in <1ms via style mutation, React
      // reconciles asynchronously if/when other state changes.
      liveOffsetXRef.current = newX;
      liveOffsetYRef.current = newY;
      const img = imageRef.current;
      if (img) {
        img.style.transform = `translate(${newX}px, ${newY}px)`;
      }
      // NOTE: deliberately NOT calling setCropState here. handlePointerUp
      // syncs the final live values into React state before focal sync runs.
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Snapshot final drag position from live refs. During drag we bypassed
    // setCropState, so React state still holds the pre-drag offset. We need
    // to write the final offset into React state BEFORE running focal sync,
    // otherwise syncFocalFromOffset would compute focal from the stale
    // pre-drag offset and the exported crop would be off by the drag distance.
    const finalOffsetX = liveOffsetXRef.current;
    const finalOffsetY = liveOffsetYRef.current;

    // Try to start momentum from the velocity captured during the drag.
    // The move history contains samples within the last
    // MOMENTUM_HISTORY_WINDOW_MS — if the user was actively flicking, the
    // oldest and newest samples span a useful time interval for velocity.
    const hist = moveHistoryRef.current;
    let startedMomentum = false;
    if (hist.length >= 2) {
      const first = hist[0];
      const last = hist[hist.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) {
        const vx = ((last.x - first.x) / dt) * DRAG_SENSITIVITY; // scaled: momentum matches drag sensitivity
        const vy = ((last.y - first.y) / dt) * DRAG_SENSITIVITY;
        if (
          Math.abs(vx) > MOMENTUM_MIN_VELOCITY ||
          Math.abs(vy) > MOMENTUM_MIN_VELOCITY
        ) {
          // Mutating closure-captured locals: each tick sees the decaying
          // values. The rAF id is stored on a ref so handlePointerDown can
          // cancel mid-flick if the user immediately grabs again.
          let cvx = vx;
          let cvy = vy;
          const tick = () => {
            if (
              Math.abs(cvx) < MOMENTUM_MIN_VELOCITY &&
              Math.abs(cvy) < MOMENTUM_MIN_VELOCITY
            ) {
              momentumRafRef.current = null;
              // Final focal sync after momentum ends so cropImage() exports
              // the slice the user ended on (matches syncFocalFromOffset
              // behavior on direct drag release).
              setCropState((prev) =>
                syncFocalFromOffset(prev, baseContainerW, baseContainerH),
              );
              return;
            }
            const stepX = cvx * MOMENTUM_FRAME_MS;
            const stepY = cvy * MOMENTUM_FRAME_MS;
            // Live refs + direct DOM (same pattern as handlePointerMove) so
            // each momentum frame stays smooth even if React batches
            // setCropState updates.
            liveOffsetXRef.current = liveOffsetXRef.current + stepX;
            liveOffsetYRef.current = liveOffsetYRef.current + stepY;
            const img = imageRef.current;
            if (img) {
              img.style.transform = `translate(${liveOffsetXRef.current}px, ${liveOffsetYRef.current}px)`;
            }
            // Sync to React state too (used by tests; harmless in production
            // since direct DOM is already correct).
            setCropState((prev) => ({
              ...prev,
              offsetX: liveOffsetXRef.current,
              offsetY: liveOffsetYRef.current,
            }));
            cvx *= MOMENTUM_FRICTION;
            cvy *= MOMENTUM_FRICTION;
            momentumRafRef.current = requestAnimationFrame(tick);
          };
          momentumRafRef.current = requestAnimationFrame(tick);
          moveHistoryRef.current = [];
          startedMomentum = true;
        }
      }
    }

    if (!startedMomentum) {
      // No significant momentum — sync final drag position into React state
      // and then compute focal from that final position. Focal is the
      // export's source of truth (see useImageCrop.cropImage); offset is only
      // for display positioning.
      //
      // IMPORTANT: deps must include baseContainerW and baseContainerH. These
      // are computed from cropState.naturalWidth/Height which are 0 at first
      // render (BASE_CANVAS_WIDTH × BASE_CANVAS_WIDTH = 400×400 placeholder).
      // After the image loads, they recompute to match the image's aspect
      // (e.g. portrait 400×600, landscape 400×267). With empty deps this
      // callback would be created on first render with the 400×400 placeholder
      // and never recreated — every drag would use 400 as the denominator for
      // focalY even when baseContainerH is actually 600, shifting the export
      // crop by ~250 source px for a 100 px drag on portrait images.
      // Bug-φ root cause (2026-08-30 portrait crop position regression).
      setCropState((prev) => {
        const withFinalOffset = { ...prev, offsetX: finalOffsetX, offsetY: finalOffsetY };
        return syncFocalFromOffset(withFinalOffset, baseContainerW, baseContainerH);
      });
    }
  }, [baseContainerW, baseContainerH]);

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
   *
   * Offset source:
   *   - During active drag (isDraggingRef === true): liveOffsetXRef/YRef hold
   *     the freshest value (updated every pointermove, bypassing React). Use
   *     those so React re-renders mid-drag (e.g. scale slider change) don't
   *     snap the image back to the stale pre-drag React state.
   *   - Otherwise: React state's offsetX/Y. After pointer up we sync the final
   *     live value into React state, so this branch picks up the post-drag
   *     position. During momentum the rAF tick also writes setCropState, so
   *     this branch picks up momentum positions too.
   */
  function calculateImageStyle(): React.CSSProperties {
    const { naturalWidth, naturalHeight, offsetX = 0, offsetY = 0 } = cropState;

    const x = isDraggingRef.current ? (liveOffsetXRef.current ?? offsetX) : offsetX;
    const y = isDraggingRef.current ? (liveOffsetYRef.current ?? offsetY) : offsetY;

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
      transform: `translate(${x}px, ${y}px)`,
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
      <div ref={wrapperRef} className={`flex min-w-0 flex-col items-center gap-4 ${className}`}>
        {/* min-w-0: defensive — prevents the LogoUploader root from growing
            to fit crop stage's inline width and propagating the overflow up
            the flex chain (section → aside → CardBuilderEditor → page wrapper).
            Without it the crop stage can still horizontally overflow the page
            wrapper on mobile viewports. See feedback 20260830. */}
        {showPreview && displayUrl ? (
          <div className="flex min-w-0 flex-col items-center gap-3">
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
      <div className={`flex min-w-0 flex-col items-center gap-4 ${className}`}>
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
    <div ref={wrapperRef} className={`flex min-w-0 flex-col items-center gap-4 ${className}`}>
      {/* min-w-0: defensive — the cropping state contains the crop stage which
          sets an inline width (e.g. 329px on 412px viewport). Without min-w-0
          this container's min-content = 329px, which then propagates up
          through every flex ancestor without min-w-0 (section → aside →
          CardBuilderEditor flex-row → page wrapper), overflowing the viewport
          and forcing CardBuilderPage's overflow-auto to show a horizontal
          scrollbar. See feedback 20260830. */}
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
              enlarge from the center outward.
              maxWidth: '100%' is a belt-and-suspenders safety net: on the
              unlikely case that viewportW tracking lags (e.g. orientation
              change between paint and effect) the container still won't
              overflow its parent. */}
          <div
            ref={containerRef}
            data-testid="logo-crop-stage"
            className="relative mx-auto rounded-xl"
            style={{
              width: baseContainerW,
              height: baseContainerH,
              maxWidth: '100%',
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

          {/* Action buttons — flex-wrap so they wrap to a second row on
              narrow viewports instead of overflowing. justify-center keeps
              the layout balanced whether on one row or two. */}
          <div className="flex flex-wrap items-center justify-center gap-3">
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
