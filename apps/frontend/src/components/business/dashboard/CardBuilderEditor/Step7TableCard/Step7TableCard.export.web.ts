/**
 * Step7TableCard.export — Web rasterizer.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.export.web
 * @description Rasterize a Konva Stage to a PNG Blob at print resolution
 * (2551×3579 px at 300 DPI for A4+bleed). The web implementation uses
 * `stage.toDataURL()` → Blob via fetch. Workerd has no Canvas API so this
 * lives client-side.
 *
 * Why client-side rasterization:
 *   - Workerd lacks the HTMLCanvasElement 2D context
 *   - node-canvas shim would bloat the Worker bundle
 *   - Konva already has the canvas backing — calling toDataURL is free
 *   - Frontend round-trip to backend is the standard approach for image
 *     uploads (the pre-signed URL pattern is harder for multi-MB blobs
 *     that need a single PUT)
 *
 * The exported PNG is uploaded to the backend via POST
 * `/api/cards/:id/table-card/export` (multipart/form-data with the Blob).
 *
 * Round 3 Fix 2 — use `pixelRatio` instead of `width/height` to compute
 * the export resolution. The caller (`useTableCardExport.handleExport`)
 * is responsible for resetting the Stage to nominal A4 dimensions
 * (`PREVIEW_WIDTH_PX × PREVIEW_HEIGHT_PX`, scale=1) before invoking this
 * function, then restoring the user's view in a `finally` block. With
 * the Stage at logical 595×842, a `pixelRatio` of
 * `EXPORT_WIDTH_PX / PREVIEW_WIDTH_PX ≈ 4.286` produces a 2551×3579 PNG.
 */

import { EXPORT_WIDTH_PX, PREVIEW_WIDTH_PX, PREVIEW_HEIGHT_PX } from '@saome/shared/constants/table-card';

/**
 * Pixel ratio used to upscale the Stage's logical 595×842 dimensions to
 * the export's ~2551×3609 dimensions. Computed from
 * `EXPORT_WIDTH_PX / PREVIEW_WIDTH_PX` so the math stays in one place
 * (single source of truth = `@saome/shared/constants/table-card`).
 *
 * Round 3 Fix 2 — `EXPORT_HEIGHT_PX` is now derived from this same ratio
 * (via `PREVIEW_HEIGHT_PX × EXPORT_PIXEL_RATIO`), so the width and
 * height ratios match exactly. Previously the two ratios diverged by
 * ~0.84% due to independent `Math.round` rounding in the constants,
 * which the module-level defensive check used to flag at import time.
 * That divergence is now gone by construction.
 */
const EXPORT_PIXEL_RATIO = EXPORT_WIDTH_PX / PREVIEW_WIDTH_PX;

export interface RasterizeOptions {
  /** Konva Stage instance to rasterize. */
  stage: unknown;
}

/**
 * Rasterize a Konva Stage to a PNG Blob at print resolution.
 *
 * **Prerequisite**: the caller MUST have reset the Stage to
 * `PREVIEW_WIDTH_PX × PREVIEW_HEIGHT_PX` with `scaleX = scaleY = 1` so
 * `pixelRatio` math holds. See `useTableCardExport.handleExport` for
 * the standard save → reset → rasterize → restore wrapper.
 *
 * @returns PNG Blob suitable for upload via FormData
 */
export async function rasterizeTableCard({
  stage,
}: RasterizeOptions): Promise<Blob> {
  // The Konva.Stage interface isn't importable here without dragging in
  // the full Konva type chain; use structural typing via unknown.
  const s = stage as {
    toDataURL: (opts: {
      x: number;
      y: number;
      width: number;
      height: number;
      pixelRatio: number;
      mimeType: string;
    }) => string;
  };
  // Use `pixelRatio` (not `width`/`height`) — passing width/height here
  // can fight with the Stage's current scale, especially if a caller
  // forgets to reset. `pixelRatio` simply scales the logical Stage
  // dimensions, which we just guaranteed are the nominal A4 size.
  const dataUrl = s.toDataURL({
    x: 0,
    y: 0,
    width: PREVIEW_WIDTH_PX,
    height: PREVIEW_HEIGHT_PX,
    pixelRatio: EXPORT_PIXEL_RATIO,
    mimeType: 'image/png',
  });
  // Convert data URL to Blob via fetch. Standard pattern; avoids base64
  // round-trip through atob/btoa.
  const res = await fetch(dataUrl);
  if (!res.ok) {
    throw new Error(`[rasterizeTableCard] fetch(${dataUrl.slice(0, 40)}) returned ${res.status}`);
  }
  return res.blob();
}

export default rasterizeTableCard;
