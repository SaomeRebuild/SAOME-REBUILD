/**
 * AuthProvider — supplies auth state via context.
 *
 * B4 (2026-09-05): `logout()` is now async and routes the user to `/login`
 * after server-side cookie-clear + local store cleanup. This satisfies the
 * Auth flow 鐵律 #2 (SPA 必走 client-side redirect) and provides the
 * reverse-direction symmetry to `useAuthRedirect` (鐵律 #3).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import type { AuthUser, AuthTenant, Role, PassInfo } from '@saome/shared/types/auth';
import type { RegistrationPayload, LoginCredentials } from '@saome/shared/schemas/auth';

export interface AuthState {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  accessToken: string | null;
  loading: boolean;
  /** Unix ms when the current access token expires (set from `expiresIn`). */
  expiresAt: number | null;
  /** Pass info — embedded in login/refresh response; zero polling needed. */
  pass: PassInfo | null;
}

export interface AuthContextValue {
  state: AuthState;
  isAuthenticated: boolean;
  login: (creds: LoginCredentials) => Promise<void>;
  register: (payload: RegistrationPayload) => Promise<AuthTenant>;
  logout: () => void;
  refresh: () => Promise<void>;
  /** For test/debug only */
  setState: (next: Partial<AuthState>) => void;
}

const initialState: AuthState = {
  user: null,
  tenant: null,
  accessToken: null,
  loading: true,
  expiresAt: null,
  pass: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<AuthState>(initialState);

  const setState = useCallback((next: Partial<AuthState>) => {
    setStateRaw((s) => ({ ...s, ...next }));
  }, []);

  // Try to refresh on mount to detect existing session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Bug-7 follow-up: refresh() now returns the full session (user + tenant + pass)
        // so we can populate state without a separate /me call.
        const session = await authService.refresh();
        if (cancelled) return;
        setStateRaw({
          user: session.user,
          tenant: session.tenant ?? null,
          accessToken: session.accessToken,
          expiresAt: Date.now() + (session.expiresIn ?? 3600) * 1000,
          pass: session.pass ?? null,
          loading: false,
        });
      } catch {
        if (cancelled) return;
        setStateRaw((s) => ({ ...s, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Proactive refresh: fire ~1 min before token expires to avoid silent expiry.
  // Also acts as a keep-alive ping so the session stays alive across page navigations.
  //
  // B4 follow-up (2026-09-05): ACCESS_TOKEN_TTL is 900s (15 min) — backend
  // constant ACCESS_TOKEN_TTL_DEFAULT in apps/backend/src/modules/auth/services/*.
  // The previous 30-min-before-expiry logic was written when TTL was 1h/8h.
  // With 15-min TTL, "30 min before" = a time that's already in the past,
  // making the timer fire AFTER expiry. Fix 401 (2026-09-09):
  //   - REFRESH_BEFORE_MS: 60s (was 30 min, now aligned with actual TTL)
  //   - MIN_REFRESH_INTERVAL_MS: 60s (was 30 min) — fires sooner if expiry is closer
  useEffect(() => {
    if (!state.expiresAt || state.loading) return;

    const REFRESH_BEFORE_MS = 60 * 1000; // 1 min before expiry
    const MIN_REFRESH_INTERVAL_MS = 60 * 1000; // floor: refresh at least every 1 min

    function scheduleNext() {
      const now = Date.now();
      const timeUntilExpiry = state.expiresAt! - now;
      const msUntilRefresh = timeUntilExpiry - REFRESH_BEFORE_MS;
      // Clamp: never delay more than 1 min past expiry, never less than 1 min
      const delay = Math.max(
        MIN_REFRESH_INTERVAL_MS,
        Math.max(1000, msUntilRefresh),
      );

      const timerId = window.setTimeout(async () => {
        try {
          const refreshed = await authService.refresh();
          setStateRaw((s) => ({
            ...s,
            accessToken: refreshed.accessToken,
            expiresAt: Date.now() + (refreshed.expiresIn ?? 3600) * 1000,
            pass: refreshed.pass ?? s.pass, // update pass if returned
          }));
        } catch {
          // Silently ignore refresh failures here — the next API call will
          // trigger another retry via httpClient.tryRefresh().
        }
        scheduleNext(); // schedule the next tick
      }, delay);

      return timerId;
    }

    const timerId = scheduleNext();
    return () => {
      if (timerId) window.clearTimeout(timerId);
    };
  }, [state.expiresAt, state.loading]);

  const login = useCallback(async (creds: LoginCredentials) => {
    const session = await authService.login(creds);
    setStateRaw({
      user: session.user,
      tenant: session.tenant ?? null,
      accessToken: session.accessToken,
      expiresAt: Date.now() + (session.expiresIn ?? 3600) * 1000,
      pass: session.pass ?? null,
      loading: false,
    });
  }, []);

  const register = useCallback(async (payload: RegistrationPayload) => {
    const session = await authService.register(payload);
    const tenant = (session.tenant ?? null) as AuthTenant | null;
    setStateRaw({
      user: session.user,
      tenant,
      accessToken: session.accessToken,
      expiresAt: Date.now() + (session.expiresIn ?? 3600) * 1000,
      pass: session.pass ?? null,
      loading: false,
    });
    return tenant!;
  }, []);

  // B4 (2026-09-05): logout now calls server + navigates to /login.
  // Wrapped in useCallback so the function reference is stable for
  // downstream consumers (DashboardHeaderActions's <button onClick>).
  const navigate = useNavigate();
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Server call failed — local tokens were still cleared by
      // authService.logout's catch handler. We still navigate so the
      // user lands on /login. (UX symmetry with the success path.)
    }
    setStateRaw({ user: null, tenant: null, accessToken: null, expiresAt: null, pass: null, loading: false });
    navigate('/login', { replace: true });
  }, [navigate]);

  const refresh = useCallback(async () => {
    const refreshed = await authService.refresh();
    setStateRaw((s) => ({
      ...s,
      accessToken: refreshed.accessToken,
      expiresAt: Date.now() + (refreshed.expiresIn ?? 3600) * 1000,
      pass: refreshed.pass ?? s.pass,
    }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      isAuthenticated: Boolean(state.user && state.accessToken),
      login,
      register,
      logout,
      refresh,
      setState,
    }),
    [state, login, register, logout, refresh, setState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

export type { Role };