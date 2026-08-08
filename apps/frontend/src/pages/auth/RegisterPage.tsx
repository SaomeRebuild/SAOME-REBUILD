/**
 * RegisterPage — wraps RegisterForm with AuthShell + language switcher.
 *
 * Same back-button guard as LoginPage: if AuthProvider has already
 * recovered a session, push the user to their role landing instead
 * of letting them start registration they don't need. (Bug-5.)
 */

import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '@/components/ui';
import { RegisterForm, AuthLanguageSwitcher } from '@/components/business/auth';
import { useAuth } from '@/hooks';
import { ROUTES } from '@/config/routes';
import { ROLE_HOME_PATH, type Role } from '@saome/shared/constants/role';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const { state, isAuthenticated } = useAuth();
  const [step, setStep] = useState(0);

  if (!state.loading && isAuthenticated && state.user) {
    return <Navigate to={ROLE_HOME_PATH[state.user.role as Role]} replace />;
  }

  const isStep3 = step === 2;

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
      fullWidth={isStep3}
    >
      <RegisterForm currentStep={step} onStepChange={setStep} />
    </AuthShell>
  );
}