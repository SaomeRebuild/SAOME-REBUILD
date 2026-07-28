/**
 * LoginForm — email + password login with lockout UX.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Field, PasswordField, SubmitButton, ErrorBanner, CountdownText } from '@/components/ui';
import { loginCredentialsSchema, type LoginCredentials } from '@saome/shared/schemas/auth';
import { useAuth, useLoginLockout, useAuthRedirect } from '@/hooks';
import { SaomeApiError } from '@/services/httpClient';

export function LoginForm() {
  const { t } = useTranslation('auth');
  const { login } = useAuth();
  const { isLocked, remainingSec, recordFailure, recordSuccess } = useLoginLockout();
  // Drive role-based landing once login succeeds (Bug-5 fix).
  useAuthRedirect();
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
      // Navigation is driven by useAuthRedirect above; it watches
      // `isAuthenticated` from AuthProvider and pushes to the role's
      // landing path.
    } catch (e) {
      recordFailure();
      if (e instanceof SaomeApiError) {
        // The httpClient already syncs local lockout to the server's
        // retryAfterSec when 429 is returned. Surface a specific
        // message here so the user knows why their request bounced.
        if (e.isRateLimited) {
          setServerError(t('login.error.tooManyAttempts'));
        } else {
          setServerError(t('login.error.invalidCredentials'));
        }
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
          className="min-h-[44px] w-full rounded px-3 py-2 text-base outline-none transition-colors focus:ring-2"
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-muted)',
            color: 'var(--color-foreground)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-ring)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-ring)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
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
