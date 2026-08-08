import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { MarketingShell } from '@/components/layout/MarketingShell';
import { DashboardShell } from '@/components/layout/DashboardShell';
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
import { HomePage } from '@/pages/HomePage';
import { ROUTES } from '@/config/routes';
import { AuthGuard } from '@/components/ui';
import { useAuth } from '@/hooks';
import type { Role } from '@saome/shared/types/auth';

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
      {/* ── Public / marketing pages → MarketingShell ── */}
      <Route path={ROUTES.home} element={
        <MarketingShell><HomePage /></MarketingShell>
      } />
      <Route path={ROUTES.login} element={
        <MarketingShell><LoginPage /></MarketingShell>
      } />
      <Route path={ROUTES.register} element={
        <MarketingShell><RegisterPage /></MarketingShell>
      } />
      <Route path="/terms" element={
        <MarketingShell><TermsPage /></MarketingShell>
      } />
      <Route path="/privacy" element={
        <MarketingShell><PrivacyPage /></MarketingShell>
      } />
      <Route path="/gdpr" element={
        <MarketingShell><GDPRPage /></MarketingShell>
      } />
      <Route path="/product" element={
        <MarketingShell><ProductPage /></MarketingShell>
      } />
      <Route path="/demo" element={
        <MarketingShell><DemoPage /></MarketingShell>
      } />
      <Route path="/pricing/compare" element={
        <MarketingShell><DetailedPricingPage /></MarketingShell>
      } />

      {/* ── Dashboard pages → DashboardShell ── */}
      <Route path={ROUTES.tenantDashboard} element={
        <AuthGuard
          authenticated={isAuthenticated ? true : state.loading ? undefined : false}
          expectedRole="tenant"
          actualRole={state.user?.role as Role | undefined}
        >
          <DashboardShell navItems={[
            { key: 'dashboardHeader.nav.dashboard', href: '/app/dashboard' },
          ]}>
            <AppDashboardPage />
          </DashboardShell>
        </AuthGuard>
      } />
      <Route path={ROUTES.adminDashboard} element={
        <AuthGuard
          authenticated={isAuthenticated ? true : state.loading ? undefined : false}
          expectedRole="admin"
          actualRole={state.user?.role as Role | undefined}
        >
          <DashboardShell navItems={[
            { key: 'dashboardHeader.nav.dashboard', href: '/admin/dashboard' },
          ]}>
            <AdminDashboardPage />
          </DashboardShell>
        </AuthGuard>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;