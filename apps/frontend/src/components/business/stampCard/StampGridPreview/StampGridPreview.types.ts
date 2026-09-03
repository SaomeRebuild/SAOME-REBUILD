/**
 * StampGridPreview — public type definitions.
 *
 * This component is used in two places:
 *   1. The pass-card preview strip (PassCardPreviewStrip) — full-size grid
 *      that takes up the strip's content area.
 *   2. The icon picker popover (Step3StampGrid) — small preview column next
 *      to the icon grid, showing what the currently-selected icon + row count
 *      would look like in the preview.
 *
 * Both call sites pass `stripHeight` to derive the cell size via
 * `calculateCellSize`. We do not let the caller pass a custom cellSize: the
 * component is opinionated about scaling to fit the strip, which is the whole
 * reason the formula exists.
 */

import type { StampIconEntry } from '@/assets/icons/stamps/manifest';

/** Allowed number of rows for a stamp card (1×5 to 4×5 grids). */
export type StampGridRows = 1 | 2 | 3 | 4;

export interface StampGridPreviewProps {
  /**
   * Icon id (matches the basename of the PNG under `assets/icons/stamps/`,
   * without the `.png` extension). If the id is unknown, the component
   * renders a dim placeholder row instead of throwing.
   */
  iconId: string;

  /** Number of grid rows (1..4). */
  rows: StampGridRows;

  /** Number of grid columns. Defaults to 5. */
  cols?: number;

  /**
   * How many leading cells render as "stamped" (filled-in icon) vs the
   * remaining cells that render as "unstamped" (outline / dim icon). The
   * preview always shows the same fixed pattern (3 stamped) so the user can
   * see what the grid looks like before the real stamps accumulate.
   * Defaults to 3.
   */
  stampedCount?: number;

  /**
   * Height of the parent strip (px). Required because we compute cellSize
   * from this and `stripWidth`. PassCardPreviewStrip passes 120 (normal) or
   * 100 (compact). The icon picker passes the size of its preview column.
   */
  stripHeight: number;

  /**
   * Width of the parent strip (px). Optional; defaults to
   * `DEFAULT_STRIP_WIDTH` (256 — the mobile preview width). Pass an explicit
   * value if the container is a different size (e.g. the picker preview).
   */
  stripWidth?: number;

  /**
   * Override for stamp icon URLs. Optional escape hatch for tests and for
   * future per-tenant custom icon uploads; in normal usage the component
   * resolves URLs from the manifest via `iconId`.
   */
  iconOverride?: Pick<StampIconEntry, 'stampedUrl' | 'unstampedUrl'>;
}
