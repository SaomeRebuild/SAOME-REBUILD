import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { DashboardShell } from './DashboardShell';
import * as useAuthModule from '@/hooks/useAuth';
import * as useThemeModule from '@/hooks/useTheme';
import type { AuthState } from '@/hooks/useAuth';

vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
  state: { user: { id: 'user-2', email: 'admin@saome.org', role: 'admin' }, loading: false } as unknown as AuthState,
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

describe('DashboardShell', () => {
  it('renders DashboardHeader, main content, and DashboardFooter', () => {
    renderWithRouter(
      <DashboardShell>
        <p data-testid="main-content">Hello</p>
      </DashboardShell>,
    );
    expect(screen.getByTestId('dashboard-logout-btn')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-footer-copyright')).toBeInTheDocument();
  });

  it('passes navItems to DashboardHeader', () => {
    renderWithRouter(
      <DashboardShell navItems={[{ key: 'Overview', href: '/admin/dashboard' }]}>
        <p>content</p>
      </DashboardShell>,
    );
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.textContent?.includes('Overview'))).toBe(true);
  });
});
