import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { Hero } from './components/home/Hero';
import { SocialProof } from './components/home/SocialProof';
import { Features } from './components/home/Features';
import { HowItWorks } from './components/home/HowItWorks';
import { PricingSection } from './components/pricing/PricingSection';
import { CTASection } from './components/home/CTASection';
import { TermsPage } from './pages/legal/TermsPage';
import { PrivacyPage } from './pages/legal/PrivacyPage';
import { GDPRPage } from './pages/legal/GDPRPage';
import { AuthProvider } from '@/hooks';

// Suppress "useAuth must be used inside AuthProvider" — setup.ts already mocks
// authService.refresh to reject, so Header renders in "logged-out" state.
vi.mock('@/services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockRejectedValue(new Error('no session')),
  },
}));

function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <PricingSection />
      <CTASection />
    </>
  );
}

function LoginPage() {
  const { t } = useTranslation('auth');
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-primary">{t('login.title')}</h1>
        <p className="mt-2 text-sm text-secondary">{t('login.comingSoon')}</p>
      </div>
    </div>
  );
}

const renderApp = (initialRoute = '/') => {
  // Mock window.scrollTo so jsdom doesn't complain
  window.scrollTo = () => {};

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<LoginPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/gdpr" element={<GDPRPage />} />
          </Routes>
        </main>
        <Footer />
      </AuthProvider>
    </MemoryRouter>,
  );
};

describe('App routing', () => {
  describe('homepage (/)', () => {
    it('renders all 6 sections', () => {
      const { container } = renderApp('/');
      const sections = container.querySelectorAll('main > section, main > div > section');
      expect(sections.length).toBeGreaterThanOrEqual(6);
    });

    it('renders Header and Footer on homepage', () => {
      renderApp('/');
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('renders Hero on homepage', () => {
      renderApp('/');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('更多回頭的客戶=更高的營收');
    });

    it('renders Pricing on homepage', () => {
      renderApp('/');
      expect(screen.getByText('簡單透明，定價合理')).toBeInTheDocument();
    });
  });

  describe('login (/login)', () => {
    it('renders Login placeholder page', () => {
      renderApp('/login');
      expect(screen.getByRole('heading', { level: 1, name: '登入' })).toBeInTheDocument();
      expect(screen.getByText('即將推出。請稍候。')).toBeInTheDocument();
    });

    it('still shows Header and Footer', () => {
      renderApp('/login');
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });
  });

  describe('register (/register)', () => {
    it('renders the same Login placeholder as login', () => {
      renderApp('/register');
      expect(screen.getByRole('heading', { level: 1, name: '登入' })).toBeInTheDocument();
    });
  });

  describe('legal pages', () => {
    it('renders Terms page at /terms', () => {
      const { container } = renderApp('/terms');
      expect(container.querySelector('main')).toBeInTheDocument();
    });

    it('renders Privacy page at /privacy', () => {
      const { container } = renderApp('/privacy');
      expect(container.querySelector('main')).toBeInTheDocument();
    });

    it('renders GDPR page at /gdpr', () => {
      const { container } = renderApp('/gdpr');
      expect(container.querySelector('main')).toBeInTheDocument();
    });
  });

  describe('navigation flow', () => {
    it('Hero CTA links to register', () => {
      renderApp('/');
      const ctas = screen.getAllByRole('link', { name: /開始免費試用/ });
      expect(ctas.length).toBeGreaterThanOrEqual(1);
      ctas.forEach((cta) => {
        expect(cta.getAttribute('href')).toMatch(/^\/(register|demo)/);
      });
    });

    it('clicking logo navigates to home', () => {
      renderApp('/login');
      const logo = screen.getAllByRole('link', { name: /SAOME/ })[0];
      expect(logo).toHaveAttribute('href', '/');
    });
  });
});
