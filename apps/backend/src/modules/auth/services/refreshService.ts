/**
 * Refresh token rotation logic.
 *
 * @module modules/auth/services/refreshService
 *
 * Bug-7 follow-up: returns the full AuthSessionDto (user + tenant) so the
 * frontend AuthProvider can recover the session in a single round-trip after
 * page reload. Previously the frontend called /api/auth/me separately, but
 * that endpoint requires an Authorization header that the AuthProvider
 * didn't carry before the refresh response returned, causing a chicken-and-
 * egg 401.
 */

import type { Sql } from '@/shared/db/client';
import type { AuthSessionDto } from '@/contracts/auth';
import { AuthError, ForbiddenError } from '@/shared/lib/saomeError';
import { verifyToken, signAccessToken, signRefreshToken } from '@/shared/lib/jwt';
import { findUserById } from '../db/users';
import { findTenantByOwnerId } from '../db/tenants';

const ACCESS_TOKEN_TTL_DEFAULT = 900;

export async function refreshService(
  sql: Sql,
  jwtSecret: string,
  refreshToken: string,
  accessTokenTtl: number = ACCESS_TOKEN_TTL_DEFAULT
): Promise<AuthSessionDto> {
  let payload;
  try {
    payload = await verifyToken(refreshToken, jwtSecret);
  } catch {
    throw new AuthError('auth.error.invalidRefreshToken', 'Invalid or expired refresh token');
  }

  const user = await findUserById(sql, payload.sub);
  if (!user) {
    throw new AuthError('auth.error.userNotFound', 'User not found');
  }
  if (!user.is_active) {
    throw new ForbiddenError('auth.error.accountInactive', 'Account is inactive');
  }

  // Issue new access token + new refresh token (rotation)
  const tokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  const accessToken = await signAccessToken(tokenPayload, jwtSecret, accessTokenTtl);
  const newRefreshToken = await signRefreshToken(tokenPayload, jwtSecret);

  // Hydrate tenant (admin won't have one)
  const tenant = await findTenantByOwnerId(sql, user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          contactName: tenant.contact_name,
          phoneCity: tenant.phone_city,
          address: tenant.address,
          taxId: tenant.tax_id,
          invoiceAddress: tenant.invoice_address,
          mobile: tenant.mobile,
          website: tenant.website,
          email: tenant.email,
        }
      : null,
    accessToken,
    expiresIn: accessTokenTtl,
    refreshToken: newRefreshToken,
  };
}