import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
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
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import AppDashboardPage from '@/pages/app/AppDashboardPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import HomeRedirect from '@/pages/HomePage';
import { ROUTES } from '@/config/routes';
import { AuthGuard } from '@/components/ui';
import { useAuth } from '@/hooks';
import type { Role } from '@saome/shared/types/auth';

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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

/** Inner App so we can use useAuth inside the Router. */
function AppRoutes() {
  const { state, isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomeRedirect />} />
      <Route path="/legacy-home" element={<HomePage />} />
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.register} element={<RegisterPage />} />
      <Route path={ROUTES.tenantDashboard} element={
        <AuthGuard
          authenticated={isAuthenticated ? true : state.loading ? undefined : false}
          expectedRole="tenant"
          actualRole={state.user?.role as Role | undefined}
        >
          <AppDashboardPage />
        </AuthGuard>
      } />
      <Route path={ROUTES.adminDashboard} element={
        <AuthGuard
          authenticated={isAuthenticated ? true : state.loading ? undefined : false}
          expectedRole="admin"
          actualRole={state.user?.role as Role | undefined}
        >
          <AdminDashboardPage />
        </AuthGuard>
      } />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/gdpr" element={<GDPRPage />} />
      <Route path="/product" element={<ProductPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/pricing/compare" element={<DetailedPricingPage />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <AppRoutes />
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;