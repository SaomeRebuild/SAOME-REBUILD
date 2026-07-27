/**
 * AppDashboardPage — placeholder shell for tenant dashboard (post-login).
 */

import { ComingSoonCard } from '@/components/ui';
import { useAuth } from '@/hooks';
import { useTranslation } from 'react-i18next';

export default function AppDashboardPage() {
  const { state, logout } = useAuth();
  const { t } = useTranslation('auth');
  return (
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
  );
}