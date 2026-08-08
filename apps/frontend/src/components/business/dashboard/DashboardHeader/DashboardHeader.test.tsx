import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { DashboardHeader } from './DashboardHeader';
import * as useAuthModule from '@/hooks/useAuth';
import * as useThemeModule from '@/hooks/useTheme';
import type { AuthState } from '@/hooks/useAuth';

// Stable mocks
vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
  state: { user: { id: 'user-1', email: 'test@saome.org', role: 'tenant' }, loading: false } as unknown as AuthState,
  isAuthenticated: true,
  logout: vi.fn(),
  checkSession: vi.fn(),
} as unknown as ReturnType<typeof useAuthModule.useAuth>);

vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
  preference: 'dark',
  resolved: 'dark',
  setPreference: vi.fn(),
});

const renderWithRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe('DashboardHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the SAOME logo text', () => {
    renderWithRouter(<DashboardHeader />);
    expect(screen.getByTestId('saome-logo-text')).toBeInTheDocument();
  });

  it('renders the logout button', () => {
    renderWithRouter(<DashboardHeader />);
    expect(screen.getByTestId('dashboard-logout-btn')).toBeInTheDocument();
  });

  it('renders user email when authenticated', () => {
    renderWithRouter(<DashboardHeader />);
    expect(screen.getByTestId('dashboard-user-email')).toHaveTextContent('test@saome.org');
  });

  it('renders nav items when provided', () => {
    renderWithRouter(
      <DashboardHeader
        navItems={[
          { key: 'dashboardHeader.nav.dashboard', href: '/admin/dashboard' },
          { key: 'dashboardHeader.nav.members', href: '/app/members' },
        ]}
      />,
    );
    // Verify nav links exist (text resolved via i18n)
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(2);
  });

  it('does not render nav when navItems is empty', () => {
    renderWithRouter(<DashboardHeader navItems={[]} />);
    // No nav element rendered for empty nav
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
