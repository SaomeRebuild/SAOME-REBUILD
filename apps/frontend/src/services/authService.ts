/**
 * authService — login, logout, register, refresh, me.
 *
 * Uses `httpClient` for transport. Refresh token is stored in an HttpOnly cookie
 * set by the backend, so this service does not handle token persistence directly.
 * Access tokens are held in memory by the AuthProvider (via state).
 */

import { httpClient } from './httpClient';
import { api } from '@/config/api';
import type {
  LoginCredentials,
  RegistrationPayload,
  AuthUser,
  AuthTenant,
  AuthSessionWithTenant,
} from '@saome/shared/types/auth';

interface MeResponse {
  user: AuthUser;
  tenant: AuthTenant | null;
}

interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export const authService = {
  async login(creds: LoginCredentials): Promise<AuthSessionWithTenant> {
    return httpClient.post<AuthSessionWithTenant>(api.paths.login, creds);
  },

  async register(payload: RegistrationPayload): Promise<AuthSessionWithTenant> {
    return httpClient.post<AuthSessionWithTenant>(api.paths.register, payload);
  },

  async refresh(): Promise<RefreshResponse> {
    return httpClient.post<RefreshResponse>(api.paths.refresh);
  },

  async me(): Promise<MeResponse> {
    return httpClient.get<MeResponse>(api.paths.me);
  },

  /** Local-only logout: drop in-memory token. Server cookie is cleared by the browser. */
  logout(): void {
    // No-op server-side; backend provides /api/auth/logout later. For MVP, the
    // refresh cookie will expire naturally, and the AuthProvider clears state.
  },
};