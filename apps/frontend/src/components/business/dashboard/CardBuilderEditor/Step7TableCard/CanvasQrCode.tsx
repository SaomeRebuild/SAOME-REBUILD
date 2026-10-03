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
 * Hit region pattern mirrors `CanvasKonvaImage` Round 8: the wrapping
 * `<Group>` owns id + drag/transform events; the inner `<KonvaImage>`
 * has `listening={false}` so click events bubble to the Group. This
 * avoids the Konva.Image pixel-based hit detection issue (which would
 * miss clicks on the white background of the QR).
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
  // The inner KonvaImage is `listening={false}` to avoid Konva.Image
  // pixel-based hit detection missing clicks on the white background.
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
