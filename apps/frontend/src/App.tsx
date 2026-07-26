import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/home/Hero';
import { SocialProof } from '@/components/home/SocialProof';
import { Features } from '@/components/home/Features';
import { CardTypes } from '@/components/home/CardTypes';
import { HowItWorks } from '@/components/home/HowItWorks';
import { PricingSection } from '@/components/pricing/PricingSection';
import { CTASection } from '@/components/home/CTASection';
import { TermsPage } from '@/pages/legal/TermsPage';
import { PrivacyPage } from '@/pages/legal/PrivacyPage';
import { GDPRPage } from '@/pages/legal/GDPRPage';
import { ProductPage } from '@/pages/product/ProductPage';
import { DemoPage } from '@/pages/demo/DemoPage';
import { DetailedPricingPage } from '@/pages/pricing/DetailedPricingPage';

function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <Features />
      <CardTypes />
      <HowItWorks />
      <PricingSection />
      <CTASection />
    </>
  );
}

function LoginPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="w-full max-w-sm rounded-xl border p-8 text-center"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-card)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
        >
          {t('login.title')}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('login.comingSoon')}
        </p>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/gdpr" element={<GDPRPage />} />
          <Route path="/product" element={<ProductPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/pricing/compare" element={<DetailedPricingPage />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
