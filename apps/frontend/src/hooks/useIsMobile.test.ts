/**
 * useIsMobile — viewport matchMedia hook tests
 *
 * Covers three contracts:
 *   1. Default SSR-safe state (returns false until first effect).
 *   2. Live matchMedia match on mount → reflects viewport immediately.
 *   3. matchMedia 'change' events update the returned value (re-renders
 *      on viewport resize / device rotation).
 *
 * The hook is web-only (depends on `window.matchMedia`). It does NOT
 * need a `.native.ts` counterpart because CardBuilderEditor is web-only;
 * RN migration will replace this with `useWindowDimensions` from
 * `react-native`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';

/**
 * Install a controllable matchMedia stub. `currentMatches` lets each test
 * flip the viewport state mid-run (simulating window resize / rotation).
 * Returns a `setMatches` mutator + a cleanup function.
 */
function installMatchMedia(initialMatches: boolean) {
  let currentMatches = initialMatches;
  const listeners = new Set<(e: { matches: boolean }) => void>();

  const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
    matches: currentMatches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_event: string, cb: (e: { matches: boolean }) => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_event: string, cb: (e: { matches: boolean }) => void) => {
      listeners.delete(cb);
    }),
    dispatchEvent: vi.fn(),
  }));

  const original = window.matchMedia;
  window.matchMedia = matchMediaMock;

  const setMatches = (next: boolean) => {
    currentMatches = next;
    listeners.forEach((cb) => cb({ matches: next }));
  };

  return {
    setMatches,
    cleanup: () => {
      window.matchMedia = original;
      listeners.clear();
    },
  };
}

describe('useIsMobile — viewport matchMedia hook', () => {
  let cleanupMatchMedia: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupMatchMedia?.();
  });

  it('returns true on mount when matchMedia reports the mobile query matches', () => {
    // default 640 breakpoint → query `(max-width: 639px)`.
    ({ cleanup: cleanupMatchMedia } = installMatchMedia(true));

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false on mount when matchMedia reports the mobile query does NOT match', () => {
    ({ cleanup: cleanupMatchMedia } = installMatchMedia(false));

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('re-renders with the new value when matchMedia fires a change event (resize / rotation)', () => {
    const { setMatches, cleanup } = installMatchMedia(false);
    cleanupMatchMedia = cleanup;

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // Simulate the user rotating from landscape → portrait (or resizing
    // the window below the breakpoint). matchMedia fires a `change` event.
    act(() => {
      setMatches(true);
    });
    expect(result.current).toBe(true);

    // And back to desktop.
    act(() => {
      setMatches(false);
    });
    expect(result.current).toBe(false);
  });

  it('uses a custom breakpoint when provided (1024px for lg:)', () => {
    // Custom breakpoint → query `(max-width: 1023px)`.
    const captured: string[] = [];
    let currentMatches = false;
    const listeners = new Set<(e: { matches: boolean }) => void>();

    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      captured.push(query);
      return {
        matches: currentMatches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_e: string, cb: (e: { matches: boolean }) => void) => {
          listeners.add(cb);
        }),
        removeEventListener: vi.fn((_e: string, cb: (e: { matches: boolean }) => void) => {
          listeners.delete(cb);
        }),
        dispatchEvent: vi.fn(),
      };
    });
    cleanupMatchMedia = () => {
      window.matchMedia = original;
      listeners.clear();
    };

    renderHook(() => useIsMobile(1024));
    expect(captured).toContain('(max-width: 1023px)');
    // Confirm the `change` listener was registered.
    expect(listeners.size).toBe(1);
  });

  it('removes the change listener on unmount (no leak)', () => {
    const listeners = new Set<(e: { matches: boolean }) => void>();
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_e: string, cb: (e: { matches: boolean }) => void) => {
        listeners.add(cb);
      }),
      removeEventListener: vi.fn((_e: string, cb: (e: { matches: boolean }) => void) => {
        listeners.delete(cb);
      }),
      dispatchEvent: vi.fn(),
    }));
    cleanupMatchMedia = () => {
      window.matchMedia = original;
      listeners.clear();
    };

    const { unmount } = renderHook(() => useIsMobile());
    expect(listeners.size).toBe(1);

    unmount();
    expect(listeners.size).toBe(0);
  });
});