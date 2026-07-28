/**
 * LoginPage — wraps LoginForm with AuthShell + language switcher.
 *
 * If the user is already authenticated (back button after login, or a
 * valid refresh cookie makes AuthProvider recover their session on mount),
 * we redirect them to their role's landing path. Without this, the
 * LoginForm would render and confuse the user. (Bug-5.)
 */

import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '@/components/ui';
import { LoginForm, AuthLanguageSwitcher } from '@/components/business/auth';
import { useAuth } from '@/hooks';
import { ROUTES } from '@/config/routes';
import { ROLE_HOME_PATH, type Role } from '@saome/shared/constants/role';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const { state, isAuthenticated } = useAuth();

  if (!state.loading && isAuthenticated && state.user) {
    return <Navigate to={ROLE_HOME_PATH[state.user.role as Role]} replace />;
  }

  return (
    <AuthShell
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      langSwitcher={<AuthLanguageSwitcher />}
      footer={
        <p className="text-center text-sm text-neutral-600">
          <Link to={ROUTES.register} className="font-medium text-neutral-900 underline">
            {t('login.switchToRegister')}
          </Link>
        </p>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}