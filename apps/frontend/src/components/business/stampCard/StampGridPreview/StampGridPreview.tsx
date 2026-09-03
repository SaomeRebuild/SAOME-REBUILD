/**
 * StampGridPreview — renders a stamp card grid (rows × cols) of icon cells,
 * where the leading `stampedCount` cells show the "stamped" icon variant and
 * the remaining cells show the "unstamped" (outline) variant.
 *
 * Why this is a separate component (and not inlined in PassCardPreviewStrip):
 * - It's reused by both the strip render AND the icon picker's preview, so
 *   keeping it in one place prevents the two views from drifting apart.
 * - Cell-size calculation lives in `StampGridPreview.utils.ts` so it's unit
 *   testable without rendering React.
 *
 * Why the component is dumb about manifest resolution (it just calls
 * `getStampIcon` directly): the manifest is a synchronous, eager module, so
 * there is no value in wrapping it in a hook. Tests mock the manifest module
 * to control which icons are available.
 */
import { getStampIcon } from '@/assets/icons/stamps/manifest';
import {
  calculateCellSize,
  CELL_GAP,
} from './StampGridPreview.utils';
import type { StampGridPreviewProps } from './StampGridPreview.types';

export function StampGridPreview({
  iconId,
  rows,
  cols = 5,
  stampedCount = 3,
  stripHeight,
  stripWidth,
  iconOverride,
}: StampGridPreviewProps) {
  const cellSize = calculateCellSize(rows, stripHeight, stripWidth);
  const totalCells = rows * cols;

  // Resolve icon URLs. `iconOverride` wins (test escape hatch); otherwise we
  // look the icon up in the manifest. An unknown id renders a neutral
  // placeholder rather than crashing — defensive for draft autosave.
  const manifestIcon = iconId ? getStampIcon(iconId) : undefined;
  const stampedUrl = iconOverride?.stampedUrl ?? manifestIcon?.stampedUrl ?? '';
  const unstampedUrl = iconOverride?.unstampedUrl ?? manifestIcon?.unstampedUrl ?? '';

  return (
    <div
      className="grid place-items-center"
      data-testid="stamp-grid-preview"
      data-rows={rows}
      data-cols={cols}
      data-cell-size={cellSize}
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
        gap: `${CELL_GAP}px`,
      }}
    >
      {Array.from({ length: totalCells }).map((_, idx) => {
        const isStamped = idx < stampedCount;
        const url = isStamped ? stampedUrl : unstampedUrl;
        return (
          <div
            key={idx}
            className="flex items-center justify-center"
            data-testid={isStamped ? 'stamp-cell-stamped' : 'stamp-cell-unstamped'}
            style={{ width: cellSize, height: cellSize }}
          >
            {url ? (
              <img
                src={url}
                alt=""
                aria-hidden="true"
                className="block"
                style={{ width: cellSize, height: cellSize }}
              />
            ) : (
              <span
                aria-hidden="true"
                className="block bg-neutral-300 dark:bg-neutral-600"
                style={{ width: cellSize, height: cellSize }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
