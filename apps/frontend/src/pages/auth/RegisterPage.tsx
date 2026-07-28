/**
 * RegisterPage — wraps RegisterForm with AuthShell + language switcher.
 *
 * Same back-button guard as LoginPage: if AuthProvider has already
 * recovered a session, push the user to their role landing instead
 * of letting them start registration they don't need. (Bug-5.)
 */

import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '@/components/ui';
import { RegisterForm, AuthLanguageSwitcher } from '@/components/business/auth';
import { useAuth } from '@/hooks';
import { ROUTES } from '@/config/routes';
import { ROLE_HOME_PATH, type Role } from '@saome/shared/constants/role';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const { state, isAuthenticated } = useAuth();

  if (!state.loading && isAuthenticated && state.user) {
    return <Navigate to={ROLE_HOME_PATH[state.user.role as Role]} replace />;
  }

  return (
    <AuthShell
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      langSwitcher={<AuthLanguageSwitcher />}
      footer={
        <p className="text-center text-sm text-neutral-600">
          <Link to={ROUTES.login} className="font-medium text-neutral-900 underline">
            {t('register.switchToLogin')}
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}