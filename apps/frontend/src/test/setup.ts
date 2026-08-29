import '@testing-library/jest-dom/vitest';
import './i18n';
import i18n from 'i18next';
import { afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// ── i18n default language ───────────────────────────────────────────────────
// jsdom's navigator.language defaults to 'en', which would cause
// detectDeviceLanguage() to return 'en' during i18n.init() and break tests
// that expect zh-TW default. Force zh-TW for all unit tests.
process.env.TEST_LANG = 'zh-TW';

afterEach(() => {
  cleanup();
});

// ── i18n async init ──────────────────────────────────────────────────────────
// Block test setup until i18n.init() completes. Without this, components that
// call useTranslation() before init resolves will see raw keys (e.g. "dashboard.xxx"
// instead of translated text) in both jsdom and real browser environments.
beforeAll(async () => {
  if (i18n.isInitialized) return;
  await (i18n as unknown as { initPromise: Promise<void> }).initPromise;
});

// ── matchMedia mock (jsdom does not implement this Web API) ───────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── Global authService mock ──────────────────────────────────────────────────
// Since Header now uses useAuth (which throws outside AuthProvider), every
// test that renders Header or any component that contains it needs authService
// mocked. We set a default "unauthenticated" mock here so existing tests keep
// passing. Tests that need an authenticated state can override via
// vi.mocked(authService, { override: true }).mockResolvedValue(...).
vi.mock('@/services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    // Default: unauthenticated (no session cookie → rejects)
    refresh: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

// ── URL.createObjectURL / revokeObjectURL polyfill (jsdom doesn't ship these) ──
// Without this, LogoUploader's unmount cleanup throws "URL.revokeObjectURL is not a
// function" and fails tests that have a `cropping` state at teardown.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn();
}

// ── ResizeObserver polyfill (jsdom doesn't ship it) ──
// LogoUploader measures its wrapper's offsetWidth via ResizeObserver to derive
// the crop stage's responsive width. In jsdom ResizeObserver doesn't exist
// and offsetWidth is always 0, so without this polyfill the wrapper would
// always report 0 width and the crop stage would jump to BASE_CANVAS_WIDTH.
//
// This polyfill captures every observed element so tests can manually trigger
// a resize via `triggerResize(el, width, height)` and let the component
// re-measure.
type ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;
const resizeRegistry = new WeakMap<Element, ResizeObserverCallback>();

class MockResizeObserver {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(el: Element) {
    resizeRegistry.set(el, this.cb);
    // Fire once on observe so the component picks up the initial size.
    queueMicrotask(() => this.cb([{ target: el, contentRect: { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0 } } as ResizeObserverEntry], this as unknown as ResizeObserver));
  }
  unobserve(el: Element) {
    resizeRegistry.delete(el);
  }
  disconnect() {
    // no-op; tests rarely need this
  }
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

// Test helper: trigger a ResizeObserver callback on the given element with the
// desired dimensions. Use this in tests that need the component to re-measure
// (e.g. for responsive cap behavior).
export function triggerResize(el: Element, width: number, height: number) {
  const cb = resizeRegistry.get(el);
  if (!cb) throw new Error('triggerResize: element not observed by ResizeObserver');
  cb(
    [{ target: el, contentRect: { width, height, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0 } } as ResizeObserverEntry],
    {} as ResizeObserver,
  );
}
