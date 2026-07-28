/**
 * LoginForm post-success navigation test.
 *
 * Bug-5: LoginForm completed the POST /api/auth/login (200 OK, refresh
 * cookie set) but never navigated. The user landed back on /login with
 * a generic "logged in but URL didn't change" impression.
 *
 * Root cause: LoginForm.onSubmit called login() which set state in
 * AuthProvider but didn't issue a navigate(). RegisterForm worked
 * because it called navigate() manually.
 *
 * Fix: LoginForm now calls useAuthRedirect() so any successful login
 *        drives the role-based landing path (/admin/dashboard for
 *        admin@saome.org, /app/dashboard for tenants) via React Router's
 *        useEffect.
 *
 * These tests guard the contract: any future regression that forgets
 * to call useAuthRedirect — or that breaks the role mapping — fails
 * the test rather than silently shipping an unredirected login flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { LoginForm } from './LoginForm';
import { authService } from '@/services/authService';
import type { AuthSessionWithTenant } from '@saome/shared/types/auth';
import { ROLE_HOME_PATH } from '@saome/shared/constants/role';

vi.mock('@/services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn().mockRejectedValue(new Error('not logged in')),
    me: vi.fn(),
    logout: vi.fn(),
  },
}));

function mockAdminSession(): AuthSessionWithTenant {
  return {
    user: { id: 'admin-id', email: 'admin@saome.org', role: 'admin' },
    tenant: null,
    accessToken: 'fake-access-token',
    expiresIn: 900,
    refreshToken: 'fake-refresh-token',
  };
}

function mockTenantSession(): AuthSessionWithTenant {
  return {
    user: { id: 'tenant-id', email: 'shop@example.com', role: 'tenant' },
    tenant: {
      id: 'tenant-uuid',
      ownerUserId: 'tenant-id',
      name: 'Demo Shop',
      contactName: 'Demo',
      phoneCity: '02-12345678',
      address: 'Taipei',
      taxId: '12345678',
      invoiceAddress: '',
      mobile: '',
      website: '',
      email: 'shop@example.com',
    },
    accessToken: 'fake-access-token',
    expiresIn: 900,
    refreshToken: 'fake-refresh-token',
  };
}

function renderLogin(initialRoute = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path={ROLE_HOME_PATH.admin} element={<div data-testid="admin-landing">ADMIN LANDING</div>} />
          <Route path={ROLE_HOME_PATH.tenant} element={<div data-testid="tenant-landing">TENANT LANDING</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginForm post-success navigation (Bug-5 fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects admin login to /admin/dashboard after POST 200', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockAdminSession());

    const user = userEvent.setup();
    const { container } = renderLogin('/login');

    const emailInput = container.querySelector('input[type=email]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type=password]') as HTMLInputElement;
    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    await user.type(emailInput, 'admin@saome.org');
    await user.type(passwordInput, 'Q12345678!tenant');
    // eslint-disable-next-line no-console
    console.log('DEBUG after type:', emailInput.value, '|', passwordInput.value);
    await user.click(screen.getByRole('button', { name: /login.submit|登入|sign in|submit/i }));

    await waitFor(() => {
      expect(screen.getByTestId('admin-landing')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('redirects tenant login to /app/dashboard after POST 200', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockTenantSession());

    const user = userEvent.setup();
    const { container } = renderLogin('/login');

    const emailInput = container.querySelector('input[type=email]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type=password]') as HTMLInputElement;
    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    await user.type(emailInput, 'shop@example.com');
    await user.type(passwordInput, 'tenantpassword');
    // eslint-disable-next-line no-console
    console.log('DEBUG after type:', emailInput.value, '|', passwordInput.value);
    await user.click(screen.getByRole('button', { name: /login.submit|登入|sign in|submit/i }));

    await waitFor(() => {
      expect(screen.getByTestId('tenant-landing')).toBeInTheDocument();
    }, { timeout: 4000 });
  });
});