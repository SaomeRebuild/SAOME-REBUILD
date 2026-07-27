/**
 * LoginForm — email + password login with lockout UX.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Field, PasswordField, SubmitButton, ErrorBanner, CountdownText } from '@/components/ui';
import { loginCredentialsSchema, type LoginCredentials } from '@saome/shared/schemas/auth';
import { useAuth, useLoginLockout } from '@/hooks';
import { SaomeApiError } from '@/services/httpClient';

export function LoginForm() {
  const { t } = useTranslation('auth');
  const { login } = useAuth();
  const { isLocked, remainingSec, recordFailure, recordSuccess } = useLoginLockout();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginCredentialsSchema),
  });

  async function onSubmit(values: LoginCredentials) {
    if (isLocked) {
      setServerError(null);
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      await login(values);
      recordSuccess();
    } catch (e) {
      recordFailure();
      if (e instanceof SaomeApiError) {
        setServerError(t('login.error.invalidCredentials'));
      } else {
        setServerError(t('login.error.unknown'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {serverError ? <ErrorBanner message={serverError} /> : null}
      {isLocked ? (
        <ErrorBanner
          message={t('login.locked.message', { seconds: remainingSec })}
        />
      ) : null}

      <Field label={t('login.email')} required error={errors.email?.message ? t('login.error.email') : undefined}>
        <input
          type="email"
          autoComplete="email"
          {...register('email')}
          disabled={isLocked || submitting}
          className="min-h-[44px] w-full rounded border border-neutral-300 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
        />
      </Field>

      <PasswordField
        label={t('login.password')}
        autoComplete="current-password"
        required
        disabled={isLocked || submitting}
        {...register('password')}
        error={errors.password?.message ? t('login.error.required') : undefined}
      />

      <SubmitButton loading={submitting} loadingText={t('login.submitting')} disabled={isLocked} fullWidth>
        {t('login.submit')}
      </SubmitButton>

      {isLocked ? (
        <p className="text-center text-xs text-neutral-500">
          <CountdownText seconds={remainingSec} />
        </p>
      ) : null}
    </form>
  );
}

export default LoginForm;
