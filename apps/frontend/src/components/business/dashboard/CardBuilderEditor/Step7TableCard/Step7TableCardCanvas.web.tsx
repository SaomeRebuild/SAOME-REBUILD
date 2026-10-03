/**
 * Step7TableCardCanvas — Web implementation (Konva).
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web
 * @description Konva-based canvas rendering. The A4 portrait stage is
 * sized in CSS pixels at PREVIEW_WIDTH_PX × PREVIEW_HEIGHT_PX (≈595×842
 * at 72 DPI for screen preview). The actual export uses EXPORT_WIDTH_PX
 * × EXPORT_HEIGHT_PX at 300 DPI.
 *
 * Web-only (Konva depends on HTMLCanvasElement). React Native gets a
 * `throw` stub in Step7TableCardCanvas.native.tsx (Rule 024 § Hook Split).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Stage,
  Layer,
  Group,
  Rect,
  Circle,
  Ellipse,
  Line,
  RegularPolygon,
  Text as KonvaText,
  Image as KonvaImage,
  Transformer,
} from 'react-konva';
import type Konva from 'konva';
import type { ReactElement } from 'react';
import useImage from 'use-image';
import {
  PREVIEW_WIDTH_PX,
  PREVIEW_HEIGHT_PX,
  TABLE_CARD_WIDTH_MM,
  TABLE_CARD_HEIGHT_MM,
  PREVIEW_SCALE,
} from '@saome/shared/constants/table-card';
import type {
  TableCardElement,
  TableCardBackground,
  TableCardImageElement,
  TableCardQrCodeElement,
} from '@saome/shared/schemas/card';
import { sortByZIndex, gradientAngleToEndPoints } from '@saome/shared/logic/tableCard';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Step7CanvasProps } from './Step7TableCard.types';
import {
  buildPolygonElementFromVertices,
  nextPolygonZIndex,
} from './Step7TableCard.polygonElement';
import { CanvasQrCode } from './CanvasQrCode';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

/**
 * Scale factor: convert mm → preview CSS px.
 *   595 px / 210 mm ≈ 2.83 px/mm
 * Used to position / size Konva nodes in mm coordinates.
 */
// 2026-10-04 — moved to @saome/shared/constants/table-card (single source of truth).
// Local definition removed; canvas now imports PREVIEW_SCALE from the
// shared constants block above (see `import { ... PREVIEW_SCALE } from
// '@saome/shared/constants/table-card';` near the top of this file).

/** Convert mm → px in the preview coordinate system. */
function mmToPx(mm: number): number {
  return mm * PREVIEW_SCALE;
}

/**
 * Convert a Konva pointer position to a polygon vertex in element-local
 * mm coords (Round 13, 2026-09-27).
 *
 * Konva's `stage.getPointerPosition()` returns CSS px relative to the
 * Stage DOM container. To get mm (the schema's canonical unit for
 * element positions), we need TWO conversions:
 *
 *   1. `pos.x / stageSize.scale` — un-scales for mobile Stage fit
 *      (desktop: scale=1 → no-op; mobile: scale < 1 → recovers the
 *      original PREVIEW_WIDTH_PX-equivalent internal coord).
 *   2. `... / PREVIEW_SCALE` — converts the internal stage px (which
 *      spans 0..PREVIEW_WIDTH_PX) into mm (which spans 0..TABLE_CARD_WIDTH_MM).
 *
 * The Round 10 implementation only did step 1, missing step 2 → every
 * vertex was stored as if it were mm but actually ≈ CSS px minus
 * bboxOrigin's mm value → preview rendered off-canvas, finish button
 * invisible.
 *
 * Exported for testing — see `Step7TableCardCanvas.test.tsx`
 * `Round 13 — click conversion helper` describe block.
 */
export function polygonPointerToLocalMm(
  pointerPos: { x: number; y: number },
  stageScale: number,
  bboxOrigin: { x: number; y: number },
): { localX: number; localY: number } {
  const conversionFactor = stageScale * PREVIEW_SCALE;
  return {
    localX: pointerPos.x / conversionFactor - bboxOrigin.x,
    localY: pointerPos.y / conversionFactor - bboxOrigin.y,
  };
}

/**
 * Bleed overlay — dashed-line safe-zone indicator (Issue 4).
 *
 * Renders an inset dashed rectangle at the bleed edge + a small label
 * tag in the top-left corner. Listening is disabled so the overlay
 * never blocks selection (Rule 013 § Modal/Drawer + canvas UX).
 *
 * Bleed values are stored in mm (table-card.bleedMm). The canvas
 * coordinate system is also mm (PREVIEW_SCALE converts to px).
 *
 * `listening={false}` ensures the dashed rectangle never intercepts
 * click / drag events intended for the underlying canvas. Without
 * this, clicking ON the dashed line would clear selection.
 */
function BleedOverlay({ bleedMm }: { bleedMm: number }): ReactElement {
  // Use the hook to access i18n for the label (top-left tag).
  // Kept inside the component to avoid a parent re-render dependency.
  // The `t` value is read inline so we just hard-code the label here;
  // a richer i18n-aware overlay can swap this for a ReactText.
  const inset = mmToPx(bleedMm);
  return (
    <>
      <Rect
        x={inset}
        y={inset}
        width={PREVIEW_WIDTH_PX - 2 * inset}
        height={PREVIEW_HEIGHT_PX - 2 * inset}
        // Bright orange (orange-500) — matches the "primary" semantic
        // color the editor uses elsewhere. Konva's dash syntax is
        // [dashLength, gapLength].
        stroke="#f97316"
        strokeWidth={1}
        dash={[8, 4]}
        listening={false}
        aria-label={`safe-zone-${bleedMm}mm`}
      />
    </>
  );
}

/** Background fill for the canvas (solid color or simulated gradient). */
function renderBackground(bg: TableCardBackground): ReactElement {
  if (bg.type === 'solid' && bg.color) {
    return (
      <Rect
        x={0}
        y={0}
        width={PREVIEW_WIDTH_PX}
        height={PREVIEW_HEIGHT_PX}
        fill={bg.color}
      />
    );
  }
  // Gradient: compute Konva fillLinearGradient{Start,End}Point from the
  // user-selected angle via the shared `gradientAngleToEndPoints` helper
  // (Round 7 fix — the previous version always drew a top-left →
  // bottom-right diagonal and ignored `bg.gradient.angle`).
  //
  // The export rasterizer uses Konva.LinearGradient for the exact
  // gradient; this preview path uses the same Konva primitive so the
  // two renderers stay visually consistent. Preview approximation is
  // acceptable for UX.
  if (bg.type === 'gradient' && bg.gradient) {
    const { start, end } = gradientAngleToEndPoints(
      bg.gradient.angle,
      PREVIEW_WIDTH_PX,
      PREVIEW_HEIGHT_PX,
    );
    return (
      <Rect
        x={0}
        y={0}
        width={PREVIEW_WIDTH_PX}
        height={PREVIEW_HEIGHT_PX}
        fillLinearGradientStartPoint={start}
        fillLinearGradientEndPoint={end}
        fillLinearGradientColorStops={[
          0,
          bg.gradient.from,
          1,
          bg.gradient.to,
        ]}
      />
    );
  }
  return (
    <Rect
      x={0}
      y={0}
      width={PREVIEW_WIDTH_PX}
      height={PREVIEW_HEIGHT_PX}
      fill="#ffffff"
    />
  );
}

/**
 * CanvasImage — renders a Konva `<Image>` for a table-card image element.
 *
 * Fix 2 (Round 2): the previous version rendered a gray placeholder Rect
 * with a TODO to load the actual image. This component finishes that
 * work — it loads the PNG via `useImage` (CORS-safe <img> loader with
 * onload/onerror), shows a loading placeholder while the request is in
 * flight, and falls back to a red dashed placeholder if R2 returns 404
 * (e.g. upload failed or the elementId was stale after a template
 * reload).
 *
 * The image URL points at the new backend route
 * `GET /api/cards/:cardId/table-card/element/image/:elementId` which
 * reads the R2 object at
 * `{tenantId}/{templateId}/table-card/{elementId}.png`.
 */
function CanvasImage({
  cardId,
  element,
  x,
  y,
  width,
  height,
  isSelected,
  onSelect,
  onChange,
}: {
  cardId: string | null;
  element: TableCardImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  onChange: (el: TableCardImageElement) => void;
}): ReactElement {
  // Same-origin via the Vite dev proxy or via the prod backend host. The
  // backend route accepts `?token=` so the <img> request still passes
  // auth (browsers don't attach Authorization headers on <img> fetches).
  const accessToken =
    typeof window !== 'undefined'
      ? window.sessionStorage.getItem('saome.accessToken')
      : null;
  const imageUrl = cardId
    ? `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/cards/${cardId}/table-card/element/image/${element.id}${
        accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''
      }`
    : '';
  // use-image's signature requires a string URL. Skip the hook when we
  // have no cardId (e.g. template not yet persisted) — render the
  // loading placeholder until cardId resolves.
  const [img, status] = useImage(imageUrl, 'anonymous');

  if (!imageUrl || status === 'loading') {
    // Round 7 (2026-09-27) — placeholder is now CLICKABLE.
    //
    // The previous version had `listening={false}` on the loading
    // Rect, which silently dropped the user's first click attempt
    // (the most likely moment — "did my image load yet?"). The click
    // then bubbled to the Stage's `onMouseDown` handler, which
    // clears selection (selectedId → null). After the image
    // finished loading, the user had to click again to attach the
    // Transformer. The fix: keep the placeholder's visual style
    // (gray dashed rect) but wire up onClick / onTap so any click
    // during loading still selects the element. Once the Konva.Image
    // is rendered, its own onClick / onTap continues to work, so
    // the behavior is consistent across the loading → loaded
    // transition.
    return (
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#e5e7eb"
        stroke="#9ca3af"
        strokeWidth={1}
        dash={[6, 4]}
        onClick={() => onSelect(element.id)}
        onTap={() => onSelect(element.id)}
      />
    );
  }

  if (status === 'failed' || !img) {
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

  return (
    <CanvasKonvaImage
      element={element}
      x={x}
      y={y}
      width={width}
      height={height}
      image={img}
      isSelected={isSelected}
      onSelect={onSelect}
      onChange={onChange}
    />
  );
}

/**
 * Wrapper around react-konva `<Image>` that handles drag/transform events.
 *
 * Round 7 (2026-09-27) — fixed clipShape='circle' / 'triangle' not
 * applying on the canvas. Root cause: Konva.Image accepts a `clipFunc`
 * prop in its attribute bag, but `clipFunc` is only USED by
 * Konva.Group / Konva.Layer / Konva.FastLayer's draw cycle — Shape
 * subclasses (including Image) ignore it. Setting `clipFunc` on a bare
 * `<KonvaImage>` is a no-op, so the user's clicks on "圓形" / "三角形"
 * updated `element.clipShape` correctly but the canvas kept rendering
 * the rectangular image.
 *
 * Fix:
 *   - clipShape === 'rect' (default): keep using Konva.Image's native
 *     `cornerRadius` prop (mm → px via PREVIEW_SCALE). clipRadius is
 *     passed through when > 0.
 *   - clipShape === 'circle' / 'triangle': wrap the `<KonvaImage>` in
 *     a `<Group clipFunc={...}>`. The Group owns the bounding box +
 *     id + drag/transform events, so the Transformer attaches to the
 *     Group via `stage.findOne(`#${selectedId}`)`. The inner Image
 *     has `listening={false}` so clicks bubble up to the Group
 *     (otherwise the Image would swallow them and onSelect would
 *     never fire).
 *
 * Konva documentation reference:
 *   - Konva.Image.cornerRadius() is a built-in method (works without Group).
 *   - Konva.Group.clipFunc is documented under
 *     https://konvajs.org/docs/clipping/Clipping_Function.html — it
 *     applies the user's draw call to a clipping context, then
 *     renders children inside.
 */
function CanvasKonvaImage({
  element,
  x,
  y,
  width,
  height,
  image,
  isSelected,
  onSelect,
  onChange,
}: {
  element: TableCardImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  image: HTMLImageElement;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  onChange: (el: TableCardImageElement) => void;
}): ReactElement {
  // Round 8 (2026-09-27) — unified click handling.
  //
  // All three clipShape branches now render through the same
  // <Group clipFunc={...}><KonvaImage listening={false} /></Group>
  // structure. The Group owns id / draggable / onClick / onTap /
  // onDragEnd / onTransformEnd / opacity; the inner Konva.Image is
  // pure rendering (listening={false} so events bubble to the
  // Group).
  //
  // This fixes the clickability regression reported on 2026-09-27:
  // "新上傳的圖片在畫布上一開始可以點選，後來又不行了，已經在畫布上的舊圖片也是不能點選"
  //
  // Root cause of the regression: the rect path previously used a
  // bare <KonvaImage ... onClick={handleClick} ... />. Konva.Image
  // uses pixel-based hit detection by default — clicks on
  // transparent pixels of the loaded image do NOT fire onClick.
  // For PNG uploads with transparent backgrounds (logos, stickers,
  // icons), the user could see the image but couldn't select it.
  // JPEG images also exhibited the bug intermittently when combined
  // with a fresh Konva.Image node mount.
  //
  // Wrapping in a Group gives the rect path a rectangular hit
  // region (the Group's bounding box), matching the circle /
  // triangle paths' behavior and the placeholder Rect's behavior.
  //
  // The Group's clipFunc is set ONLY for circle / triangle. For
  // rect, clipFunc evaluates to undefined → no clipping → the
  // Group's hit region is its full bounding box.
  //
  // The inner Konva.Image keeps `cornerRadius={...}` (round 6
  // rect-rounding feature). Konva.Image.cornerRadius still works
  // inside a Group because it's a built-in property that draws
  // rounded corners on the image's own pixels; the Group applies
  // its own transform AFTER child rendering.

  type KonvaClipCtx = Konva.Context;
  const clipShape = element.clipShape ?? 'rect';
  const cornerRadiusPx = mmToPx(element.clipRadius ?? 0);

  // Shared event handlers — bound to the wrapping Group, so
  // `e.target` is the Group itself (the node the Transformer
  // attaches to). The math is identical regardless of clipShape.
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onChange({
      ...element,
      x: e.target.x() / PREVIEW_SCALE,
      y: e.target.y() / PREVIEW_SCALE,
    });
  };
  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      ...element,
      x: node.x() / PREVIEW_SCALE,
      y: node.y() / PREVIEW_SCALE,
      width: (node.width() * scaleX) / PREVIEW_SCALE,
      height: (node.height() * scaleY) / PREVIEW_SCALE,
      rotation: node.rotation(),
    });
  };
  const handleClick = () => onSelect(element.id);
  const handleTap = () => onSelect(element.id);

  const clipFunc =
    clipShape === 'circle'
      ? (ctx: KonvaClipCtx) => {
          const radius = Math.min(width, height) / 2;
          ctx.beginPath();
          ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
          ctx.closePath();
        }
      : clipShape === 'triangle'
        ? (ctx: KonvaClipCtx) => {
            ctx.beginPath();
            ctx.moveTo(width / 2, 0);
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.closePath();
          }
        : undefined;

  return (
    <Group
      id={element.id}
      x={x}
      y={y}
      width={width}
      height={height}
      rotation={element.rotation}
      clipFunc={clipFunc}
      draggable
      onClick={handleClick}
      onTap={handleTap}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      opacity={isSelected ? 0.95 : 1}
    >
      {/* Hit-target Rect (Round 9, 2026-09-27) — gives the Group a
          hit region. Konva.Group's hit detection comes entirely
          from its listening children; with only a Konva.Image that
          has `listening={false}`, the Group has NO hit region and
          clicks fall through to the Stage (which clears selection
          via onMouseDown). This transparent Rect is invisible
          (`fill="rgba(0,0,0,0)"`) but hit-testable across the full
          local bounding box (x=0..width, y=0..height). Konva
          traverses children in reverse order for hit testing, so
          the Rect is hit first when the click lands on a visible
          image pixel; the event then bubbles up to the Group's
          onClick handler.

          For clipShape === 'circle' / 'triangle', the Group's
          clipFunc clips BOTH the visual canvas AND the hit canvas,
          so the Rect's hit region is properly limited to the
          shape's interior. Clicks outside the shape still fall
          through (correct deselect behavior). For
          clipShape === 'rect' (default, no clipFunc), the Rect's
          hit region spans the full bbox — clicks anywhere in the
          image footprint select it. This replaces the previous
          reliance on Konva.Image's pixel-based hit detection (which
          silently dropped clicks on transparent pixels of PNG
          uploads). */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="rgba(0,0,0,0)"
      />
      {/* Inner Image: fills the Group's local coordinate space at origin.
          listening={false} so pointer events on visible image pixels
          also bubble up to the Group via the hit-target Rect above
          (consistent path). Konva.Image.cornerRadius still renders
          rounded corners on the image's own pixels (rect rounding
          feature, Round 6) — it's a built-in property that draws
          after Group's transform pipeline. */}
      <KonvaImage
        image={image}
        x={0}
        y={0}
        width={width}
        height={height}
        cornerRadius={cornerRadiusPx > 0 ? cornerRadiusPx : undefined}
        listening={false}
      />
    </Group>
  );
}

/**
 * Render per-vertex markers for the polygon (numbered + draggable).
 *
 * Round 11 (2026-09-27) — replaces the previous 4-px blue dot with a
 * numbered, draggable marker. Used by:
 *   - `renderPolygonPreview` (creation mode): all in-progress vertices
 *     are draggable so the user can fine-tune the shape before finishing.
 *   - `renderElementInner` (finished polygon, only when `isSelected`):
 *     user can adjust vertex positions on an existing polygon.
 *
 * Each marker is a `<Group>` containing:
 *   - A small filled circle (4 px radius) — visible "grab target".
 *   - A Konva `<Text>` label (12 px, bold) at offset (6, -14) showing
 *     the 1-based vertex index. Lets the user identify vertex order.
 *
 * Drag behavior (when `opts.draggable`):
 *   - `onDragMove` reads the Group's current x/y (local mm coords
 *     since the markers live inside the bbox-offset parent Group),
 *     invokes `opts.onDragVertex`, then snaps the node back to its
 *     original position. We snap back to avoid Konva re-rendering
 *     the marker at the new position BEFORE the store commits —
 *     otherwise the visual lags behind the store state during a
 *     fast drag, producing jitter.
 *   - `onDragEnd` reads the Group's final x/y and commits via
 *     `opts.onDragVertex` (single source of truth).
 *
 * Marker hit region: each marker is 8 px (radius 4) circle, which is
 * large enough for finger taps on mobile but small enough not to
 * obscure nearby shapes. We rely on Konva's reverse-traversal hit
 * detection so the Group's children give the marker its hit region.
 */
function renderPolygonVertexMarkers(
  points: readonly number[],
  opts: {
    draggable: boolean;
    onDragVertex?: (
      vertexIndex: number,
      localX: number,
      localY: number,
    ) => void;
  },
  // Round 19 (2026-09-27) — mobile badge scale.
  //   - Desktop (isMobile=false): 20×20 chip, 32×32 hit area,
  //     fontSize 11. Compact so the markers don't overwhelm the
  //     polygon outline on the full-size A4 preview.
  //   - Mobile (isMobile=true):  28×28 chip, 44×44 hit area,
  //     fontSize 14. 4-grid aligned (7 × 4 = 28, 11 × 4 = 44)
  //     and meets Rule 013's ≥ 44-pt mobile touch-target floor
  //     so finger taps still register reliably.
  //
  // Color: Round 19 also switched the chip fill from blue
  // (`#3b82f6`) to orange (`#f97316` / Tailwind `orange-500`) so
  // the polygon tool's UI language matches the bleed overlay +
  // active-button outline ("主視覺顏色"). White bold number sits
  // on top — same contrast pairing used by the active toolbar
  // buttons.
  isMobile: boolean,
): ReactElement[] {
  // Geometry constants per platform. Picked once at helper entry
  // so the per-vertex render loop doesn't re-evaluate.
  const {
    chipSize,
    hitSize,
    fontSize,
    cornerRadius,
  }: { chipSize: number; hitSize: number; fontSize: number; cornerRadius: number } =
    isMobile
      ? { chipSize: 28, hitSize: 44, fontSize: 14, cornerRadius: 4 }
      : { chipSize: 20, hitSize: 32, fontSize: 11, cornerRadius: 3 };
  const chipHalf = chipSize / 2;
  const hitHalf = hitSize / 2;
  const out: ReactElement[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const vx = points[i];
    const vy = points[i + 1];
    if (typeof vx !== 'number' || typeof vy !== 'number') continue;
    const px = mmToPx(vx);
    const py = mmToPx(vy);
    const vertexIndex = i / 2;
    out.push(
      <Group
        key={`pv-${i}`}
        x={px}
        y={py}
        draggable={opts.draggable}
        onClick={(e) => {
          e.cancelBubble = true;
        }}
        onTap={(e) => {
          e.cancelBubble = true;
        }}
        onDragMove={(e) => {
          if (!opts.onDragVertex) return;
          const node = e.target;
          opts.onDragVertex(
            vertexIndex,
            node.x() / PREVIEW_SCALE,
            node.y() / PREVIEW_SCALE,
          );
          // Snap back so the visible marker stays at the stored
          // position (the store updates; we re-render on next tick).
          node.position({ x: px, y: py });
        }}
        onDragEnd={(e) => {
          if (!opts.onDragVertex) return;
          const node = e.target;
          opts.onDragVertex(
            vertexIndex,
            node.x() / PREVIEW_SCALE,
            node.y() / PREVIEW_SCALE,
          );
        }}
      >
        {/*
          Round 17 (2026-09-27) — minimal endpoint badge ON the vertex.

          Round 16 collapsed the marker (28-px blue circle with white
          stroke) and the dark chip (22×22 dark with white number)
          into a single visual object centered on the vertex.
          Geometry was correct (badge center == vertex), but the
          two-tone layered look read as TWO separate items: a
          「藍色白框外圈」 + 「深色編號 chip」. User feedback after
          Round 16:

            「形狀的端點跟端點的編號離很遠,他們不是應該在形狀的端點上嗎?
              而且端點編號形狀又被包了一層多餘的白框藍底樣式」

          Round 17 fix: drop the outer blue circle + white stroke
          wrapper entirely. Single 20×20 blue chip, white bold
          number, sitting on the vertex. No two-tone layered look,
          no chrome competing with the polygon shape. A subtle drop
          shadow keeps the badge visually distinct from the
          underlying shape without wrapping it in another colored
          ring.

          Hit region: a transparent Rect spans (-16, -16) to
          (+16, +16) around the vertex — meets the 32-pt mobile
          touch floor (Rule 013) so finger drags still register on
          polygon vertex markers without missing the chip's 20-px
          footprint.

          Round 19 (2026-09-27) — orange main-visual chip + mobile
          scale. Chip fill → `#f97316` (orange-500, the same color
          used by the bleed overlay and active-tool borders). Chip
          + hit-area sizes scale with `isMobile`: 20→28 chip, 32→44
          hit area, 11→14 fontSize on mobile. Numbers on mobile
          become readable at thumb-distance, and the larger hit
          area meets the ≥ 44-pt mobile touch-target floor (the
          32-px hit region already in place from Round 17 is just
          below that floor for true mobile use).
        */}
        <Rect
          x={-hitHalf}
          y={-hitHalf}
          width={hitSize}
          height={hitSize}
          fill="rgba(0,0,0,0)"
        />
        <Rect
          x={-chipHalf}
          y={-chipHalf}
          width={chipSize}
          height={chipSize}
          cornerRadius={cornerRadius}
          fill="#f97316"
          shadowColor="#000000"
          shadowBlur={4}
          shadowOpacity={0.25}
          shadowOffsetX={0}
          shadowOffsetY={1}
          listening={false}
        />
        <KonvaText
          text={String(vertexIndex + 1)}
          fontSize={fontSize}
          fontStyle="bold"
          fill="#ffffff"
          width={chipSize}
          height={chipSize}
          align="center"
          verticalAlign="middle"
          x={-chipHalf}
          y={-chipHalf}
          listening={false}
        />
      </Group>,
    );
  }
  return out;
}

/**
 * Render the in-progress polygon's preview (vertices + connecting
 * line). Called only when `polygonCreation` is non-null.
 *
 * Vertices are stored in element-LOCAL coords (relative to bbox
 * origin). For preview rendering we put the `<Group>` at the bbox
 * origin in canvas mm coords, then render the preview vertices
 * directly inside (so the group translates them to canvas position).
 *
 * Visual design (Round 11):
 *   - Connecting poly-line: dashed blue stroke (#3b82f6)
 *   - Vertex markers (Round 17, 2026-09-27): minimal numbered badge
 *     ON each vertex — single 20×20 blue chip with a white bold
 *     number, sitting centered on the vertex. Replaced the
 *     Round 16 two-tone layered look (blue circle wrapper + dark
 *     chip + number) which the user reported as 「多餘的白框藍底
 *     樣式包了一層」. Hit region comes from a transparent 32×32
 *     Rect that meets the 32-pt mobile touch floor.
 *   - The connecting line is `closed={false}` (we don't close the
 *     preview until the user finishes — closing it prematurely would
 *     visually look like a finished polygon).
 *   - Cursor-following dashed line: when `cursorPosMm` is non-null
 *     AND >= 1 vertex exists, append a fainter dashed line from the
 *     last vertex to the cursor. Helps the user visualize where the
 *     next click would land.
 *
 * Returns `null` if there's nothing to draw (0 vertices).
 */
function renderPolygonPreview(
  polygonCreation: {
    vertices: number[];
    bboxOrigin: { x: number; y: number };
  },
  cursorPosMm: { x: number; y: number } | null,
  onDragVertex: (
    vertexIndex: number,
    localX: number,
    localY: number,
  ) => void,
  // Round 19 (2026-09-27) — mobile-aware markers. The on-stage
  // preview uses the same vertex-marker helper as the finished
  // polygon; threading `isMobile` through keeps both code paths
  // consistent (preview + selected-finished get identical badge
  // sizing, so a user mid-draw sees the same affordances they'll
  // see after finishing).
  isMobile: boolean,
): ReactElement | null {
  const { vertices, bboxOrigin } = polygonCreation;
  if (vertices.length < 2) return null;
  const px = mmToPx(bboxOrigin.x);
  const py = mmToPx(bboxOrigin.y);
  const markerOpts = { draggable: true, onDragVertex };
  const cursorLine: ReactElement | null =
    cursorPosMm !== null && vertices.length >= 2
      ? (() => {
          const lastVx = vertices[vertices.length - 2] ?? 0;
          const lastVy = vertices[vertices.length - 1] ?? 0;
          return (
            <Line
              points={[
                mmToPx(lastVx),
                mmToPx(lastVy),
                cursorPosMm.x - px,
                cursorPosMm.y - py,
              ]}
              stroke="#3b82f6"
              // Round 14 — cursor line stroke 1 → 3 + dash [4,4] →
              // [8,6] for parity with the main preview stroke. The
              // 1-px version was barely visible on the printed A4
              // preview, especially over the bleed overlay.
              strokeWidth={3}
              dash={[8, 6]}
              opacity={0.7}
              listening={false}
            />
          );
        })()
      : null;
  return (
    <Group x={px} y={py}>
      <Line
        points={vertices.map((v) => mmToPx(v))}
        stroke="#3b82f6"
        // Round 14 — main preview line stroke 1.5 → 3, dash [6,4]
        // → [10,6]. The original 1.5 px stroke looked like a dot
        // when the user dragged the polygon preview across a light
        // background element; bumping width 2x and lengthening dash
        // units gives the polygon's "in-progress" outline enough
        // visual weight to stand out.
        strokeWidth={3}
        dash={[10, 6]}
        closed={false}
        listening={false}
      />
      {cursorLine}
      {renderPolygonVertexMarkers(vertices, markerOpts, isMobile)}
    </Group>
  );
}

export function Step7TableCardCanvas({
  stageRef: externalStageRef,
  cardId,
  tableCard,
  selectedId,
  onSelect,
  onChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAdd: _onAdd,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  readonly: _readonly,
}: Step7CanvasProps) {
  // Internal transformer ref stays local (lives with the Stage).
  const transformerRef = useRef<Konva.Transformer | null>(null);
  // Keep a stable alias for the body of the component.
  const stageRef = externalStageRef;
  // Round 12 (2026-09-27) — i18n for the in-canvas polygon finish
  // button. The text comes from `tableCard.shape.polygonFinish`
  // (zh-TW: '完成多邊形', en: 'Finish polygon'). Kept inline rather
  // than passed as a prop so the canvas remains the single source of
  // truth for its own rendering.
  const { t } = useTranslation('tableCard');

  // ===== Round 19 (2026-09-27) — mobile-aware rendering =====
  // `useIsMobile()` mirrors the Tailwind `sm:` breakpoint (640px -
  // 1px = 639px max-width). Threaded into `renderPolygonPreview`
  // and `renderPolygonVertexMarkers` so the polygon tool's vertex
  // badges scale up on mobile (28×28 chip + 44-pt hit area +
  // fontSize 14 vs 20×20 / 32-pt / 11 on desktop).
  const isMobile = useIsMobile();

  // ===== Round 10 (2026-09-27) — Polygon creation mode =====
  // Subscribe to the store's polygonCreation state + the actions
  // needed to advance the mode. The canvas is the "drawing surface"
  // (pointer events become vertex pushes) and the Inspector is the
  // "controls panel" (Start / Cancel buttons). Both subscribe to the
  // same store state, so the canvas re-renders preview lines as the
  // user clicks, and the Inspector re-renders its hint + button copy.
  // The Inspector owns the "start creation mode" affordance; the
  // canvas only needs to consume + advance the in-progress state.
  const polygonCreation = useCardBuilderStore((s) => s.polygonCreation);
  const appendPolygonVertex = useCardBuilderStore((s) => s.appendPolygonVertex);
  const finishPolygonCreation = useCardBuilderStore((s) => s.finishPolygonCreation);
  const cancelPolygonCreation = useCardBuilderStore((s) => s.cancelPolygonCreation);
  const updatePolygonVertex = useCardBuilderStore((s) => s.updatePolygonVertex);
  const addElement = useCardBuilderStore((s) => s.addTableCardElement);

  // When `polygonCreation` is non-null, the canvas is in "drawing"
  // mode — element drag / click-select / Transformer are disabled.
  // We freeze selection so the existing Transformer doesn't show on
  // the previously-selected element (it'd interfere with clicks).
  const isDrawingPolygon = polygonCreation !== null;

  // Round 11 (2026-09-27) — track cursor position in mm for the
  // "cursor-following dashed line" between the last vertex and the
  // pointer. Only meaningful while drawing a polygon.
  const [cursorPosMm, setCursorPosMm] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Keyboard handler for Esc (cancel) while drawing. Round 11 removed
  // the Enter handler because the canvas finish button takes over
  // (Issue 6 — Enter didn't fire reliably under React 19 strict mode
  // and was stolen by other input focus).
  useEffect(() => {
    if (!isDrawingPolygon) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelPolygonCreation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDrawingPolygon, cancelPolygonCreation]);

  // ===== Fix 4a (Round 2) — responsive stage sizing =====
  // The Stage is sized at PREVIEW_WIDTH_PX × PREVIEW_HEIGHT_PX on desktop
  // (≥ 595px container width). On mobile (container < 595px) we scale
  // the Stage via Konva's scaleX/scaleY so the bleed overlay, elements,
  // and Transformer all stay inside the visible canvas area. Without
  // this, the Stage itself overflows the container on small viewports
  // and the bleed line appears to extend past the canvas edge.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState<{
    width: number;
    height: number;
    scale: number;
  }>({
    width: PREVIEW_WIDTH_PX,
    height: PREVIEW_HEIGHT_PX,
    scale: 1,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const containerWidth = el.clientWidth;
      if (containerWidth <= 0) return; // not laid out yet
      if (containerWidth >= PREVIEW_WIDTH_PX) {
        setStageSize({
          width: PREVIEW_WIDTH_PX,
          height: PREVIEW_HEIGHT_PX,
          scale: 1,
        });
        return;
      }
      // Mobile: scale to fit container width while preserving A4 ratio.
      const scale = containerWidth / PREVIEW_WIDTH_PX;
      setStageSize({
        width: containerWidth,
        height: Math.round(
          containerWidth * (TABLE_CARD_HEIGHT_MM / TABLE_CARD_WIDTH_MM),
        ),
        scale,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Attach the Transformer to the currently-selected node.
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#${selectedId}`);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [selectedId, tableCard.elements, stageRef]);

  const sortedElements = sortByZIndex(tableCard.elements);

  // 2026-10-04 — QR Code 1:1 lock. The Transformer's `keepRatio` prop
  // is a boolean; we compute it from the currently selected element's
  // type. `useMemo` keeps the reference stable across unrelated
  // re-renders so Konva does not tear down + re-attach the Transformer
  // (which would briefly deselect on the next drag).
  const keepSelectedRatio = useMemo<boolean>(() => {
    if (!selectedId) return false;
    const el = tableCard.elements.find((e) => e.id === selectedId);
    return el?.type === 'qrcode';
  }, [selectedId, tableCard.elements]);

  return (
    <div ref={containerRef} className="w-full">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={stageSize.scale}
        scaleY={stageSize.scale}
        // Round 10 — `cursor` styling for polygon creation mode.
        // The CSS variable targets the canvas element so the user
        // sees the "drawing tool" cursor while in creation mode.
        style={isDrawingPolygon ? { cursor: 'crosshair' } : undefined}
        onMouseDown={(e) => {
          if (isDrawingPolygon && polygonCreation) {
            // Round 14 (2026-09-27) — Polygon creation: only DIRECT
            // stage clicks (empty canvas) push a new vertex. The
            // previous implementation pushed a vertex on ANY mousedown
            // inside the Stage, which meant clicking the in-canvas
            // "完成多邊形" floating button first registered as a
            // stray vertex push (the button's mousedown bubbles to the
            // Stage) before the button's onClick fired. The result:
            // the polygon landed with one extra vertex + the user
            // couldn't see the button respond.
            //
            // Gate by `e.target === e.target.getStage()` so the
            // mousedown path treats clicks on overlay nodes (finish
            // button, draggable vertex markers in `draggable:true`
            // mode, etc.) as not-a-vertex.
            const stage = e.target.getStage();
            if (!stage) return;
            // Direct stage hit = empty canvas; anything else = a
            // child Konva node already handled (or will handle) the
            // event via its own onClick / onTap / onDragStart.
            if (e.target !== stage) return;
            const pos = stage.getPointerPosition();
            if (!pos) return;
            const { localX, localY } = polygonPointerToLocalMm(
              pos,
              stageSize.scale,
              polygonCreation.bboxOrigin,
            );
            appendPolygonVertex(localX, localY);
            // Don't fall through to onSelect(null) — in drawing mode
            // clicks become vertex pushes, not deselects.
            return;
          }
          // Click on empty stage clears selection.
          if (e.target === e.target.getStage()) {
            onSelect(null);
          }
        }}
        onMouseMove={(e) => {
          // Round 11 — cursor-following dashed line. Only while
          // drawing a polygon; otherwise the cursor tracker is moot.
          if (!isDrawingPolygon) return;
          const stage = e.target.getStage();
          if (!stage) return;
          const pos = stage.getPointerPosition();
          if (!pos) return;
          setCursorPosMm({
            x: pos.x / stageSize.scale,
            y: pos.y / stageSize.scale,
          });
        }}
        onMouseLeave={() => {
          // Round 11 — hide cursor-following dashed line when the
          // pointer leaves the canvas. Avoids a stale "ghost" line
          // pointing at the last-known cursor position.
          setCursorPosMm(null);
        }}
        onTouchStart={(e) => {
          // Mobile parity for the mousedown handler. react-konva fires
          // the same events for touch; we just treat them like clicks.
          if (!isDrawingPolygon || !polygonCreation) return;
          // Round 14 (2026-09-27) — mirror the mousedown gate (only
          // direct stage hits push a vertex) so the floating UI
          // button (or any overlay node) doesn't add a stray vertex
          // before its own tap handler fires.
          const stage = e.target.getStage();
          if (!stage) return;
          if (e.target !== stage) return;
          // Round 13 (2026-09-27) — delegate to the same conversion
          // helper as onMouseDown (single source of truth for the
          // CSS-px → element-local-mm math).
          const pos = stage.getPointerPosition();
          if (!pos) return;
          const { localX, localY } = polygonPointerToLocalMm(
            pos,
            stageSize.scale,
            polygonCreation.bboxOrigin,
          );
          appendPolygonVertex(localX, localY);
        }}
      >
        {/* Background layer */}
        <Layer listening={false}>{renderBackground(tableCard.background)}</Layer>

        {/* Bleed overlay layer (Issue 4) — dashed safe-zone indicator.
            Sits ABOVE the background but BELOW the elements so users can
            still click elements through the dashed line (Rect listening={false}). */}
        <Layer listening={false}>
          <BleedOverlay bleedMm={tableCard.bleedMm} />
        </Layer>

        {/* Elements layer — sorted bottom-to-top by zIndex.
            Round 10 — when polygon creation is active, all elements
            render as non-interactive (draggable=false, no onClick)
            so clicks on existing elements fall through to the Stage
            and add vertices instead of selecting.

            Round 12 (2026-09-27) — Polygon preview + finish button
            are now CO-LOCATED inside this Layer (was previously in
            its own conditional <Layer> between elements and
            transformer, which caused React-Konva's reconciler to
            skip registration when transitioning from not-drawing →
            drawing. Co-locating keeps the Stage's Layer count
            stable at 4: bg / bleed / elements+preview / transformer).

            Polygon preview children stay conditional via JSX so the
            Layer container itself is always mounted. */}
        <Layer>
          {sortedElements.map((el) =>
            isDrawingPolygon
              ? renderElement(cardId, el, null, () => {}, onChange, isMobile, {
                  listening: false,
                })
              : renderElement(cardId, el, selectedId, onSelect, onChange, isMobile),
          )}
          {isDrawingPolygon && polygonCreation &&
            renderPolygonPreview(
              polygonCreation,
              cursorPosMm,
              (vertexIndex, localX, localY) =>
                updatePolygonVertex(vertexIndex, localX, localY),
              isMobile,
            )}
          {/* Round 11/12 — canvas finish button. Floats next to the
              last placed vertex; tapping it triggers the same
              finish flow as the toolbar's 「完成多邊形」 button.
              Only shown when >=3 vertices exist (else the store
              would discard the polygon anyway).

              Round 12 — text is now i18n-driven via
              `t('shape.polygonFinish')` (was hardcoded
              `"完成多邊形"`). `tableCard.shape.polygonFinish` exists
              in both zh-TW and en locale files.

              Round 14 (2026-09-27) — Bigger visuals + cancelBubble on
              mousedown/touchstart. Visual bumped from 56×32 to 92×42
              and fontSize 12 → 16; the previous size read as a
              "low-emphasis link" on a 595 px-wide A4 preview.
              `onMouseDown` + `onTouchStart` cancelBubble — belt +
              suspenders against the regression where the Stage's
              mousedown pushed a stray vertex before the button's
              click fired. Build the element via the shared
              `buildPolygonElementFromVertices` helper.

              Round 15 (2026-09-27) — also pass `bboxOrigin` so
              the shared builder can translate local-mm
              vertices into canvas-absolute-mm element x/y.
              Without this offset the produced shape landed at
              canvas-mm `(localMinX, localMinY)` — short of
              where the user clicked by exactly `bboxOrigin`.
              When the user drew near the canvas boundary, the
              shape's stored x/y went negative and the render
              dropped it outside the canvas.

              Round 16 (2026-09-27) — Tighter fit: button
              92×42 → 80×38, fontSize 16 → 20, text moved from
              corner-pinned `(12, 13)` to auto-centered via
              `width/height + align="center" + verticalAlign="middle"`.
              Text now reads as bigger relative to the box, padding
              is uniform (~10 px each side) instead of corner-pinned
              with a visible empty strip at the bottom-right. */}
          {isDrawingPolygon &&
            polygonCreation &&
            polygonCreation.vertices.length >= 6 &&
            (() => {
              const lastVx =
                polygonCreation.vertices[polygonCreation.vertices.length - 2] ?? 0;
              const lastVy =
                polygonCreation.vertices[polygonCreation.vertices.length - 1] ?? 0;
              const buttonX =
                mmToPx(polygonCreation.bboxOrigin.x + lastVx) + 14;
              const buttonY =
                mmToPx(polygonCreation.bboxOrigin.y + lastVy) + 14;
              const handleClick = (
                e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
              ) => {
                e.cancelBubble = true;
                const pts = finishPolygonCreation();
                if (pts) {
                  // Round 15 (2026-09-27) — pass bboxOrigin so the
                  // shared builder can translate local-mm vertices
                  // into canvas-absolute-mm element x/y. Without
                  // this offset the resulting shape renders at
                  // `bboxOrigin` short of where the user clicked.
                  addElement(
                    buildPolygonElementFromVertices(
                      pts,
                      nextPolygonZIndex(tableCard.elements),
                      polygonCreation.bboxOrigin,
                    ),
                  );
                }
              };
              // Belt + suspenders: also cancel mousedown / touchstart
              // so the Stage's onMouseDown (Round 14 gate) doesn't
              // see this as a "click on canvas" — the button is its
              // own hit target, not the Stage itself.
              const stopPointer = (
                e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
              ) => {
                e.cancelBubble = true;
              };
              return (
                <Group
                  x={buttonX}
                  y={buttonY}
                  onMouseDown={stopPointer}
                  onTouchStart={stopPointer}
                  onClick={handleClick}
                  onTap={handleClick}
                >
                  {/*
                    Round 16 (2026-09-27) — Done button fills its space.

                    Previous layout: Rect 92×42 with fontSize-16 text at
                    offset (12, 13). The text corner-pinned to the
                    upper-left and the remaining ~13×29 px of empty
                    space sat visibly at the bottom-right — user
                    feedback: 「完成按鈕留空太多」. New layout uses
                    Konva.Text's width/height + align="center" +
                    verticalAlign="middle" to auto-center the text
                    inside a tighter, slightly smaller button (80×38
                    with fontSize 20). Text grows 25% in glyph size
                    relative to the box, padding is uniform (~9-13 px
                    on each side depending on locale), matching the
                    "字大一點填滿空間,上下左右有一點 padding 就好"
                    feel. Color / stroke / shadow are unchanged. */}
                  <Rect
                    width={80}
                    height={38}
                    cornerRadius={8}
                    fill="#ffffff"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    shadowColor="#000000"
                    shadowBlur={6}
                    shadowOpacity={0.18}
                    shadowOffsetX={0}
                    shadowOffsetY={2}
                  />
                  <KonvaText
                    text={t('shape.polygonFinish')}
                    fontSize={20}
                    fontStyle="bold"
                    fill="#3b82f6"
                    width={80}
                    height={38}
                    align="center"
                    verticalAlign="middle"
                    x={0}
                    y={0}
                    listening={false}
                  />
                </Group>
              );
            })()}
        </Layer>

        {/* Transformer overlay — handles drag/resize/rotate of selected element.
            Hidden during polygon creation to keep the editing UX focused.
            Round 12 — this is now always the LAST child of Stage
            (Layer count is fixed at 4: bg / bleed / elements+preview /
            transformer). Previously sat after a conditional Layer which
            made the Layer index unstable when toggling polygon creation.
            2026-10-04 — keepRatio is now conditional on the selected
            element's type. QR codes are locked 1:1 (set by
            `addTableCardElement` AND by CanvasQrCode's onTransformEnd
            math). Other element types remain freely resizable. The
            `useMemo` keeps the boolean reference stable so Konva does
            not re-create the Transformer node on every parent render. */}
        <Layer listening={isDrawingPolygon ? false : undefined}>
          <Transformer
            ref={transformerRef}
            rotateEnabled
            keepRatio={keepSelectedRatio}
            visible={!isDrawingPolygon}
            borderStroke="#3b82f6"
            anchorStroke="#3b82f6"
            anchorFill="#ffffff"
            boundBoxFunc={(_oldBox, newBox) => {
              // Disallow shrinking below 5×5 px
              if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                return _oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}

/** Render a single element. */
function renderElement(
  cardId: string | null,
  el: TableCardElement,
  selectedId: string | null,
  onSelect: (id: string | null) => void,
  onChange: (el: TableCardElement) => void,
  // Round 19 (2026-09-27) — mobile-aware vertex markers. Threaded
  // through `renderElement` → `renderElementInner` so the polygon's
  // numbered badges (rendered only when the polygon is selected)
  // pick up the same scale as the on-canvas preview. Other element
  // kinds ignore the flag — their rendering paths don't depend on
  // the viewport size.
  isMobile: boolean,
  /** Round 10 — polygon-creation-mode override. When provided, the
   *  element renders inside a Group with `listening` overridden
   *  (no pointer events bubble up) so clicks fall through to the
   *  Stage and become polygon vertex pushes. */
  freeze?: { listening: boolean },
): ReactElement | null {
  const inner = renderElementInner(
    cardId,
    el,
    selectedId,
    onSelect,
    onChange,
    isMobile,
  );
  if (!freeze) return inner;
  return (
    <Group listening={freeze.listening} key={`freeze-${el.id}`}>
      {inner}
    </Group>
  );
}

/** Inner render of a single element (no freeze wrapper). */
function renderElementInner(
  cardId: string | null,
  el: TableCardElement,
  selectedId: string | null,
  onSelect: (id: string | null) => void,
  onChange: (el: TableCardElement) => void,
  // Round 19 (2026-09-27) — passed through to the polygon's
  // selected-marker render path. Other shape / text / image
  // branches ignore it; see comment on `renderPolygonVertexMarkers`.
  isMobile: boolean,
): ReactElement | null {
  const isSelected = el.id === selectedId;
  const x = mmToPx(el.x);
  const y = mmToPx(el.y);
  const width = mmToPx(el.width);
  const height = mmToPx(el.height);

  if (el.type === 'text') {
    return (
      <KonvaText
        key={el.id}
        id={el.id}
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={el.rotation}
        text={el.text}
        fontSize={mmToPx(el.fontSize)}
        fontStyle={el.fontWeight}
        fill={el.color}
        // Round 6 (2026-09-27) — multi-line text support.
        // `wrap="word"` makes Konva break long lines at word
        // boundaries inside `width`, and renders explicit "\n"
        // characters as new rows. Together with the <textarea>
        // input, users can now type multi-line text in the text
        // tool and have it render correctly on the canvas (and
        // export to PNG with the same layout).
        // `ellipsis={false}` prevents Konva from appending "…"
        // when content overflows `height` — the user can resize
        // the bounding box taller from the Transformer handles if
        // they need more vertical room.
        wrap="word"
        ellipsis={false}
        draggable={!isSelected || true}
        onClick={() => onSelect(el.id)}
        onTap={() => onSelect(el.id)}
        onDragEnd={(e) =>
          onChange({
            ...el,
            x: e.target.x() / PREVIEW_SCALE,
            y: e.target.y() / PREVIEW_SCALE,
          })
        }
        onTransformEnd={(e) => {
          const node = e.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...el,
            x: node.x() / PREVIEW_SCALE,
            y: node.y() / PREVIEW_SCALE,
            width: (node.width() * scaleX) / PREVIEW_SCALE,
            height: (node.height() * scaleY) / PREVIEW_SCALE,
            rotation: node.rotation(),
          });
        }}
        opacity={isSelected ? 0.95 : 1}
      />
    );
  }

  if (el.type === 'image') {
    // Fix 2 (Round 2): render the actual image via CanvasImage →
    // useImage → <Image>. Previously this was a placeholder Rect
    // (TODO comment removed). The element type + onChange wiring stays
    // the same; the canvas now correctly displays the uploaded PNG.
    return (
      <CanvasImage
        key={el.id}
        cardId={cardId}
        element={el}
        x={x}
        y={y}
        width={width}
        height={height}
        isSelected={isSelected}
        onSelect={onSelect}
        onChange={onChange}
      />
    );
  }

  // 2026-10-04 — QR Code element (Step 7 桌牌設計).
  // The `onChange` callback is typed `(el: TableCardElement) => void`
  // at the renderElementInner level; CanvasQrCode expects
  // `(el: TableCardQrCodeElement) => void`. The cast is safe here
  // because CanvasQrCode only receives QR elements (we just narrowed
  // with `el.type === 'qrcode'`) and never updates a non-QR element.
  if (el.type === 'qrcode') {
    return (
      <CanvasQrCode
        key={el.id}
        element={el}
        x={x}
        y={y}
        width={width}
        height={height}
        isSelected={isSelected}
        onSelect={onSelect}
        onChange={onChange as (el: TableCardQrCodeElement) => void}
      />
    );
  }

  if (el.type === 'shape') {
    // ===== Shape variants =====
    // Round 10 (2026-09-27) — added 'triangle' (RegularPolygon sides=3),
    // 'ellipse' (Konva.Ellipse), and 'polygon' (Line closed with user-
    // defined points). All four Konva primitive shapes (rect / circle /
    // triangle / ellipse) share the same drag / onChange / onTransformEnd
    // pattern; only the geometry math differs.
    //
    // Hit region: each primitive uses Konva's built-in pixel-accurate hit
    // detection for its own geometry, so we don't need a transparent Rect
    // wrapper here (unlike image elements — see `CanvasKonvaImage`).
    if (el.shape === 'rect') {
      return (
        <Rect
          key={el.id}
          id={el.id}
          x={x}
          y={y}
          width={width}
          height={height}
          rotation={el.rotation}
          fill={el.fill}
          cornerRadius={el.cornerRadius ?? 0}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth ?? 0}
          draggable
          onClick={() => onSelect(el.id)}
          onTap={() => onSelect(el.id)}
          onDragEnd={(e) =>
            onChange({
              ...el,
              x: e.target.x() / PREVIEW_SCALE,
              y: e.target.y() / PREVIEW_SCALE,
            })
          }
          onTransformEnd={(e) => {
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            onChange({
              ...el,
              x: node.x() / PREVIEW_SCALE,
              y: node.y() / PREVIEW_SCALE,
              width: (node.width() * scaleX) / PREVIEW_SCALE,
              height: (node.height() * scaleY) / PREVIEW_SCALE,
              rotation: node.rotation(),
            });
          }}
        />
      );
    }
    if (el.shape === 'circle') {
      return (
        <Circle
          key={el.id}
          id={el.id}
          x={x + width / 2}
          y={y + height / 2}
          radius={Math.min(width, height) / 2}
          rotation={el.rotation}
          fill={el.fill}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth ?? 0}
          draggable
          onClick={() => onSelect(el.id)}
          onTap={() => onSelect(el.id)}
        />
      );
    }
    // Round 11 (2026-09-27) — equilateral triangle.
    //
    // Round 10 had a critical bug: the RegularPolygon was positioned
    // at the bbox CENTER (`x + width/2, y + height/2`) with
    // `radius = Math.min(width, height) / 2`. The drag + transform
    // handlers tried to compensate by subtracting `width / 2` from
    // `node.x()`, but Konva's `RegularPolygon` has no intrinsic
    // `width()` / `height()` (it's radius-driven), so:
    //   1. `node.width()` returned 0 → `newW = 0 * scaleX = 0` after
    //      resize → triangle collapses.
    //   2. The closure captured the OLD `width / height` from before
    //      the last resize, so the next drag ended up at the wrong
    //      bbox position (the visible jump out of canvas).
    //
    // Round 11 fix: wrap the RegularPolygon in a `<Group>` so the
    // Group owns the bbox coords (top-left + width/height) and the
    // Transformer attaches to the Group instead. The math is now
    // identical to the rect branch — no center-offset compensation,
    // no width()/height() quirks.
    //
    // The RegularPolygon inside uses `radius = min(width, height) / 2`
    // and is positioned at (width/2, height/2) inside the Group's
    // local coordinate system (i.e. the bbox center). `listening={false}`
    // so pointer events bubble up to the Group's hit region.
    if (el.shape === 'triangle') {
      return (
        <Group
          key={el.id}
          id={el.id}
          x={x}
          y={y}
          width={width}
          height={height}
          rotation={el.rotation}
          draggable
          onClick={() => onSelect(el.id)}
          onTap={() => onSelect(el.id)}
          onDragEnd={(e) =>
            onChange({
              ...el,
              x: e.target.x() / PREVIEW_SCALE,
              y: e.target.y() / PREVIEW_SCALE,
            })
          }
          onTransformEnd={(e) => {
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            onChange({
              ...el,
              x: node.x() / PREVIEW_SCALE,
              y: node.y() / PREVIEW_SCALE,
              width: (node.width() * scaleX) / PREVIEW_SCALE,
              height: (node.height() * scaleY) / PREVIEW_SCALE,
              rotation: node.rotation(),
            });
          }}
        >
          {/* Round 12 (2026-09-27) — Hit-target Rect.
              Konva.Group 的 hit detection 完全靠 listening children。
              內部唯一的 <RegularPolygon listening={false}> 沒有 hit region,
              整個 Group 等於透明,點下去事件 fall through 到 Stage 的 onMouseDown
              把 selection 清掉(同 Round 9 image pattern 的根因)。
              這個 Rect 提供完整的 bbox hit region(fill 透明不影響視覺),
              Konva reverse-traversal hit detection 會先命中 Rect,
              事件 bubble 到 Group 的 onClick。Transformer attach 到 Group 時
              讀的是 Group 層級的 width()/height(),不受 Rect 影響。 */}
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="rgba(0,0,0,0)"
          />
          <RegularPolygon
            x={width / 2}
            y={height / 2}
            sides={3}
            radius={Math.min(width, height) / 2}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth ?? 0}
            listening={false}
          />
        </Group>
      );
    }
    // Round 11 — ellipse wrapped in <Group> for the same reason as
    // the triangle above. Konva.Ellipse's `width()` / `height()`
    // also returns 0 by default (it's radiusX/radiusY-driven). The
    // Group is the Transformer target and owns the bbox math.
    if (el.shape === 'ellipse') {
      return (
        <Group
          key={el.id}
          id={el.id}
          x={x}
          y={y}
          width={width}
          height={height}
          rotation={el.rotation}
          draggable
          onClick={() => onSelect(el.id)}
          onTap={() => onSelect(el.id)}
          onDragEnd={(e) =>
            onChange({
              ...el,
              x: e.target.x() / PREVIEW_SCALE,
              y: e.target.y() / PREVIEW_SCALE,
            })
          }
          onTransformEnd={(e) => {
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            onChange({
              ...el,
              x: node.x() / PREVIEW_SCALE,
              y: node.y() / PREVIEW_SCALE,
              width: (node.width() * scaleX) / PREVIEW_SCALE,
              height: (node.height() * scaleY) / PREVIEW_SCALE,
              rotation: node.rotation(),
            });
          }}
        >
          {/* Round 12 (2026-09-27) — Hit-target Rect.
              同 triangle branch 的根因:Konva.Group hit detection 完全靠
              listening children,<Ellipse listening={false}> 不貢獻 hit region。
              加 transparent Rect 讓整個 bbox 可被點擊。
              Round 9 image pattern 擴充套用到 ellipse。 */}
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="rgba(0,0,0,0)"
          />
          <Ellipse
            x={width / 2}
            y={height / 2}
            radiusX={width / 2}
            radiusY={height / 2}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth ?? 0}
            listening={false}
          />
        </Group>
      );
    }
    if (el.shape === 'line') {
      // ===== Round 19 (2026-09-27) — line hit region =====
      //
      // User feedback: "線段工具在移動裝置上的畫布很難被選取".
      // Root cause: a bare Konva.Line only does hit detection on
      // its 1D stroke path. Default strokeWidth is `el.strokeWidth
      // ?? 2` mm → 2 × PREVIEW_SCALE ≈ 5.7 CSS px on the 595-px
      // stage. After the mobile scale-to-fit (e.g. 320 CSS px / 595
      // ≈ 0.54×), the visible stroke is ≈ 3.1 CSS px wide — well
      // below the 44-pt mobile touch-target floor (Rule 013). The
      // user has to pixel-hunt to tap it.
      //
      // Fix: wrap the bare `<Line>` in a `<Group>` whose hit region
      // is a transparent `<Rect>` spanning the full local bbox.
      // This is the same pattern that the image / triangle / ellipse
      // branches already use (Rounds 9, 11, 12). Konva.Group has
      // no intrinsic hit region; the transparent Rect supplies one
      // across the entire bbox so any tap inside the line's bounding
      // area selects it. The inner `<Line>` keeps `listening={false}`
      // so events always bubble via the Rect (consistent with the
      // image / triangle / ellipse pattern).
      //
      // Drag math (x / y / width / height) moves to the Group so the
      // Transformer attaches to it via `stage.findOne('#${id}')` —
      // same wiring as rectangle / triangle / ellipse.
      return (
        <Group
          key={el.id}
          id={el.id}
          x={x}
          y={y}
          width={width}
          height={height}
          rotation={el.rotation}
          draggable
          onClick={() => onSelect(el.id)}
          onTap={() => onSelect(el.id)}
          onDragEnd={(e) =>
            onChange({
              ...el,
              x: e.target.x() / PREVIEW_SCALE,
              y: e.target.y() / PREVIEW_SCALE,
            })
          }
          onTransformEnd={(e) => {
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            onChange({
              ...el,
              x: node.x() / PREVIEW_SCALE,
              y: node.y() / PREVIEW_SCALE,
              width: (node.width() * scaleX) / PREVIEW_SCALE,
              height: (node.height() * scaleY) / PREVIEW_SCALE,
              rotation: node.rotation(),
            });
          }}
        >
          {/* Hit-target Rect — covers the full local bbox. Events
              bubble up to the Group via Konva's reverse-traversal
              hit detection (the Rect is the only listening child). */}
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="rgba(0,0,0,0)"
          />
          <Line
            points={[0, 0, width, height]}
            stroke={el.stroke ?? el.fill}
            strokeWidth={el.strokeWidth ?? 2}
            listening={false}
          />
        </Group>
      );
    }
    // Round 10 — arbitrary polygon. Stored as a flat points array in
    // element-local coords (relative to bbox top-left, before rotation).
    // Konva.Line with closed=true renders the polygon outline + fill.
    //
    // onTransformEnd differs from rect: points also have to be scaled by
    // scaleX / scaleY so subsequent renders use the new bbox. Without
    // this scaling, resizing the polygon would visually squash it (the
    // bbox grows but the absolute vertex coords don't follow).
    //
    // Round 11 — when the polygon is selected, render numbered,
    // draggable vertex markers so the user can fine-tune the shape
    // after creation. Markers live at the polygon's bbox-local
    // coords and update `el.points` on drag.
    //
    // Round 18 (2026-09-27) — `points={pts}` was a unit bug. `pts`
    // is stored in **bbox-local mm** (per `buildPolygonElementFromVertices`
    // and `packages/shared/schemas/card.ts`), but Konva.Line treats
    // `points` as raw canvas-px offsets from `(x, y)`. Passing mm
    // directly caused the visible triangle to render ~2.83× smaller
    // than the bbox (`PREVIEW_SCALE` ≈ 595 px / 210 mm) while the
    // vertex markers (which correctly used `mmToPx`) sat at the
    // true click positions. User feedback:
    //
    //   「編號與編號圍出來的大小與實際形狀不合,實際的形狀偏小。
    //     這些端點編號是不是該在三角型的角上?」
    //
    // Fix: convert every mm value to canvas-px before handing to the
    // Line. `width` / `height` are unaffected — Konva uses those only
    // for hit detection, not for clipping/rendering.
    if (el.shape === 'polygon') {
      const pts = el.points ?? [];
      const ptsPx = pts.map((v) => mmToPx(v));
      return (
        <>
          <Line
            key={el.id}
            id={el.id}
            x={x}
            y={y}
            width={width}
            height={height}
            points={ptsPx}
            closed
            rotation={el.rotation}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth ?? 0}
            draggable
            onClick={() => onSelect(el.id)}
            onTap={() => onSelect(el.id)}
            onDragEnd={(e) =>
              onChange({
                ...el,
                x: e.target.x() / PREVIEW_SCALE,
                y: e.target.y() / PREVIEW_SCALE,
              })
            }
            onTransformEnd={(e) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();
              node.scaleX(1);
              node.scaleY(1);
              const oldPts = el.points ?? [];
              const newPts: number[] = [];
              for (let i = 0; i < oldPts.length; i += 2) {
                const px = oldPts[i];
                const py = oldPts[i + 1];
                if (typeof px === 'number' && typeof py === 'number') {
                  newPts.push(px * scaleX, py * scaleY);
                }
              }
              onChange({
                ...el,
                x: node.x() / PREVIEW_SCALE,
                y: node.y() / PREVIEW_SCALE,
                width: (node.width() * scaleX) / PREVIEW_SCALE,
                height: (node.height() * scaleY) / PREVIEW_SCALE,
                rotation: node.rotation(),
                points: newPts,
              });
            }}
          />
          {isSelected && (
            <Group x={x} y={y}>
              {renderPolygonVertexMarkers(
                pts,
                {
                  draggable: true,
                  onDragVertex: (vertexIndex, localX, localY) => {
                    const nextPts = pts.slice();
                    const flatIdx = vertexIndex * 2;
                    if (flatIdx + 1 >= nextPts.length) return;
                    nextPts[flatIdx] = localX;
                    nextPts[flatIdx + 1] = localY;
                    onChange({ ...el, points: nextPts });
                  },
                },
                isMobile,
              )}
            </Group>
          )}
        </>
      );
    }
    return null;
  }

  // Fallback: render placeholder (should be unreachable since the union
  // is exhaustive over { text, image, shape }; defensive cast el.id to
  // string in case of corrupted JSONB).
  const fallbackId = (el as { id: string }).id;
  return (
    <Rect
      key={fallbackId}
      id={fallbackId}
      x={x}
      y={y}
      width={width}
      height={height}
      fill="#fef3c7"
      stroke="#f59e0b"
      strokeWidth={1}
      onClick={() => onSelect(fallbackId)}
    />
  );
}

export default Step7TableCardCanvas;
