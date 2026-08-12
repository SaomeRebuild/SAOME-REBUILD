import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../shared/LanguageSwitcher';

export function Footer() {
  const { t } = useTranslation(['landing', 'nav']);

  const footerLinks = [
    { href: '/product', label: t('product', { ns: 'nav' }) },
    { href: '/demo', label: t('demo', { ns: 'nav' }) },
    { href: '/pricing/compare', label: t('pricingCompare', { ns: 'nav' }) },
    { href: '/#about', label: t('about', { ns: 'nav' }) },
    { href: '/#features', label: t('features', { ns: 'nav' }) },
  ];

  const legalLinks = [
    { to: '/privacy', label: t('privacy', { ns: 'nav' }) },
    { to: '/terms', label: t('terms', { ns: 'nav' }) },
    { to: '/gdpr', label: t('gdpr', { ns: 'nav' }) },
  ];

  return (
    <footer
      className="mt-auto border-t"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="flex flex-col gap-4">
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
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              {t('slogan', { ns: 'landing' })}
            </p>
          </div>

          <nav className="flex flex-col gap-3">
            {footerLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm transition-colors hover:opacity-80"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-4">
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--color-foreground)' }}
            >
              {t('contact', { ns: 'landing' })}
            </p>
            <a
              href="mailto:hello@saome.org"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              hello@saome.org
            </a>
            <div className="flex gap-4">
              <a
                href="#"
                className="transition-colors hover:opacity-80"
                style={{ color: 'var(--color-muted-foreground)' }}
                aria-label="Instagram"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href="#"
                className="transition-colors hover:opacity-80"
                style={{ color: 'var(--color-muted-foreground)' }}
                aria-label="Facebook"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a
                href="#"
                className="transition-colors hover:opacity-80"
                style={{ color: 'var(--color-muted-foreground)' }}
                aria-label="X"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{t('securePayments', { ns: 'landing' })}</span>
              <div className="flex items-center gap-1">
                <svg width="38" height="24" viewBox="0 0 38 24" fill="none" aria-label="Visa" role="img">
                  <rect width="38" height="24" rx="4" fill="#1A1F71" />
                  <text x="19" y="16" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold" fontFamily="Arial">VISA</text>
                </svg>
                <svg width="38" height="24" viewBox="0 0 38 24" fill="none" aria-label="Mastercard" role="img">
                  <rect width="38" height="24" rx="4" fill="#252525" />
                  <circle cx="15" cy="12" r="7" fill="#EB001B" />
                  <circle cx="23" cy="12" r="7" fill="#F79E1B" />
                  <path d="M19 6.8a7 7 0 010 10.4A7 7 0 0119 6.8z" fill="#FF5F00" />
                </svg>
              </div>
            </div>
            <LanguageSwitcher />
          </div>
        </div>

        <div
          className="mt-8 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            {t('copyright', { year: new Date().getFullYear(), ns: 'landing' })}
          </p>
          <div className="flex gap-6">
            {legalLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm transition-colors hover:opacity-80"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
