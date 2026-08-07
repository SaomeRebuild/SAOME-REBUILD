/**
 * AuthProvider — supplies auth state via context.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authService } from '@/services/authService';
import type { AuthUser, AuthTenant, Role } from '@saome/shared/types/auth';
import type { RegistrationPayload, LoginCredentials } from '@saome/shared/schemas/auth';

export interface AuthState {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  accessToken: string | null;
  loading: boolean;
  /** Unix ms when the current access token expires (set from `expiresIn`). */
  expiresAt: number | null;
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
        // Bug-7 follow-up: refresh() now returns the full session (user + tenant)
        // so we can populate state without a separate /me call.
        const session = await authService.refresh();
        if (cancelled) return;
        setStateRaw({
          user: session.user,
          tenant: session.tenant ?? null,
          accessToken: session.accessToken,
          expiresAt: Date.now() + (session.expiresIn ?? 28800) * 1000,
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

  // Proactive refresh: fire ~1 hour before token expires to avoid silent expiry.
  // Also acts as a keep-alive ping so the session stays alive across page navigations.
  useEffect(() => {
    if (!state.expiresAt || state.loading) return;

    const MS_BEFORE_EXPIRY_TO_REFRESH = 60 * 60 * 1000; // 1 hour
    const INTERVAL_MS = 60 * 60 * 1000; // refresh every hour

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
            expiresAt: Date.now() + (refreshed.expiresIn ?? 28800) * 1000,
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
      expiresAt: Date.now() + (session.expiresIn ?? 28800) * 1000,
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
      expiresAt: Date.now() + (session.expiresIn ?? 28800) * 1000,
      loading: false,
    });
    return tenant!;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setStateRaw({ user: null, tenant: null, accessToken: null, expiresAt: null, loading: false });
  }, []);

  const refresh = useCallback(async () => {
    const refreshed = await authService.refresh();
    setStateRaw((s) => ({
      ...s,
      accessToken: refreshed.accessToken,
      expiresAt: Date.now() + (refreshed.expiresIn ?? 28800) * 1000,
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