/**
 * useIsMobile — reactive viewport-width check.
 *
 * Listens to `(max-width: breakpoint - 1)` matchMedia so the component
 * re-renders when the user rotates their device or resizes the window.
 *
 * Why one less than the breakpoint: Tailwind's `sm:` covers ≥ 640px
 * (Rule 014). `max-width: 639px` therefore means "strictly below sm",
 * which matches the mobile / desktop split used throughout the app.
 *
 * SSR / non-DOM guard: returns `false` until first effect runs, so the
 * first paint matches the SSR snapshot (no layout shift).
 *
 * Web-only hook (depends on `window.matchMedia`). Lives in `src/hooks/`
 * as a `.ts` file (no `.native.ts` counterpart) because CardBuilderEditor
 * is web-only — RN migration does not need this hook (RN has its own
 * `useWindowDimensions` API). See Rule 024 § Hook Split Pattern for the
 * `.web.ts` / `.native.ts` split convention (only used when the hook has
 * shared state used by both platforms).
 */
import { useEffect, useState } from 'react';

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