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
        const refreshed = await authService.refresh();
        if (cancelled) return;
        const session = await authService.me();
        if (cancelled) return;
        setStateRaw({
          user: session.user,
          tenant: session.tenant,
          accessToken: refreshed.accessToken,
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

  const login = useCallback(async (creds: LoginCredentials) => {
    const session = await authService.login(creds);
    setStateRaw({
      user: session.user,
      tenant: session.tenant ?? null,
      accessToken: session.accessToken,
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
      loading: false,
    });
    return tenant!;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setStateRaw({ user: null, tenant: null, accessToken: null, loading: false });
  }, []);

  const refresh = useCallback(async () => {
    const refreshed = await authService.refresh();
    setStateRaw((s) => ({ ...s, accessToken: refreshed.accessToken }));
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