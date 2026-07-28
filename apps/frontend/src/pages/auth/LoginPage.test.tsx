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
import { render, screen, waitFor } from '@testing-library/react';
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
    // refresh() returns a token; me() returns the matching admin payload.
    vi.mocked(authService.refresh).mockResolvedValue({
      accessToken: adminSession.accessToken,
      expiresIn: adminSession.expiresIn ?? 900,
    });
    vi.mocked(authService.me).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
    });

    renderLoginWith('/login');

    expect(await screen.findByTestId('admin-landing')).toBeInTheDocument();
    expect(screen.queryByLabelText(/email|login\.email/i)).toBeNull();
  });

  it('renders the LoginForm when no session exists', async () => {
    vi.mocked(authService.refresh).mockRejectedValue(new Error('no refresh cookie'));
    vi.mocked(authService.me).mockRejectedValue(new Error('no me'));

    renderLoginWith('/login');

    // After the rejected refresh, AuthProvider sets loading=false and the
    // LoginPage should render the LoginForm rather than redirect.
    await waitFor(() => {
      expect(screen.queryByTestId('admin-landing')).toBeNull();
    });
    // The LoginForm's email input is rendered via Field.
    expect(screen.getByText(/login\.title/i)).toBeInTheDocument();
  });
});