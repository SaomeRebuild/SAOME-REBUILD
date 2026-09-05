/**
 * DashboardHeaderActions — top-right actions: ThemeToggle + LanguageSwitcher + user info + logout.
 *
 * RN migration: lucide-react icons → lucide-react-native. Hook interfaces stay identical.
 */
import { LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks';
import { ThemeToggle } from '@/components/ui/theme';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { ROLE_HOME_PATH, type Role } from '@saome/shared/constants/role';

interface DashboardHeaderActionsProps {
  className?: string;
}

export function DashboardHeaderActions({ className }: DashboardHeaderActionsProps) {
  // Explicitly specify namespaces: ['dashboard', 'translation']
  // t('dashboard.dashboardHeader.*')  → dashboard namespace
  // t('nav.login')                    → translation namespace
  const { t } = useTranslation(['dashboard', 'nav']);
  const { state, isAuthenticated, logout } = useAuth();

  const dashboardPath =
    state.user?.role && (state.user.role === 'admin' || state.user.role === 'tenant')
      ? ROLE_HOME_PATH[state.user.role as Role]
      : '#';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ThemeToggle />

      <LanguageSwitcher />

      {isAuthenticated ? (
        <>
          <Link
            to={dashboardPath}
            className="hidden text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] lg:block"
            data-testid="dashboard-user-email"
          >
            {state.user?.email}
          </Link>
          <button
            type="button"
            onClick={() => {
              // useAuth.logout is async (server call + navigate). Wrap so React
              // doesn't choke on the unhandled Promise.
              void logout();
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors"
            data-testid="dashboard-logout-btn"
          >
            <LogOut size={16} aria-hidden="true" />
            {t('dashboardHeader.logout')}
          </button>
        </>
      ) : (
        <Link
          to="/login"
          className="text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          {t('nav.login')}
        </Link>
      )}
    </div>
  );
}
