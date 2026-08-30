/**
 * CropStage — the main draggable + zoomable crop canvas.
 *
 * Composition (top to bottom):
 *   <outer> — provides dark background, sizes to fit image aspect OR mask + padding
 *     <stage> — overflow-hidden, captures PointerEvent / TouchEvent
 *       <innerCanvas> — fixed size, transform: scale for zoom
 *         <img> —  src image, transform: translate for pan offset
 *       </innerCanvas>
 *       <svg mask> — dim overlay outside the crop window
 *     </stage>
 *     <frameLayer> — white border around the crop window (sibling of stage,
 *                     pointer-events-none so it doesn't steal drag events)
 *   </outer>
 *
 * All drag/touch/momentum logic lives in this file because it closure-binds
 * to refs (containerRef, isDraggingRef, liveOffsetX/YRef, moveHistoryRef,
 * momentumRafRef) that the parent lifts up via props. See CropStage.types.ts
 * for the full prop contract.
 *
 * @module components/business/dashboard/CardBuilderEditor/LogoUploader/CropStage
 */

import type { CSSProperties } from 'react';
import {
  MOUSE_SENSITIVITY,
  TOUCH_SENSITIVITY,
  MOMENTUM_HISTORY_WINDOW_MS,
  MOMENTUM_MIN_VELOCITY,
  MOMENTUM_FRICTION,
  MOMENTUM_FRAME_MS,
} from '@saome/shared/constants/crop-interaction';
import { syncFocalFromOffset } from '@saome/shared/logic';
import type { CropState } from '@saome/shared/types';

/**
 * Refs the parent owns and passes to CropStage. Why parent-owns:
 * the consumer (LogoUploader) needs them for other things too —
 *   - containerRef: also used by the wheel-to-zoom effect
 *   - isDraggingRef / liveOffsetXRef/YRef: also read by calculateImageStyle()
 *   - moveHistoryRef / momentumRafRef: only used here, but still owned
 *     by parent for unified ref layout and accessibility to cleanup logic.
 */
export interface CropStageRefs {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isDraggingRef: React.MutableRefObject<boolean>;
  liveOffsetXRef: React.MutableRefObject<number>;
  liveOffsetYRef: React.MutableRefObject<number>;
  moveHistoryRef: React.MutableRefObject<Array<{ x: number; y: number; t: number }>>;
  momentumRafRef: React.MutableRefObject<number | null>;
  /** Drag-start cursor + offset snapshot refs. */
  dragStartRef: React.MutableRefObject<{ x: number; y: number }>;
  offsetStartRef: React.MutableRefObject<{ x: number; y: number }>;
}

export interface CropStageProps {
  // Geometry
  baseContainerW: number;
  baseContainerH: number;
  outerContainerH: number;
  responsiveCropWindow: number;
  // Crop state
  cropState: CropState;
  setCropState: React.Dispatch<React.SetStateAction<CropState>>;
  // Image
  imageUrl: string | null;
  imageRef: React.RefObject<HTMLImageElement | null>;
  onImageLoad: (el: HTMLImageElement | null) => void;
  // Drag state guard — parent tells us whether drag should activate
  isCroppingActive: boolean;
  hasImage: boolean;
  // Refs shared with parent
  refs: CropStageRefs;
  // Lifecycle: cancel momentum on unmount
  stopMomentum: () => void;
}

export function CropStage({
  baseContainerW,
  baseContainerH,
  outerContainerH,
  responsiveCropWindow,
  cropState,
  setCropState,
  imageUrl,
  imageRef,
  onImageLoad,
  isCroppingActive,
  hasImage,
  refs,
  stopMomentum,
}: CropStageProps) {
  const {
    containerRef,
    isDraggingRef,
    liveOffsetXRef,
    liveOffsetYRef,
    moveHistoryRef,
    momentumRafRef,
    dragStartRef,
    offsetStartRef,
  } = refs;

  /**
   * Mouse / pen drag start.
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasImage || !isCroppingActive) return;
    if (e.pointerType === 'touch') return;
    e.preventDefault();

    stopMomentum();

    liveOffsetXRef.current = cropState.offsetX ?? 0;
    liveOffsetYRef.current = cropState.offsetY ?? 0;

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { x: liveOffsetXRef.current, y: liveOffsetYRef.current };
    moveHistoryRef.current = [];

    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    if (e.pointerType === 'touch') return;

    const dx = (e.clientX - dragStartRef.current.x) * MOUSE_SENSITIVITY;
    const dy = (e.clientY - dragStartRef.current.y) * MOUSE_SENSITIVITY;

    const newX = offsetStartRef.current.x + dx;
    const newY = offsetStartRef.current.y + dy;

    liveOffsetXRef.current = newX;
    liveOffsetYRef.current = newY;
    const img = imageRef.current;
    if (img) {
      img.style.transform = `translate(${newX}px, ${newY}px)`;
    }
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const finalOffsetX = liveOffsetXRef.current;
    const finalOffsetY = liveOffsetYRef.current;

    setCropState((prev) => {
      const withFinalOffset = { ...prev, offsetX: finalOffsetX, offsetY: finalOffsetY };
      return syncFocalFromOffset(withFinalOffset, baseContainerW, baseContainerH);
    });
  };

  // Touch handlers — uses TouchEvent API for reliable mobile behavior
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!hasImage || !isCroppingActive) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();

    const touch = e.touches[0];
    stopMomentum();

    liveOffsetXRef.current = cropState.offsetX ?? 0;
    liveOffsetYRef.current = cropState.offsetY ?? 0;

    isDraggingRef.current = true;
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    offsetStartRef.current = { x: liveOffsetXRef.current, y: liveOffsetYRef.current };
    moveHistoryRef.current = [{ x: touch.clientX, y: touch.clientY, t: performance.now() }];
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();

    const touch = e.touches[0];
    const now = performance.now();

    const hist = moveHistoryRef.current;
    hist.push({ x: touch.clientX, y: touch.clientY, t: now });
    const cutoff = now - MOMENTUM_HISTORY_WINDOW_MS;
    while (hist.length > 0 && hist[0].t < cutoff) {
      hist.shift();
    }

    const dx = (touch.clientX - dragStartRef.current.x) * TOUCH_SENSITIVITY;
    const dy = (touch.clientY - dragStartRef.current.y) * TOUCH_SENSITIVITY;

    const newX = offsetStartRef.current.x + dx;
    const newY = offsetStartRef.current.y + dy;

    liveOffsetXRef.current = newX;
    liveOffsetYRef.current = newY;
    const img = imageRef.current;
    if (img) {
      img.style.transform = `translate(${newX}px, ${newY}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const finalOffsetX = liveOffsetXRef.current;
    const finalOffsetY = liveOffsetYRef.current;
    const hist = moveHistoryRef.current;
    const validHist = hist.filter((h) => h.x !== undefined && h.y !== undefined);

    if (validHist.length >= 2) {
      const first = validHist[0];
      const last = validHist[validHist.length - 1];
      const dt = last.t - first.t;

      if (dt > 0) {
        const vx = ((last.x! - first.x!) / dt) * TOUCH_SENSITIVITY;
        const vy = ((last.y! - first.y!) / dt) * TOUCH_SENSITIVITY;

        if (
          Math.abs(vx) > MOMENTUM_MIN_VELOCITY ||
          Math.abs(vy) > MOMENTUM_MIN_VELOCITY
        ) {
          let cvx = vx;
          let cvy = vy;
          moveHistoryRef.current = [];

          const tick = () => {
            if (
              Math.abs(cvx) < MOMENTUM_MIN_VELOCITY &&
              Math.abs(cvy) < MOMENTUM_MIN_VELOCITY
            ) {
              momentumRafRef.current = null;
              setCropState((prev) =>
                syncFocalFromOffset(prev, baseContainerW, baseContainerH),
              );
              return;
            }

            const stepX = cvx * MOMENTUM_FRAME_MS;
            const stepY = cvy * MOMENTUM_FRAME_MS;

            liveOffsetXRef.current = liveOffsetXRef.current + stepX;
            liveOffsetYRef.current = liveOffsetYRef.current + stepY;
            const img = imageRef.current;
            if (img) {
              img.style.transform = `translate(${liveOffsetXRef.current}px, ${liveOffsetYRef.current}px)`;
            }

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
          return;
        }
      }
    }

    setCropState((prev) => {
      const withFinalOffset = { ...prev, offsetX: finalOffsetX, offsetY: finalOffsetY };
      return syncFocalFromOffset(withFinalOffset, baseContainerW, baseContainerH);
    });
  };

  /**
   * Image CSS — read live offsets during drag (for zero-lag visual feedback)
   * else fall back to React state offsets.
   */
  function calculateImageStyle(): CSSProperties {
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

  return (
    <div
      data-testid="logo-crop-outer"
      className="relative mx-auto rounded-xl"
      style={{
        width: baseContainerW,
        height: outerContainerH,
        maxWidth: '100%',
        backgroundColor: '#1a1a1a',
      }}
    >
      <div
        ref={containerRef}
        data-testid="logo-crop-stage"
        className="absolute rounded-xl"
        style={{
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
          overflow: 'hidden',
          left: 0,
          top: 0,
          width: baseContainerW,
          height: baseContainerH,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="absolute"
          style={{
            width: baseContainerW,
            height: baseContainerH,
            transform: `scale(${cropState.scale})`,
            transformOrigin: `${baseContainerW / 2}px ${baseContainerH / 2}px`,
          }}
        >
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
        <svg
          className="pointer-events-none absolute inset-0"
          width={baseContainerW}
          height={baseContainerH}
          style={{ display: 'block' }}
        >
          <defs>
            <mask id="logo-crop-mask">
              <rect width={baseContainerW} height={baseContainerH} fill="white" />
              <rect
                x={(baseContainerW - responsiveCropWindow) / 2}
                y={(baseContainerH - responsiveCropWindow) / 2}
                width={responsiveCropWindow}
                height={responsiveCropWindow}
                rx="0.5rem"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width={baseContainerW}
            height={baseContainerH}
            fill="rgba(0,0,0,0.5)"
            mask="url(#logo-crop-mask)"
          />
        </svg>
      </div>

      {/* Crop frame layer — sibling of stage. pointer-events-none lets the
          border extend beyond stage bounds on landscape images. */}
      <div
        data-testid="logo-crop-frame-layer"
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div
          className="absolute rounded border-2 border-white/70"
          style={{
            width: responsiveCropWindow,
            height: responsiveCropWindow,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
}
