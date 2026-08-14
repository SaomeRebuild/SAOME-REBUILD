/**
 * AppDashboardPage — tenant dashboard (post-login).
 */

import { useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { TenantToolbar } from '@/components/business/dashboard/TenantToolbar';
import { DashboardBanner } from '@/components/business/dashboard/DashboardBanner';
import { useAuth } from '@/hooks';

export default function AppDashboardPage() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const hasBanner = Boolean(state.pass);

  function handleCta() {
    navigate('/settings/billing');
  }

  return (
    <div className="flex h-full flex-col p-4 pt-16">
      {/* Banner area — handles trial / expired / renewal reminder */}
      <div
        className="transition-all duration-300 ease-out"
        style={{
          maxHeight: hasBanner ? '200px' : '0px',
          opacity: hasBanner ? 1 : 0,
          overflow: 'hidden',
        }}
      >
        <div className={hasBanner ? 'pt-0' : ''}>
          <DashboardBanner pass={state.pass ?? undefined} onCta={handleCta} />
        </div>
      </div>

      {/* Main layout — toolbar + content, fills remaining height */}
      <div className={`flex min-h-0 flex-1 items-stretch ${hasBanner ? 'pt-4' : ''}`}>
        <TenantToolbar />
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
