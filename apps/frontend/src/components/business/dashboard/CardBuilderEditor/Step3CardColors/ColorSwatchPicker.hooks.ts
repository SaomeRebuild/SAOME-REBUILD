/**
 * ColorSwatchPicker — shared hooks (popover-specific)
 *
 * `useIsMobile` lives in `src/hooks/useIsMobile.ts` and is imported directly
 * from there. The remaining hooks below are popover-specific (outside-click
 * + Escape-key handling), so they stay co-located with the picker.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3CardColors/ColorSwatchPicker.hooks
 */

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Detect clicks outside the returned ref's element AND outside any additional
 * "inside" refs (used for portaled popovers) and invoke `onOutside`.
 *
 * Uses `mousedown` (not `click`) so a button inside the container fires
 * `onClick` BEFORE this hook closes the popover — avoids a race where
 * the user clicks a swatch, the popover closes, and the click handler
 * never runs.
 *
 * When a popover is portaled to `document.body`, its DOM is no longer a
 * descendant of the trigger's container. Pass the popover's ref as
 * `additionalRef` so clicks inside the popover are also treated as "inside".
 */
export function useClickOutside<T extends HTMLElement>(
  onOutside: () => void,
  additionalRef?: RefObject<HTMLElement | null>,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (additionalRef?.current?.contains(target)) return;
      onOutside();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onOutside, additionalRef]);
  return ref;
}

/** Close popover / dismiss when user presses Escape. */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onEscape();
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onEscape]);
}
