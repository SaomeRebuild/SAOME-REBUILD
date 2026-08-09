/**
 * AppDashboardPage — tenant dashboard (post-login).
 */

import { useNavigate } from 'react-router-dom';
import { ComingSoonCard } from '@/components/ui';
import { useAuth } from '@/hooks';
import { useTranslation } from 'react-i18next';
import { PassNotification } from '@/components/business/dashboard/PassNotification';

export default function AppDashboardPage() {
  const { state, logout } = useAuth();
  const { t } = useTranslation('auth');
  const navigate = useNavigate();

  function handleCta() {
    navigate('/settings/billing');
  }

  return (
    <div className="flex flex-col gap-4 p-4 pt-16">
      {/* Pass notification — handles trial / expired / renewal reminder */}
      <PassNotification pass={state.pass ?? null} onCta={handleCta} />

      <ComingSoonCard
        title={t('app.dashboard.title', 'Tenant dashboard — coming soon')}
        description={t('app.dashboard.description', 'The tenant app is under construction.')}
        action={
          <div className="flex flex-col gap-2">
            <p className="text-sm text-neutral-700">{state.tenant?.name}</p>
            <button type="button" onClick={logout} className="min-h-[44px] rounded border border-neutral-300 px-4 py-2 text-sm">
              {t('app.dashboard.logout', 'Sign out')}
            </button>
          </div>
        }
      />
    </div>
  );
}
