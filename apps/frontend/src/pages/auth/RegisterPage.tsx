/**
 * RegisterPage — wraps RegisterForm with AuthShell + language switcher.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '@/components/ui';
import { RegisterForm, AuthLanguageSwitcher } from '@/components/business/auth';
import { ROUTES } from '@/config/routes';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
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