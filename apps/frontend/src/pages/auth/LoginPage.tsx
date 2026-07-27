/**
 * LoginPage — wraps LoginForm with AuthShell + language switcher.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '@/components/ui';
import { LoginForm, AuthLanguageSwitcher } from '@/components/business/auth';
import { ROUTES } from '@/config/routes';

export default function LoginPage() {
  const { t } = useTranslation('auth');
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