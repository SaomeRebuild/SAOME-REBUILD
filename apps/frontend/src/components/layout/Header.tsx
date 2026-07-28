import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { t } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { href: '/product', label: t('nav.product') },
    { href: '/demo', label: t('nav.demo') },
    { href: '/#pricing', label: t('nav.pricing') },
    { href: '/#about', label: t('nav.about') },
    { href: '/#features', label: t('nav.features') },
  ];

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-150',
          isScrolled ? 'border-b backdrop-blur-sm shadow-sm' : 'bg-transparent',
          className
        )}
        style={{
          backgroundColor: isScrolled
            ? 'color-mix(in srgb, var(--color-background) 95%, transparent)'
            : 'transparent',
          borderColor: isScrolled ? 'var(--color-border)' : 'transparent',
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between lg:h-[72px]">
            <Link
              to="/"
              className="flex items-center gap-2 font-bold text-xl"
              style={{ color: 'var(--color-primary)' }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
                <path
                  d="M8 10h4v12H8V10Zm6 0h4v12h-4V10Zm6 0h4v12h-4V10Z"
                  fill="white"
                  fillOpacity="0.9"
                />
              </svg>
              SAOME
            </Link>

            <nav className="hidden items-center gap-8 lg:flex">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              <Link
                to="/login"
                className="text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-md transition-all hover:opacity-90 hover:-translate-y-px active:translate-y-0 interactive-scale"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {t('nav.getStarted')}
              </Link>
            </div>

            <button
              type="button"
              className="rounded-md p-2 transition-colors hover:bg-muted lg:hidden"
              style={{ color: 'var(--color-muted-foreground)' }}
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="absolute right-0 top-0 flex h-full w-72 flex-col shadow-xl"
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            <div className="flex h-16 items-center justify-end px-4">
              <button
                type="button"
                className="rounded-md p-2 transition-colors hover:bg-muted"
                style={{ color: 'var(--color-muted-foreground)' }}
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex flex-col gap-1 px-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-3 text-base font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--color-muted-foreground)' }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div
              className="mt-auto flex flex-col gap-2 border-t p-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <Link
                to="/login"
                className="w-full rounded-md border px-4 py-3 text-center text-sm font-medium transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-muted-foreground)',
                }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/register"
                className="w-full rounded-md px-4 py-3 text-center text-sm font-medium transition-all hover:opacity-90"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t('nav.getStarted')}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
