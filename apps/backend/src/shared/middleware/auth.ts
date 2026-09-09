/**
 * JWT auth middleware (shared).
 *
 * @module shared/middleware/auth
 * @description Verifies the access token from `Authorization: Bearer ...` header,
 * loads the user from DB, and attaches it to Hono context as `c.get('user')`.
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { verifyToken } from '@/shared/lib/jwt';
import { AuthError, ForbiddenError } from '@/shared/lib/saomeError';
import { getDb } from '@/shared/db/client';
import { isTokenRevoked } from '@/modules/auth/db/revokedTokens';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'tenant' | 'admin';
}

export const AUTH_USER_KEY = 'user' as const;

export function getAuthenticatedUser(c: Context<HonoEnv>): AuthenticatedUser {
  const user = c.get(AUTH_USER_KEY);
  if (!user) {
    throw new Error('getAuthenticatedUser called without prior requireAuth');
  }
  return user as AuthenticatedUser;
}

export const requireAuth: MiddlewareHandler<HonoEnv> = async (c, next) => {
  // Support both Authorization header and ?token= query param.
  // ?token= is required for <img src> requests which don't send cookies.
  let token: string | undefined;

  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim();
  } else {
    // Try ?token= query param (for <img> requests without cookies)
    token = c.req.query('token');
  }

  if (!token) {
    throw new AuthError('auth.error.missingToken', 'Missing or malformed Authorization header');
  }

  const secret = (c.env as { JWT_SECRET?: string }).JWT_SECRET ?? '';
  let payload;
  try {
    payload = await verifyToken(token, secret);
  } catch {
    throw new AuthError('auth.error.invalidToken', 'Invalid or expired token');
  }

  // Phase 2.2 (2026-09-05): check server-side revocation list. Cached
  // in-process (5s) so this is one DB hit per cold start, then free.
  const sql = await getDb(c.env.HYPERDRIVE);
  if (await isTokenRevoked(sql, payload.jti)) {
    throw new AuthError('auth.error.tokenRevoked', 'Token has been revoked');
  }

  // Phase 3.2 (2026-09-09): trust the verified JWT for user identity.
  // `is_active` is enforced only at login (loginService). After login, a
  // revoked token can no longer reach this middleware (Phase 2.2
  // `revoked_tokens` table). Removing `findUserById` saves one DB round-trip
  // per protected request — the main lever for staying under the Free plan
  // 10 ms CPU budget. See
  // `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`.
  c.set(AUTH_USER_KEY, {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    tenantId: payload.tenantId,
  } as never);
  await next();
};

export function requireRole(role: 'tenant' | 'admin'): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const user = c.get(AUTH_USER_KEY) as AuthenticatedUser | undefined;
    if (!user) {
      throw new AuthError('auth.error.missingToken', 'Authentication required');
    }
    if (user.role !== role) {
      throw new ForbiddenError('auth.error.wrongRole', `Requires role ${role}`);
    }
    await next();
  };
}