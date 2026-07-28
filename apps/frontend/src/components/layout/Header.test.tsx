import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';

const renderHeader = (initialRoute = '/') =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Header />
    </MemoryRouter>,
  );

describe('Header', () => {
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

    it('renders login link', () => {
      renderHeader();
      const loginLinks = screen.getAllByRole('link', { name: '登入' });
      expect(loginLinks.length).toBeGreaterThanOrEqual(1);
      loginLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/login');
      });
    });

    it('renders get started CTA linking to register', () => {
      renderHeader();
      const ctaLinks = screen.getAllByRole('link', { name: '開始使用' });
      expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
      ctaLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/register');
      });
    });
  });

  describe('mobile menu', () => {
    it('renders hamburger menu button with aria-label', () => {
      renderHeader();
      const hamburger = screen.getByRole('button', { name: 'Open menu' });
      expect(hamburger).toBeInTheDocument();
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
