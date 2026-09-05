import { Routes, Route, useLocation } from 'react-router-dom';
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
import { ComingSoonView } from '@/pages/app/dashboard';
import ChartsPage from '@/pages/app/dashboard/charts';
import CardBuilderPage from '@/pages/app/dashboard/card-builder';
import MembersPage from '@/pages/app/dashboard/members';
import EmailPage from '@/pages/app/dashboard/email';
import BillingPage from '@/pages/app/dashboard/billing';
import SettingsPage from '@/pages/app/dashboard/settings';

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
      }>
        {/* Nested routes — render inside AppDashboardPage's <Outlet /> */}
        <Route index element={<ComingSoonView title="Welcome" description="Select a tool from the sidebar to get started." />} />
        <Route path="charts" element={<ChartsPage />} />
        <Route path="card-builder" element={<CardBuilderPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="email" element={<EmailPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
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
  // BrowserRouter lives in main.tsx so AuthProvider (which calls
  // useNavigate from useAuth.tsx for logout) renders inside the
  // Router context. Putting it here previously caused the entire
  // tree to unmount on logout — see runs/feedback/20260905-*.
  return (
    <>
      <ScrollToTop />
      <AppRoutes />
    </>
  );
}

export default App;