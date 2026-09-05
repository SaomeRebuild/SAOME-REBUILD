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

  // Proactive refresh: fire ~30 min before token expires to avoid silent expiry.
  // Also acts as a keep-alive ping so the session stays alive across page navigations.
  //
  // B4 follow-up (2026-09-05): ACCESS_TOKEN_TTL is now 3600s (1h) instead of
  // 28800s (8h), so the refresh window shortens proportionally.
  useEffect(() => {
    if (!state.expiresAt || state.loading) return;

    const MS_BEFORE_EXPIRY_TO_REFRESH = 30 * 60 * 1000; // 30 min before expiry
    const INTERVAL_MS = 30 * 60 * 1000; // refresh every 30 min as a keep-alive floor

    function scheduleNext() {
      const now = Date.now();
      const msUntilRefresh = state.expiresAt! - now - MS_BEFORE_EXPIRY_TO_REFRESH;
      const delay = Math.max(INTERVAL_MS, msUntilRefresh);

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