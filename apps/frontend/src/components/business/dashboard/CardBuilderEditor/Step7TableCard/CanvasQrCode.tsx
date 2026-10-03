/**
 * CanvasQrCode — renders a Konva `<Image>` for a table-card QR code element.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/CanvasQrCode
 * @description Sub-component parallel to `CanvasImage` for the
 * `type: 'qrcode'` element variant (added 2026-10-04).
 *
 * Differs from `CanvasImage` in two material ways:
 *
 *   1. **No R2 round-trip.** The PNG is generated client-side on demand
 *      via the `useQrCode` hook (which wraps the `qrcode` npm library).
 *      Color / EC level changes regenerate the image synchronously;
 *      there is no `imageKey` to fetch from R2.
 *      See `runs/decisions/2026-10-04-qrcode-library-selection.md` for
 *      the architecture decision.
 *
 *   2. **Locked 1:1 aspect ratio.** The `addTableCardElement` action
 *      forces `height = width` on insert; the Transformer uses
 *      `keepRatio={true}` when the selected element is a QR. We do
 *      not render width/height inputs in the Inspector — the
 *      Transformer handles resize.
 *
 * 2026-10-04 — Hit-target Rect fix (parallels Round 9 / `CanvasKonvaImage`).
 *
 *   Root cause: Konva.Group's hit detection comes entirely from
 *   its listening children. With the inner `KonvaImage` set to
 *   `listening={false}` (which is correct — we want events on
 *   visible image pixels to bubble to the Group, not be caught by
 *   the Image's own pixel-based hit detection), the Group has
 *   NO listening descendants → NO hit region → clicks on the
 *   QR's bounding box fall through to the Stage → Stage's
 *   `onMouseDown` calls `onSelect(null)` (clears selection) →
 *   user reports "QR code can't be selected on the canvas".
 *
 *   This is the EXACT same bug Round 8/9 (2026-09-27) fixed for
 *   `CanvasKonvaImage`. The QR element shipped 2026-10-04 with
 *   the same Group-wrapped KonvaImage pattern but didn't apply
 *   the hit-target Rect fix — it worked for the loading / failed
 *   placeholder Rects (which have built-in hit detection) but
 *   not for the loaded Konva.Image branch.
 *
 *   Fix: add a transparent `<Rect>` as the first child of the
 *   Group, spanning the full local bbox (`x={0} y={0} width=...
 *   height=...`). Konva traverses children in reverse order for
 *   hit detection, so the Rect is hit first when the click
 *   lands on a visible QR pixel. The event then bubbles to the
 *   Group's onClick handler. The inner KonvaImage keeps
 *   `listening={false}` so we don't depend on Konva.Image's
 *   pixel-based hit detection (which would miss clicks on the
 *   white background pixels of a QR code — that's the most
 *   common click target).
 *
 *   Why QR is especially vulnerable to the original bug:
 *     A QR code is mostly white pixels (the `bgColor`) with
 *     black dots (the `fgColor`). Konva.Image's pixel-based
 *     hit detection requires the click to land on an opaque
 *     pixel. On a standard QR (~ 30% black / 70% white), the
 *     majority of the bounding box is the white background,
 *     so most clicks would miss hit detection. Even setting
 *     `listening={true}` on the KonvaImage wouldn't reliably
 *     fix this — the hit region would still be the rectangular
 *     bbox, but clicks on transparent / white-only regions of
 *     OTHER image types (e.g. PNGs with alpha) would still
 *     miss. The transparent Rect provides a consistent
 *     rectangular hit region that matches the Group's bbox.
 *
 *   See `runs/improvements/feedback/20261004-step7-qrcode-canvas-hit-region.md`
 *   for the full trace (user feedback, root cause analysis,
 *   test additions, and how this connects to Round 8/9).
 *
 * Hit region pattern mirrors `CanvasKonvaImage` Round 9: the wrapping
 * `<Group>` owns id + drag/transform events; the inner `<KonvaImage>`
 * has `listening={false}` so click events bubble to the Group; the
 * Group's hit region is supplied by a transparent `<Rect>` as its
 * first child (the fix added 2026-10-04 — same pattern as Round 9
 * for the image variant). Without that Rect, Konva.Group has no
 * listening descendants and clicks fall through to the Stage (which
 * clears selection via onMouseDown) — the bug reported as "QR code
 * can't be selected on canvas".
 *
 * The placeholder Rects in the loading / failed branches don't have
 * this bug because they ARE Rects (Konva.Rect has its own built-in
 * hit detection) and click handlers are wired directly to them. The
 * bug is unique to the loaded-Konva.Image branch because that's the
 * one that wraps Konva.Image with `listening={false}` inside a Group.
 *
 * QR-specific loading states:
 *   - 'loading' (or no image yet): render a light-gray dashed Rect
 *     placeholder so the user can see the element exists during the
 *     ~50ms encode.
 *   - 'failed': render a red dashed Rect with a stroke + a small
 *     "error" indicator. The Inspector still works — user can change
 *     fgColor / bgColor / ecLevel to retry.
 */

import { Group, Rect, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { ReactElement } from 'react';
import { useQrCode } from '@/hooks/useQrCode';
import { PREVIEW_SCALE } from '@saome/shared/constants/table-card';
import type { TableCardQrCodeElement } from '@saome/shared/schemas/card';

interface CanvasQrCodeProps {
  element: TableCardQrCodeElement;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  onChange: (el: TableCardQrCodeElement) => void;
}

/**
 * CanvasQrCode — Konva renderer for a single QR element.
 *
 * @returns Konva Group with hit region + (optional) image, or a
 *          placeholder Rect while the QR is being encoded.
 */
export function CanvasQrCode({
  element,
  x,
  y,
  width,
  height,
  isSelected,
  onSelect,
  onChange,
}: CanvasQrCodeProps): ReactElement {
  // useQrCode returns `[image, status]`. The hook regenerates the
  // image whenever (text, fgColor, bgColor, errorCorrectionLevel)
  // change, so color picker drags naturally invalidate the cache.
  const [qrImg, status] = useQrCode(
    element.value,
    element.fgColor,
    element.bgColor,
    element.errorCorrectionLevel,
  );

  // Loading placeholder — light gray dashed rect, clickable so the
  // user can attach the Transformer before the QR finishes encoding.
  if (status === 'loading' || !qrImg) {
    return (
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#f3f4f6"
        stroke="#9ca3af"
        strokeWidth={1}
        dash={[6, 4]}
        onClick={() => onSelect(element.id)}
        onTap={() => onSelect(element.id)}
      />
    );
  }

  // Failure placeholder — red dashed rect (mirrors CanvasImage).
  if (status === 'failed') {
    return (
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#fee2e2"
        stroke="#dc2626"
        strokeWidth={1}
        dash={[6, 4]}
        onClick={() => onSelect(element.id)}
        onTap={() => onSelect(element.id)}
      />
    );
  }

  // Loaded: wrap the Konva.Image in a Group so the Group owns the
  // hit region (rectangular bbox) and the drag/transform events.
  // The inner KonvaImage is `listening={false}` so click events bubble
  // to the Group. We MUST also add a transparent hit-target Rect as
  // the Group's first child — see the file header for the full
  // rationale (parallels Round 9 / `CanvasKonvaImage`).
  return (
    <Group
      id={element.id}
      x={x}
      y={y}
      width={width}
      height={height}
      rotation={element.rotation}
      draggable
      onClick={() => onSelect(element.id)}
      onTap={() => onSelect(element.id)}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
        onChange({
          ...element,
          x: e.target.x() / PREVIEW_SCALE,
          y: e.target.y() / PREVIEW_SCALE,
        });
      }}
      onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
        const node = e.target;
        // keepRatio=true on the Transformer guarantees scaleX === scaleY,
        // but we still apply both axes' scales to width / height defensively
        // (one of them is redundant, but writing both is clearer).
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const newWidth = (node.width() * scaleX) / PREVIEW_SCALE;
        const newHeight = (node.height() * scaleY) / PREVIEW_SCALE;
        onChange({
          ...element,
          x: node.x() / PREVIEW_SCALE,
          y: node.y() / PREVIEW_SCALE,
          // Lock 1:1 — use the larger of the two scales (they should
          // be equal under keepRatio, but be defensive).
          width: Math.max(newWidth, newHeight),
          height: Math.max(newWidth, newHeight),
          rotation: node.rotation(),
        });
      }}
      opacity={isSelected ? 0.95 : 1}
    >
      {/* Hit-target Rect (2026-10-04) — gives the Group a rectangular
          hit region. Konva.Group has no intrinsic hit detection; with
          only a `listening={false}` Konva.Image child, clicks fall
          through to the Stage and selection is cleared via
          onMouseDown. This transparent Rect spans the Group's local
          bbox (x=0..width, y=0..height), making the entire QR area
          clickable. Konva traverses children in reverse order for hit
          detection, so this Rect is hit first. Clicks bubble up to
          the Group's onClick handler. `fill="rgba(0,0,0,0)"` makes it
          invisible (no visual effect). See the file header for the
          full rationale + connection to Round 8/9 (image hit region
          fix). */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="rgba(0,0,0,0)"
      />
      <KonvaImage
        image={qrImg}
        x={0}
        y={0}
        width={width}
        height={height}
        listening={false}
      />
    </Group>
  );
}
