/**
 * authService — login, logout, register, refresh, me.
 *
 * Uses `httpClient` for transport. Refresh token is stored in an HttpOnly cookie
 * set by the backend, so this service does not handle token persistence directly.
 * Access tokens are held in memory by the AuthProvider (via state).
 *
 * Bug-7 follow-up: `refresh()` now returns the full session (user + tenant +
 * accessToken) so the AuthProvider can recover the session on page reload
 * without a second `/api/auth/me` call. The /me endpoint still exists for
 * callers that already have an access token in memory.
 */

import { httpClient } from './httpClient';
import { api } from '@/config/api';
import { getAccessToken, setAccessToken } from './authStore';
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

/**
 * Helper: extract and sync the accessToken from any session response.
 */
function syncToken(session: AuthSessionWithTenant) {
  if (session.accessToken) {
    console.debug('[authService.syncToken] setting token:', session.accessToken.slice(0, 20) + '...');
    setAccessToken(session.accessToken);
  }
}

export const authService = {
  async login(creds: LoginCredentials): Promise<AuthSessionWithTenant> {
    const session = await httpClient.post<AuthSessionWithTenant>(api.paths.login, creds);
    syncToken(session);
    return session;
  },

  async register(payload: RegistrationPayload): Promise<AuthSessionWithTenant> {
    const session = await httpClient.post<AuthSessionWithTenant>(api.paths.register, payload);
    syncToken(session);
    return session;
  },

  async refresh(): Promise<AuthSessionWithTenant> {
    // Bug-7 follow-up: backend now returns the full session in the refresh
    // response, so this single call is enough for AuthProvider to recover
    // the user/tenant on mount.
    const session = await httpClient.post<AuthSessionWithTenant>(api.paths.refresh);
    console.debug('[authService.refresh] got session, accessToken:', session.accessToken ? 'present (' + session.accessToken.slice(0, 20) + '...)' : 'MISSING');
    syncToken(session);
    console.debug('[authService.refresh] authStore token now:', getAccessToken() ? 'set' : 'still null');
    return session;
  },

  async me(): Promise<MeResponse> {
    return httpClient.get<MeResponse>(api.paths.me);
  },

  /** Local-only logout: drop in-memory token. Server cookie is cleared by the browser. */
  logout(): void {
    setAccessToken(null);
  },
};