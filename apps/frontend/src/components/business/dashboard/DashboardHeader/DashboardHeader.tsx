/**
 * DashboardHeader — L2 business component.
 *
 * Desktop layout (lg+):
 *   Logo | NavItems (lg:flex) | ...spacer | ThemeToggle + LanguageSwitcher + user email + Logout
 *
 * Mobile layout (< lg):
 *   Logo + [Hamburger]
 *   Mobile drawer: Nav items (vertical) + divider + LanguageSwitcher + ThemeToggle + Logout (vertical)
 *
 * RN migration: No scroll-aware effects. No window.scrollY listener.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks';
import { ThemeToggle } from '@/components/ui/theme';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { DashboardHeaderNav } from './DashboardHeaderNav';
import { DashboardHeaderActions } from './DashboardHeaderActions';
import type { DashboardHeaderProps } from './DashboardHeader.types';

function SaomeLogo({ className }: { className?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
      <path d="M8 10h4v12H8V10Zm6 0h4v12h-4V10Zm6 0h4v12h-4V10Z" fill="white" fillOpacity="0.9" />
    </svg>
  );
}

export function DashboardHeader({ navItems = [], className }: DashboardHeaderProps) {
  const { t } = useTranslation('dashboard');
  const { isAuthenticated, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* ── Header (desktop + mobile shared structure) ── */}
      <header
        className={cn(
          'sticky top-0 z-40 w-full border-b backdrop-blur-sm',
          'bg-[var(--color-header-bg)] border-[var(--color-header-border)]',
          className,
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between lg:h-16">
            {/* Logo — always visible */}
            <Link
              to="/"
              className="flex items-center gap-2 font-bold text-xl"
              style={{ color: 'var(--color-primary)' }}
            >
              <SaomeLogo />
              <span data-testid="saome-logo-text">{t('dashboardHeader.logoAlt')}</span>
            </Link>

            {/* Desktop nav — lg+ only */}
            <DashboardHeaderNav items={navItems} className="hidden lg:flex flex-1 justify-center" />

            {/* Desktop actions — lg+ only */}
            <div className="hidden lg:flex">
              <DashboardHeaderActions />
            </div>

            {/* Mobile hamburger — show below lg */}
            <button
              type="button"
              className="rounded-md p-2 transition-colors hover:bg-[var(--color-muted)] lg:hidden"
              style={{ color: 'var(--color-muted-foreground)' }}
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label={t('dashboardHeader.openMenu')}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <nav
            className="absolute right-0 top-0 flex h-full w-72 flex-col shadow-xl"
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            {/* Close button */}
            <div
              className="flex h-14 items-center justify-end px-4 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <button
                type="button"
                className="rounded-md p-2 transition-colors hover:bg-[var(--color-muted)]"
                style={{ color: 'var(--color-muted-foreground)' }}
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label={t('dashboardHeader.closeMenu')}
              >
                <X size={22} />
              </button>
            </div>

            {/* Mobile nav items — vertical */}
            <div className="flex flex-col gap-1 px-4 py-4">
              {navItems.length > 0 ? (
                navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      to={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noopener noreferrer' : undefined}
                      className="flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {Icon && <Icon size={18} aria-hidden="true" />}
                      {t(item.key)}
                    </Link>
                  );
                })
              ) : (
                <Link
                  to="/"
                  className="flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t('dashboardHeader.logoAlt')}
                </Link>
              )}

              {/* Language switcher */}
              <div className="group">
                <LanguageSwitcher />
              </div>

              {/* Theme toggle — transparent style to match LanguageSwitcher */}
              <div className="group">
                <ThemeToggle transparent />
              </div>

              {/* Logout button */}
              {isAuthenticated && (
                <button
                  type="button"
                  // B4 (2026-09-05): close the drawer FIRST (instant feedback)
                  // then await logout so navigation ordering is deterministic.
                  // Per Auth flow 鐵律 #3 — reverse-direction AuthGuard symmetry.
                  onClick={async () => {
                    setIsMobileMenuOpen(false);
                    await logout();
                  }}
                  className="flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium transition-colors text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
                  data-testid="mobile-logout-btn"
                >
                  <LogOut size={18} aria-hidden="true" />
                  {t('dashboardHeader.logout')}
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
