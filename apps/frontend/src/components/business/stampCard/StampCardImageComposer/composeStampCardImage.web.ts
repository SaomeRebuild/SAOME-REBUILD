/**
 * Stamp Card Image Composer — WEB binding (OffscreenCanvas + Canvas API).
 *
 * This is the platform-specific implementation of
 * `composeStampCardImage`. It runs **only** on web (browser / Node with
 * canvas polyfill) — never on React Native. The `.native.ts` stub
 * throws on RN; see Rule 024 § Hook Split Pattern.
 *
 * Drawing pipeline (per the plan § 2.2):
 *
 *   1. Initialize OffscreenCanvas with the input's dimensions
 *      (defaults to STAMP_DEFAULT_CANVAS 1024×640).
 *   2. Paint the background (color fill OR fetched image).
 *   3. Compute the per-cell layout via the shared pure function
 *      `computeStampGridLayout` (so the React preview and the
 *      rendered PNG share the same math).
 *   4. For each cell:
 *      - Draw a transparent stroke border (per spec, STAMP_GRID_LINE_COLOR
 *        is `rgba(0,0,0,0)`).
 *      - Draw the stamped / unstamped icon at the cell's center.
 *   5. Call `convertToBlob({ type: 'image/png' })` and return the blob.
 *
 * The returned Blob is the **only** thing the caller persists; the
 * canvas + image resources are released as soon as the function returns.
 */

import type { ComposeStampCardImageFn } from './StampCardImageComposer.types';
import {
  STAMP_GRID_LINE_COLOR,
  STAMP_DEFAULT_CANVAS,
} from '@saome/shared/constants/stampCard';
import { STAMP_FILL_CAP } from '@saome/shared/constants/stampCard';
import {
  computeStampGridLayout,
  resolveCellStampState,
} from '@saome/shared/logic/stampCardImage';
import { getStampIcon } from '@/assets/icons/stamps/manifest';

/**
 * Load an image for the canvas drawImage() call. Wraps the raw
 * `createImageBitmap` / `<img>` patterns to centralize the failure
 * mode (the function throws if the URL is invalid / unreachable).
 *
 * Uses `fetch` + `createImageBitmap` because it is the fastest path
 * on the browser: we skip the `<img>` element overhead and decode the
 * PNG directly. `createImageBitmap` is supported in all modern browsers
 * (Chrome 50+, Firefox 42+, Safari 15+, Edge 79+).
 */
async function loadImageBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `[composeStampCardImageOnWeb] background fetch failed: ${response.status} ${url}`,
    );
  }
  return createImageBitmap(await response.blob());
}

/**
 * The web implementation of the composer.
 *
 * 2026-10-13 implementation notes:
 *   - We use OffscreenCanvas to keep the work off the main DOM tree
 *     (large canvases are slow to render when attached). The blob is
 *     produced by `convertToBlob` rather than `toBlob` for the same reason.
 *   - Icons are loaded as Image() and pre-decoded via `img.decode()`
 *     to ensure the first drawImage call doesn't stall.
 *   - The grid is drawn with a transparent stroke (literal `STAMP_GRID_LINE_COLOR`)
 *     because the spec requires grid lines to NEVER be visible on the
 *     final image. Drawing a `strokeRect` with a transparent color is a
 *     no-op for the pixels, but the layout math is still computed by
 *     `computeStampGridLayout` so the cell positions are exact.
 */
export const composeStampCardImageOnWeb: ComposeStampCardImageFn = async (input) => {
  if (input.fillCount < 0 || input.fillCount > STAMP_FILL_CAP) {
    throw new RangeError(
      `composeStampCardImage: fillCount ${input.fillCount} out of range [0, ${STAMP_FILL_CAP}]`,
    );
  }
  if (input.gridColor !== 'transparent') {
    throw new Error(
      `composeStampCardImage: gridColor must be "transparent" (design contract), got "${input.gridColor}"`,
    );
  }

  const canvas = new OffscreenCanvas(
    STAMP_DEFAULT_CANVAS.width,
    STAMP_DEFAULT_CANVAS.height,
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('[composeStampCardImageOnWeb] 2D context unavailable');
  }

  // 1. Background — graceful fallback on expired / unreachable image URLs.
  //    `backgroundImage` in the store is an R2 pre-signed URL that can expire
  //    between the upload (Step 3) and the publish (Step 8). When the URL
  //    is stale, R2 returns an HTML error page; `createImageBitmap` then
  //    throws `InvalidStateError: The source image could not be decoded.`
  //    We catch this and fall back to the solid background color so the
  //    publish is not blocked by a broken background URL.
  //    (2026-10-14 root cause: expired R2 pre-signed URL.)
  if (input.background.type === 'color') {
    ctx.fillStyle = input.background.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    try {
      const bg = await loadImageBitmap(input.background.url);
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } catch (bgErr) {
      console.warn(
        `[composeStampCardImageOnWeb] background image failed to load ` +
        `(${input.background.url}), falling back to solid color. ` +
        `Error: ${bgErr instanceof Error ? bgErr.message : String(bgErr)}`,
      );
      // Fall through: the canvas is already transparent, which matches
      // `backgroundColor: '#ffffff'` (white) after reset().
      // Explicitly paint white so the canvas is never blank.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // 2. Resolve icon URLs from the manifest. The manifest is Vite's
  //    import.meta.glob output — `stampedUrl` and `unstampedUrl` are
  //    already resolved asset URLs, no need to fetch.
  const stampIcon = getStampIcon(input.iconId);
  if (!stampIcon) {
    throw new Error(
      `[composeStampCardImageOnWeb] unknown stamp icon "${input.iconId}" (no entry in manifest)`,
    );
  }
  const stampedUrl = stampIcon.stampedUrl;
  const unstampedUrl = stampIcon.unstampedUrl || stampedUrl;

  // 3. Compute layout.
  const layout = computeStampGridLayout(
    input.rows,
    input.cols,
    canvas.width,
    canvas.height,
  );

  // 4. Pre-decode both icons so drawImage is sync.
  const stampedImg = new Image();
  stampedImg.src = stampedUrl;
  const unstampedImg = new Image();
  unstampedImg.src = unstampedUrl;
  await Promise.all([stampedImg.decode(), unstampedImg.decode()]);

  // 5. Per-cell drawing.
  ctx.strokeStyle = STAMP_GRID_LINE_COLOR;
  ctx.lineWidth = 1;
  ctx.fillStyle = input.iconColor;

  for (const cell of layout.cells) {
    // Transparent grid border (literal `STAMP_GRID_LINE_COLOR`).
    ctx.strokeRect(cell.x, cell.y, cell.size, cell.size);

    const state = resolveCellStampState(cell.index, input.fillCount);
    const icon = state === 'stamped' ? stampedImg : unstampedImg;
    const pad = Math.max(2, Math.floor(cell.size * 0.1));
    ctx.drawImage(
      icon,
      cell.x + pad,
      cell.y + pad,
      cell.size - 2 * pad,
      cell.size - 2 * pad,
    );
  }

  // 6. Convert to PNG blob.
  return canvas.convertToBlob({ type: 'image/png' });
};
