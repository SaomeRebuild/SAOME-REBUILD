/**
 * LoginPage back-button guard (Bug-5 continuation).
 *
 * If AuthProvider already recovered a session (refresh cookie set, or
 * in-memory state from a prior login), LoginPage must redirect to the
 * role's landing path instead of showing the form. Without this, a
 * user hitting the back button after logging in sees a "why am I being
 * asked to log in?" page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import LoginPage from './LoginPage';
import { authService } from '@/services/authService';
import type { AuthSessionWithTenant } from '@saome/shared/types/auth';
import { ROLE_HOME_PATH } from '@saome/shared/constants/role';

vi.mock('@/services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
  },
}));

const adminSession: AuthSessionWithTenant = {
  user: { id: 'admin-id', email: 'admin@saome.org', role: 'admin' },
  tenant: null,
  accessToken: 'fake-access-token',
  expiresIn: 900,
  refreshToken: 'fake-refresh-token',
};

function renderLoginWith(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path={ROLE_HOME_PATH.admin} element={<div data-testid="admin-landing">ADMIN LANDING</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage back-button guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects an already-authenticated admin to /admin/dashboard', async () => {
    // Bug-7 follow-up: refresh() now returns the full session.
    vi.mocked(authService.refresh).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
      accessToken: adminSession.accessToken,
      expiresIn: adminSession.expiresIn ?? 900,
    });

    renderLoginWith('/login');

    expect(await screen.findByTestId('admin-landing')).toBeInTheDocument();
    expect(screen.queryByLabelText(/email|login\.email/i)).toBeNull();
  });

  it('renders the LoginForm when no session exists', async () => {
    vi.mocked(authService.refresh).mockRejectedValue(new Error('no refresh cookie'));

    renderLoginWith('/login');

    // After the rejected refresh, AuthProvider sets loading=false and the
    // LoginPage should render the LoginForm rather than redirect.
    await waitFor(() => {
      expect(screen.queryByTestId('admin-landing')).toBeNull();
    });
    // The LoginForm renders - check for the switchToRegister link which is present
    expect(screen.getByText('還沒有帳號？立即註冊')).toBeInTheDocument();
  });
});

/**
 * Phase 2026-09-09 — Cold start 503 dead zone closure (Worker isolate warmup).
 *
 * Critical invariant under test:
 *   - LoginPage mount fires a fire-and-forGET GET /health to pre-warm the
 *     Cloudflare Worker isolate so the user-triggered POST /api/auth/login
 *     that follows doesn't hit a cold-start 503 → CORS drop → TypeError.
 *   - The fetch is delayed by 100ms (avoiding React hydration race).
 *   - AbortController is wired so unmount cancels the in-flight warmup.
 *   - Warmup fires regardless of whether the user is already authenticated
 *     and LoginPage <Navigate>s them away — useEffect runs on mount.
 *
 * Regression for production CORS drop incident at 2026-09-09 06:10 UTC:
 * user clicks Login from a cold Worker isolate → 503 → "Network error"
 * (fixed by httpClient.network-retry + this warmup).
 */
describe('LoginPage Worker isolate warmup', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('fires GET /health on mount after 100ms delay', async () => {
    vi.mocked(authService.refresh).mockRejectedValue(new Error('no session'));

    renderLoginWith('/login');

    // Before 100ms — no warmup yet (delay prevents hydration race)
    await vi.advanceTimersByTimeAsync(50);
    expect(fetchSpy).not.toHaveBeenCalled();

    // At t=100ms — warmup fetch fires
    await vi.advanceTimersByTimeAsync(60);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0];
    expect(String(url)).toMatch(/\/health$/);
  });

  it('aborts warmup fetch on unmount via AbortController', async () => {
    vi.mocked(authService.refresh).mockRejectedValue(new Error('no session'));

    const { unmount } = renderLoginWith('/login');
    // Advance past the 100ms delay so the fetch fires
    await vi.advanceTimersByTimeAsync(110);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Capture the AbortSignal that was passed to fetch
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const signal = init.signal as AbortSignal;
    expect(signal).toBeDefined();
    expect(signal.aborted).toBe(false);

    // Unmount should call abort()
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('warmup still fires when user is already authenticated (useEffect runs before Navigate redirect)', async () => {
    // Even though <Navigate> immediately redirects authenticated users,
    // LoginPage is mounted briefly and useEffect fires — this is the
    // common "back button after login" scenario where the user lands
    // on LoginPage with a valid refresh cookie.
    vi.mocked(authService.refresh).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
      accessToken: adminSession.accessToken,
      expiresIn: adminSession.expiresIn ?? 900,
    });

    renderLoginWith('/login');

    // Advance past the 100ms delay so the warmup fetch fires, wrapped in
    // act() so React state updates from the resolved refresh promise flush.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    // The warmup fetch should still have fired, even though we ended up
    // at admin-landing via Navigate. (We don't assert on the redirect itself
    // — that's covered by the existing back-button-guard test — we just
    // need to confirm the warmup useEffect ran before the unmount.)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0];
    expect(String(url)).toMatch(/\/health$/);
  });
});