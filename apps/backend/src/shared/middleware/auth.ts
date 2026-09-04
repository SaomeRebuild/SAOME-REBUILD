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
import { findUserById } from '@/modules/auth/db/users';
import { getDb } from '@/shared/db/client';

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
  const sql = await getDb(c.env.HYPERDRIVE);
  const userRow = await findUserById(sql, payload.sub);
  if (!userRow) {
    throw new AuthError('auth.error.userNotFound', 'User not found');
  }
  if (!userRow.is_active) {
    throw new ForbiddenError('auth.error.accountInactive', 'Account is inactive');
  }
  c.set(AUTH_USER_KEY, {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role,
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