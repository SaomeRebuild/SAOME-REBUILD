import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import { AuthProvider } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import type { AuthSessionWithTenant } from '@saome/shared/types/auth';
import { ROLE_HOME_PATH } from '@saome/shared/constants/role';

// ── Mock authService ─────────────────────────────────────────────────────────

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
  expiresIn: 28800,
  refreshToken: 'fake-refresh-token',
};

// ── Render helper ──────────────────────────────────────────────────────────────

function renderHeader(initialRoute = '/', authState?: { authenticated: boolean }) {
  if (authState?.authenticated) {
    // Bug-7 follow-up: refresh now returns full session.
    vi.mocked(authService.refresh).mockResolvedValue({
      user: adminSession.user,
      tenant: null,
      accessToken: adminSession.accessToken,
      expiresIn: adminSession.expiresIn ?? 28800,
    });
  } else {
    vi.mocked(authService.refresh).mockRejectedValue(new Error('no session'));
  }

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <Header />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic rendering', () => {
    it('renders SAOME logo text', () => {
      renderHeader();
      expect(screen.getByText('SAOME')).toBeInTheDocument();
    });

    it('renders logo as a link to home', () => {
      renderHeader();
      const logo = screen.getByRole('link', { name: /SAOME/ });
      expect(logo).toHaveAttribute('href', '/');
    });
  });

  describe('navigation links', () => {
    it('renders desktop nav with About, Features, Pricing', () => {
      renderHeader();
      const navs = screen.getAllByRole('navigation');
      const desktopNav = navs.find((n) => n.className.includes('lg:flex'));
      expect(desktopNav).toBeDefined();
      expect(desktopNav).toHaveTextContent('關於我們');
      expect(desktopNav).toHaveTextContent('功能');
      expect(desktopNav).toHaveTextContent('定價');
    });

    it('renders login link when unauthenticated', () => {
      renderHeader();
      const loginLinks = screen.getAllByRole('link', { name: '登入' });
      expect(loginLinks.length).toBeGreaterThanOrEqual(1);
      loginLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/login');
      });
    });

    it('renders get started CTA linking to register when unauthenticated', () => {
      renderHeader();
      const ctaLinks = screen.getAllByRole('link', { name: '開始使用' });
      expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
      ctaLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/register');
      });
    });
  });

  describe('auth-aware desktop UI', () => {
    it('shows logout button and user email when authenticated', async () => {
      renderHeader('/', { authenticated: true });

      await waitFor(() => {
        expect(screen.queryByTestId('auth-user-email')).toBeInTheDocument();
      });
      expect(screen.getByTestId('auth-user-email')).toHaveTextContent('admin@saome.org');
      expect(screen.getByTestId('desktop-logout-btn')).toBeInTheDocument();
    });

    // UX fix 2026-08-08: clicking the user email should take the user to their
    // role-based dashboard. This replaces the previous "reverse-direction
    // AuthGuard on HomePage" behaviour, which forced logged-in users away
    // from any page they clicked on.
    it('exposes the user email as a link to the role dashboard', async () => {
      renderHeader('/', { authenticated: true });
      await waitFor(() => {
        expect(screen.getByTestId('auth-user-email')).toBeInTheDocument();
      });
      const emailLink = screen.getByTestId('auth-user-email').closest('a');
      expect(emailLink).not.toBeNull();
      expect(emailLink).toHaveAttribute('href', ROLE_HOME_PATH.admin);
    });

    it('shows login link when unauthenticated', async () => {
      renderHeader('/', { authenticated: false });

      await waitFor(() => {
        expect(screen.queryByTestId('auth-user-email')).toBeNull();
      });
      expect(screen.getAllByRole('link', { name: '登入' }).length).toBeGreaterThanOrEqual(1);
    });

    it('calls logout when logout button is clicked', async () => {
      renderHeader('/', { authenticated: true });
      await waitFor(() => {
        expect(screen.getByTestId('desktop-logout-btn')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('desktop-logout-btn'));
      // authService.logout is a no-op server-side; AuthProvider clears local state
      expect(authService.logout).toHaveBeenCalled();
    });
  });

  describe('auth-aware mobile menu', () => {
    it('shows logout button and user email in mobile menu when authenticated', async () => {
      renderHeader('/', { authenticated: true });

      // Open mobile menu
      const hamburger = screen.getByRole('button', { name: 'Open menu' });
      await userEvent.setup().click(hamburger);

      await waitFor(() => {
        expect(screen.getByTestId('mobile-auth-user-email')).toBeInTheDocument();
      });
      expect(screen.getByTestId('mobile-auth-user-email')).toHaveTextContent('admin@saome.org');
      expect(screen.getByTestId('mobile-logout-btn')).toBeInTheDocument();
    });

    it('calls logout when mobile logout button is clicked', async () => {
      renderHeader('/', { authenticated: true });

      // Open mobile menu
      const hamburger = screen.getByRole('button', { name: 'Open menu' });
      await userEvent.setup().click(hamburger);

      await waitFor(() => {
        expect(screen.getByTestId('mobile-logout-btn')).toBeInTheDocument();
      });
      await userEvent.setup().click(screen.getByTestId('mobile-logout-btn'));
      expect(authService.logout).toHaveBeenCalled();
    });
  });

  describe('mobile menu', () => {
    it('renders hamburger menu button with aria-label', async () => {
      renderHeader();
      expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    });

    it('does not show mobile menu drawer initially', () => {
      renderHeader();
      expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
    });

    it('opens mobile menu when hamburger is clicked', async () => {
      const user = userEvent.setup();
      renderHeader();
      await user.click(screen.getByRole('button', { name: 'Open menu' }));
      expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
    });

    it('closes mobile menu when close button is clicked', async () => {
      const user = userEvent.setup();
      renderHeader();
      await user.click(screen.getByRole('button', { name: 'Open menu' }));
      await user.click(screen.getByRole('button', { name: 'Close menu' }));
      expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
    });

    it('locks body scroll when mobile menu is open', async () => {
      const user = userEvent.setup();
      renderHeader();
      expect(document.body.style.overflow).toBe('');
      await user.click(screen.getByRole('button', { name: 'Open menu' }));
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when mobile menu is closed', async () => {
      const user = userEvent.setup();
      renderHeader();
      await user.click(screen.getByRole('button', { name: 'Open menu' }));
      expect(document.body.style.overflow).toBe('hidden');
      await user.click(screen.getByRole('button', { name: 'Close menu' }));
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('scroll behavior', () => {
    it('starts without shadow (transparent background)', () => {
      renderHeader();
      const header = screen.getByRole('banner');
      expect(header.className).toContain('bg-transparent');
      expect(header.className).not.toContain('shadow-sm');
    });

    it('adds shadow when scrolled past 10px', () => {
      renderHeader();
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 20 });
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      const header = screen.getByRole('banner');
      expect(header.className).toContain('shadow-sm');
      // design-system/MASTER.md: scrolled header uses var(--color-background) at 95% opacity
      expect(header.getAttribute('style') ?? '').toMatch(/--color-background/);
    });

    it('removes shadow when scrolled back to top', () => {
      renderHeader();
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 20 });
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      const header = screen.getByRole('banner');
      expect(header.className).toContain('bg-transparent');
    });
  });
});
