/**
 * LoginPage — wraps LoginForm with AuthShell + language switcher.
 *
 * If the user is already authenticated (back button after login, or a
 * valid refresh cookie makes AuthProvider recover their session on mount),
 * we redirect them to their role's landing path. Without this, the
 * LoginForm would render and confuse the user. (Bug-5.)
 *
 * Phase 2026-09-09 — Cold start 503 dead zone closure: this page fires
 * a fire-and-forget GET /health on mount (100ms delay) to pre-warm the
 * Worker isolate. Without this, an idle Worker hit by a user login sees
 * a cold-start 503 → browser CORS drop → user-visible "Network error".
 * The fetch is silent (no UI change, no error surfaced). Pair with
 * httpClient.network-retry for defense-in-depth: warmup prevents, retry
 * backstops.
 */

import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '@/components/ui';
import { LoginForm, AuthLanguageSwitcher } from '@/components/business/auth';
import { useAuth } from '@/hooks';
import { api } from '@/config/api';
import { ROUTES } from '@/config/routes';
import { ROLE_HOME_PATH, type Role } from '@saome/shared/constants/role';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const { state, isAuthenticated } = useAuth();

  // Worker isolate warmup — see JSDoc above. 100ms delay so we don't
  // race React hydration or compete with AuthProvider's mount-time
  // refresh attempt. AbortController ensures the fetch is cancelled
  // if the user navigates away before the ping resolves.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`${api.baseUrl}/health`, {
        method: 'GET',
        signal: ctrl.signal,
        credentials: 'omit',
      }).catch(() => {
        /* swallow — httpClient.network-retry handles real failures on
           the subsequent user-triggered POST /api/auth/login */
      });
    }, 100);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, []);

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