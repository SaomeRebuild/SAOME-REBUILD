/**
 * AdminDashboardPage — placeholder shell for admin dashboard.
 */

import { ComingSoonCard } from '@/components/ui';
import { useAuth } from '@/hooks';
import { useTranslation } from 'react-i18next';

export default function AdminDashboardPage() {
  const { logout } = useAuth();
  const { t } = useTranslation('auth');
  return (
    <ComingSoonCard
      title={t('admin.dashboard.title', 'Admin dashboard — coming soon')}
      description={t('admin.dashboard.description', 'The admin console is under construction.')}
      action={
        <button type="button" onClick={logout} className="min-h-[44px] rounded border border-neutral-300 px-4 py-2 text-sm">
          {t('admin.dashboard.logout', 'Sign out')}
        </button>
      }
    />
  );
}