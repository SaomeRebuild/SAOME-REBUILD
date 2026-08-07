import '@testing-library/jest-dom/vitest';
import './i18n';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
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
