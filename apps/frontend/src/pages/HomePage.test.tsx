import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './HomePage';
import { AuthProvider } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import { ROLE_HOME_PATH } from '@saome/shared/constants/role';
import type { AuthSessionWithTenant } from '@saome/shared/types/auth';

vi.mock('@/services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

const adminSession: AuthSessionWithTenant = {
  user: { id: 'admin-id', email: 'admin@saome.org', role: 'admin' },
  tenant: null,
  accessToken: 'fake-access-token',
  expiresIn: 28800,
  refreshToken: 'fake-refresh-token',
};

const tenantSession: AuthSessionWithTenant = {
  user: { id: 'tenant-id', email: 'shop@example.com', role: 'tenant' },
  tenant: null,
  accessToken: 'fake-access-token-2',
  expiresIn: 28800,
  refreshToken: 'fake-refresh-token-2',
};

beforeEach(() => {
  vi.clearAllMocks();
});

function renderWithRouter(
  initialPath: string,
  session: AuthSessionWithTenant | null,
) {
  if (session) {
    // Bug-7 follow-up: refresh now returns the full session.
    vi.mocked(authService.refresh).mockResolvedValue({
      user: session.user,
      tenant: session.tenant ?? null,
      accessToken: session.accessToken,
      expiresIn: session.expiresIn ?? 28800,
    });
  } else {
    vi.mocked(authService.refresh).mockRejectedValue(new Error('no session'));
  }

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path={ROLE_HOME_PATH.admin} element={<div data-testid="admin-landing">ADMIN LANDING</div>} />
          <Route path={ROLE_HOME_PATH.tenant} element={<div data-testid="tenant-landing">TENANT LANDING</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  it('renders marketing landing at / instead of redirecting to /login', async () => {
    renderWithRouter('/', null);
    // HomePage must NOT contain a login form
    expect(screen.queryByRole('button', { name: /登入|login|sign in/i })).toBeNull();
    // Should render Hero headline (zh-TW default)
    expect(screen.getByText(/更多回頭的客戶/i)).toBeInTheDocument();
  });

  it('exposes marketing sections (Features, Pricing)', () => {
    renderWithRouter('/', null);
    // Use getAllByText because "功能" appears in multiple sections (nav + pricing comparison)
    expect(screen.getAllByText(/功能/i).length).toBeGreaterThan(0);
  });

  // ── Reverse-direction AuthGuard (AGENTS.md §Auth flow 鐵律 #3) ────────────
  // Reverse-direction AuthGuard (AGENTS.md §Auth flow 鐵律 #3) was REMOVED
  // in this iteration: requests that logged-in users stay on the marketing
  // landing too. The dashboard is reachable via the user-email link in the
  // Header instead. See runs/improvements/feedback/20260808-* (pending).
  it('keeps an authenticated admin on / (no redirect to dashboard)', async () => {
    renderWithRouter('/', adminSession);
    // Wait until the auth state settles (AuthProvider has applied the session).
    await waitFor(() => {
      expect(screen.queryByText(/更多回頭的客戶/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('admin-landing')).toBeNull();
    expect(screen.queryByTestId('tenant-landing')).toBeNull();
  });

  it('keeps an authenticated tenant on / (no redirect to dashboard)', async () => {
    renderWithRouter('/', tenantSession);
    await waitFor(() => {
      expect(screen.queryByText(/更多回頭的客戶/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('admin-landing')).toBeNull();
    expect(screen.queryByTestId('tenant-landing')).toBeNull();
  });

  it('does NOT redirect while auth state is still loading', () => {
    // When the AuthProvider has not yet finished its initial refresh() call,
    // HomePage must render its content (avoid redirecting anonymous visitors
    // to dashboard while we're still deciding whether they're authed).
    renderWithRouter('/', null);
    // Marketing sections should still be visible
    expect(screen.getByText(/更多回頭的客戶/i)).toBeInTheDocument();
  });
});
