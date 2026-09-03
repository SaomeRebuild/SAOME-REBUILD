/**
 * StampIconPicker — shared hooks
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3StampGrid/StampIconPicker.hooks
 *
 * `useStampPickerPopoverPosition` mirrors the desktop popover positioning
 * logic in ColorSwatchPicker.hooks (anchor below trigger; flip above when
 * there's not enough space below; clamp inside the viewport).
 *
 * Why a separate hook (not the ColorSwatchPicker one):
 * - The two popovers have different sizes (color picker ~460px tall, stamp
 *   picker ~160px tall) so they can't share a constant `POPOVER_HEIGHT_ESTIMATE`.
 * - Keeping them separate avoids a cross-folder coupling on what should be
 *   folder-local utility logic. If a third caller appears, hoist both into
 *   a shared `Step3*Picker.hooks.ts` — but not before.
 */
import { useLayoutEffect, useState, type RefObject } from 'react';
import { useIsMobile } from '../Step3CardColors/ColorSwatchPicker.hooks';

/**
 * Popover width — shared between the dialog body (StampIconPicker.tsx) and
 * the positioning math below. Keep these two in sync: the dialog uses this
 * constant directly so its body width matches the popover math.
 *
 * 320px is the maximum visual width that fits 5 × 44px cells (touch-target
 * minimum) with padding on either side. Mobile uses `min(100vw - 32px, ...)`
 * so the dialog shrinks on narrow viewports but never exceeds this cap.
 */
export const POPOVER_WIDTH = 320;
/**
 * Estimated popover height (close button + gap + auto-fit icon grid + padding).
 * Used to decide whether to flip the popover above the trigger.
 *
 * Sized for ~3 rows of icons at the maximum 5-per-row layout; larger manifests
 * let the grid wrap and the popover stays single-screen-friendly because each
 * row uses the minimum 44px cell.
 */
const POPOVER_HEIGHT_ESTIMATE = 200;
/** Breathing room between popover edge and viewport edge. */
const VIEWPORT_PADDING = 8;

type PopoverPosition =
  | { mobile: true }
  | { mobile: false; top: number; left: number }
  | null;

/**
 * Compute popover position from a trigger element. Returns null when not open.
 *
 * On mobile (< 640px), returns `{ mobile: true }` — the caller renders the
 * popover centered on the viewport (no anchor math). On desktop, anchors
 * below the trigger; flips above when there's not enough room below.
 */
export function useStampPickerPopoverPosition(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
): PopoverPosition {
  const isMobile = useIsMobile();
  const [position, setPosition] = useState<PopoverPosition>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    if (isMobile) {
      setPosition({ mobile: true });
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    // Below if there's room; otherwise above (clamped to viewport).
    const desiredTop =
      spaceBelow >= POPOVER_HEIGHT_ESTIMATE + 16
        ? rect.bottom + VIEWPORT_PADDING
        : Math.max(VIEWPORT_PADDING, rect.top - POPOVER_HEIGHT_ESTIMATE - VIEWPORT_PADDING);
    const maxTop = window.innerHeight - POPOVER_HEIGHT_ESTIMATE - VIEWPORT_PADDING;
    const top = Math.max(VIEWPORT_PADDING, Math.min(desiredTop, maxTop));
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, rect.left),
      window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING,
    );
    setPosition({ mobile: false, top, left });
  }, [open, containerRef, isMobile]);
  return position;
}
