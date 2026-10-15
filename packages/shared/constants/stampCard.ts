/**
 * Stamp Card Image Composition Constants (2026-10-13).
 *
 * @module shared/constants/stampCard
 * @description Pure constants for the stamp card image composition pipeline.
 *
 * These constants are the single source of truth for:
 *   - `STAMP_FILL_CAP` — the cost-optimization ceiling (15). Pinning this
 *     here lets the renderer, the upload endpoint, and the DB CHECK
 *     constraint all reference the same number.
 *   - `STAMP_GRID_LINE_COLOR` — the literal RGBA string the renderer
 *     uses for `ctx.strokeStyle`. The design contract pins it to
 *     `rgba(0,0,0,0)` so grid lines are **always transparent**.
 *   - `STAMP_DEFAULT_CANVAS` — default output dimensions for the
 *     composer. The frontend can override per-template.
 *
 * Why a separate file (not appended to the existing `stamp-card.ts`):
 *   - `stamp-card.ts` is about **Step 6 reward logic** (accrual mode,
 *     reward type, per-visit/spend thresholds). That is a different
 *     concern from **image composition** (canvas size, fill cap, grid
 *     line color). Conflating them in one file would muddy the "what is
 *     this constant used for" lookup.
 *   - The image-composition constants are referenced by the renderer
 *     (`.web.ts`), the schema (`schemas/stampCard.ts`), the upload
 *     service, and the DB migration's CHECK constraint. Keeping them
 *     in one file makes the contract visible at a glance.
 */

/**
 * Maximum number of cells to mark as "stamped" in a single rendered image.
 *
 * The cap is the **cost-optimization ceiling** confirmed by the user on
 * 2026-10-13:
 *
 *   "CardBuilder 產 0.png (空模板)，之後 Scanner 產 1.png~n.png，cap = 16.png
 *    後不再生成。用意在於節省 R2 空間，也節省租戶的前端算力。"
 *
 * Translation: CardBuilder produces 0.png (empty template); subsequently
 * the Scanner produces 1.png~n.png; once 16.png is reached, no more files
 * are generated. The purpose is to save R2 storage and to save the
 * tenant's frontend compute.
 *
 * On-disk file naming: `${fillCount}.png` where `fillCount ∈ [0, 15]`.
 * That gives 16 files per template: `0.png` through `15.png`.
 *
 * Why 15 and not the natural `rows*cols` (e.g. 20 for a 4×5 grid):
 * the user explicitly chose 15 as the cost cap. Templates with larger
 * physical grids still only generate 16 files; the 16th-20th cell
 * positions in the 4×5 case would never be marked as "stamped" in the
 * cap state (15.png). This is an intentional tradeoff — see
 * `runs/improvements/feedback/20261013-stamp-card-image-composition-frontend.md`
 * for the design rationale.
 */
export const STAMP_FILL_CAP = 15;

/**
 * RGBA color string for the grid line.
 *
 * Pinned to `rgba(0,0,0,0)` (fully transparent). The design contract
 * requires grid lines to **never** be visible on the rendered image —
 * the grid is implied by the cell layout, not drawn on top of the
 * icons. The Passcreator V2 push also relies on this: a visible grid
 * would render as a black/grey border on the customer's physical pass.
 *
 * Why a string literal (not a derived constant): the renderer uses
 * `ctx.strokeStyle = STAMP_GRID_LINE_COLOR` directly, and a literal
 * avoids any chance of an accidental color override at the canvas layer.
 */
export const STAMP_GRID_LINE_COLOR = 'rgba(0,0,0,0)';

/**
 * Default canvas dimensions (in pixels) for the rendered stamp card image.
 *
 * 2026-10-15 (v15) — Aligned with Passcreator's strip image spec
 * (1860×738 pixels minimum, aspect ratio ≈ 2.52:1) per
 * `packages/shared/constants/card-images.ts::BACKGROUND_CROP_CONFIG`.
 *
 * The previous 1024×640 (16:10) caused Issue 3 — Passcreator's strip
 * slot expects 2.52:1 aspect; the smaller image was scaled/cropped on
 * the server side and the stamp grid (drawn assuming 16:10) ended up
 * visually off-center on the deployed pass. Sourcing the canvas from
 * the strip-spec aspect ratio means Passcreator consumes the image
 * 1:1 with no rescaling — the grid's `(x, y, size)` math in
 * `computeStampGridLayout` lands exactly where the user sees it in
 * the React preview.
 *
 * Reference: PassKit / Passcreator strip image spec — 1860×738 px
 * minimum, larger keep ratio. SAOME's R2 PUT cap is 4 MB; a
 * 1860×738 PNG with grid + stamped icons is well under that
 * (~100-300 KB empirically).
 */
export const STAMP_DEFAULT_CANVAS = {
  width: 1860,
  height: 738,
} as const;

/**
 * Padding between the canvas edge and the stamp grid (in pixels).
 *
 * Mirrors the existing `STRIP_INNER_PADDING = 8` constant in
 * `StampGridPreview.utils.ts` so the rendered image and the in-app
 * preview share the same visual rhythm. Keeping the two in sync avoids
 * the "preview looks different from the actual pass" bug that the
 * existing v6-v13 Step 8 family of contract-misread bugs
 * (`feedback/20261012-step8-passcreator-v13-...`) has historically
 * suffered.
 */
export const STAMP_CANVAS_INNER_PADDING = 8;

/**
 * Gap between adjacent stamp cells (in pixels).
 *
 * Same as `CELL_GAP = 4` in the existing `StampGridPreview.utils.ts`.
 * Mirrored here so the composer does not need to import from the
 * preview component (which is a React-coupled module).
 */
export const STAMP_CELL_GAP = 4;
