/**
 * AdminDashboardPage — placeholder shell for admin dashboard.
 *
 * Bug-6: the inline sign-out button used the Tailwind neutral palette,
 * which renders as a near-invisible ghost on the dark page background
 * defined by design-system/MASTER.md. We pull colors from
 * `--color-border` and `--color-foreground` (or, better, the L1 Button
 * variant) so the action is always visible.
 */

import { ComingSoonCard } from '@/components/ui';
import { useAuth } from '@/hooks';
import { useTranslation } from 'react-i18next';

export default function AdminDashboardPage() {
  const { logout } = useAuth();
  const { t } = useTranslation('auth');
  return (
    <div className="flex flex-col gap-4 p-4 pt-16">
    <ComingSoonCard
      title={t('admin.dashboard.title', 'Admin dashboard — coming soon')}
      description={t('admin.dashboard.description', 'The admin console is under construction.')}
      action={
        <button
          type="button"
          onClick={logout}
          className="min-h-[44px] rounded border px-4 py-2 text-sm transition-colors hover:opacity-80"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'transparent',
            color: 'var(--color-foreground)',
          }}
        >
          {t('admin.dashboard.logout', 'Sign out')}
        </button>
      }
    />
    </div>
  );
}