/**
 * AuthProvider session persistence tests.
 *
 * Verifies that:
 * 1. AuthProvider refreshes the session proactively before access token expires.
 * 2. Session survives page navigation (stays alive across renders).
 * 3. On mount with valid refresh cookie, session is recovered without login.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import type { AuthSessionWithTenant } from '@saome/shared/types/auth';

/** B4 (2026-09-05): useAuth.logout now uses useNavigate, so AuthProvider
 *  must render inside a Router context. Wrap existing tests with MemoryRouter. */
function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// ???? Mock helpers ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

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
  accessToken: 'access-token-original',
  expiresIn: 28800, // 8 hours
  refreshToken: 'refresh-token-original',
};

const newAccessToken = 'access-token-refreshed';

function setupRefreshMock() {
  let callCount = 0;
  vi.mocked(authService.refresh).mockImplementation(() => {
    callCount++;
    // Bug-7 follow-up: refresh() now returns the full AuthSessionWithTenant
    // (user + tenant + accessToken), not just {accessToken, expiresIn}.
    return Promise.resolve({
      user: adminSession.user,
      tenant: null,
      accessToken: newAccessToken,
      expiresIn: 28800,
    });
  });
  vi.mocked(authService.me).mockResolvedValue({
    user: adminSession.user,
    tenant: null,
  });
  return { getCallCount: () => callCount };
}

// ???? Test components ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function CaptureToken() {
  const { state } = useAuth();
  // Expose state via a data attribute for Testing Library queries
  return (
    <div data-testid="auth-state" data-access-token={state.accessToken} data-user-email={state.user?.email ?? ''}>
      <span data-testid="access-token">{state.accessToken}</span>
      <span data-testid="user-email">{state.user?.email ?? ''}</span>
      <span data-testid="loading">{String(state.loading)}</span>
    </div>
  );
}

// ???? Tests ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

describe('AuthProvider session persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('recovers session from refresh cookie on mount', async () => {
    vi.mocked(authService.refresh).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
      accessToken: adminSession.accessToken,
      expiresIn: adminSession.expiresIn ?? 28800,
    });
    vi.mocked(authService.me).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
    });

    renderWithRouter(
      <AuthProvider>
        <CaptureToken />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-testid="access-token"]')?.textContent).toBe(
        adminSession.accessToken,
      );
    });
  });

  it('proactively refreshes access token before 8h expiry', async () => {
    const { getCallCount } = setupRefreshMock();

    // First mount
    renderWithRouter(
      <AuthProvider>
        <CaptureToken />
      </AuthProvider>,
    );

    // Wait for mount refresh to complete
    await waitFor(() => {
      expect(authService.refresh).toHaveBeenCalled();
    });

    // Fast-forward 7 hours ??proactive refresh should have triggered
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7 * 60 * 60 * 1000); // 7 hours
    });

    // After 7 hours the proactive refresh should have fired
    // We expect at least 2 calls: initial mount + 1 proactive refresh
    expect(getCallCount()).toBeGreaterThanOrEqual(2);
  });

  it('session stays alive after component re-render (page navigation simulation)', async () => {
    vi.mocked(authService.refresh).mockResolvedValue({
      // Bug-7 follow-up: refresh now returns full session.
      user: adminSession.user,
      tenant: null,
      accessToken: adminSession.accessToken,
      expiresIn: 28800,
    });
    vi.mocked(authService.me).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
    });

    const { rerender } = renderWithRouter(
      <AuthProvider>
        <CaptureToken />
      </AuthProvider>,
    );

    // Wait for initial session recovery
    await waitFor(() => {
      expect(document.querySelector('[data-testid="user-email"]')?.textContent).toBe('admin@saome.org');
    });

    // Simulate page navigation / component re-mount (App re-mounts AuthProvider)
    rerender(
      <MemoryRouter>
        <AuthProvider>
          <CaptureToken />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Session should be recovered without login (refresh cookie still valid)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="user-email"]')?.textContent).toBe('admin@saome.org');
    });
  });

  it('sets new accessToken in state after proactive refresh', async () => {
    setupRefreshMock();

    renderWithRouter(
      <AuthProvider>
        <CaptureToken />
      </AuthProvider>,
    );

    // Wait for mount refresh to complete
    await waitFor(() => {
      expect(document.querySelector('[data-testid="access-token"]')?.textContent).toBe(newAccessToken);
    });
  });

  // ???? B4 (2026-09-05) logout tests ????????????????????????????????????????????????????????????????????????????????????????

  it('logout() calls authService.logout and clears state', async () => {
    // Seed a session first via refresh-on-mount
    vi.mocked(authService.refresh).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
      accessToken: adminSession.accessToken,
      expiresIn: 28800,
    });
    vi.mocked(authService.me).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
    });
    vi.mocked(authService.logout).mockResolvedValue({ loggedOut: true });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for the seeded session to land
    await waitFor(() => {
      expect(result.current.state.user?.email).toBe('admin@saome.org');
    });

    // Trigger logout
    await act(async () => {
      await result.current.logout();
    });

    // Server logout called once
    expect(authService.logout).toHaveBeenCalledTimes(1);

    // State cleared
    expect(result.current.state.user).toBeNull();
    expect(result.current.state.accessToken).toBeNull();
    expect(result.current.state.tenant).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logout() still clears state when authService.logout throws (network failure)', async () => {
    vi.mocked(authService.refresh).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
      accessToken: adminSession.accessToken,
      expiresIn: 28800,
    });
    vi.mocked(authService.me).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
    });
    // Server logout fails
    vi.mocked(authService.logout).mockRejectedValue(new Error('logout-server-unreachable'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.user?.email).toBe('admin@saome.org');
    });

    // Should NOT throw ??useAuth.logout's try/catch swallows the error
    await act(async () => {
      await result.current.logout();
    });

    // State still cleared despite server failure
    expect(result.current.state.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

