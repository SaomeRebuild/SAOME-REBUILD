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
