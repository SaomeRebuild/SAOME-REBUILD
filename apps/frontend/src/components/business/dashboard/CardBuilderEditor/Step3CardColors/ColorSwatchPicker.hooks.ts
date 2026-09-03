/**
 * ColorSwatchPicker — shared hooks
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3CardColors/ColorSwatchPicker.hooks
 */

import { useEffect, useState, useRef, type RefObject } from 'react';

/**
 * useIsMobile — reactive viewport-width check.
 *
 * Listens to `(max-width: breakpoint - 1)` matchMedia so the component
 * re-renders when the user rotates their device or resizes the window.
 *
 * Why one less than the breakpoint: Tailwind's `sm:` covers ≥ 640px
 * (Rule 014). `max-width: 639px` therefore means "strictly below sm",
 * which matches the mobile / desktop split used throughout the app
 * (see MobilePreviewPanel.tsx which uses `lg:hidden`).
 *
 * SSR / non-DOM guard: returns `false` until first effect runs, so the
 * first paint matches the SSR snapshot (no layout shift).
 */
export function useIsMobile(breakpointPx: number = 640): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const query = `(max-width: ${breakpointPx - 1}px)`;
    const mql = window.matchMedia(query);
    // Set initial value from the live media query so the first effect
    // tick reflects the real viewport (not just the SSR-safe default).
    setIsMobile(mql.matches);

    function handleChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [breakpointPx]);

  return isMobile;
}

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
