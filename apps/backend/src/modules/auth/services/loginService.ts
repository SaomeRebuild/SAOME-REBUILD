/**
 * Login business logic.
 *
 * @module modules/auth/services/loginService
 * @description Verify email + password, record the attempt, return tokens.
 */

import type { Sql } from '@/shared/db/client';
import type { LoginCredentials } from '../schemas/request';
import type { AuthSessionDto } from '@/contracts/auth';
import { AuthError, ForbiddenError } from '@/shared/lib/saomeError';
import { verifyPassword } from '@/shared/lib/password';
import { signAccessToken, signRefreshToken } from '@/shared/lib/jwt';
import { findUserByEmail } from '../db/users';
import { insertLoginAttempt } from '../db/loginAttempts';
import { findTenantByOwnerId } from '../db/tenants';

const ACCESS_TOKEN_TTL_DEFAULT = 900;

export async function loginService(
  sql: Sql,
  jwtSecret: string,
  credentials: LoginCredentials,
  accessTokenTtl: number = ACCESS_TOKEN_TTL_DEFAULT
): Promise<AuthSessionDto> {
  const user = await findUserByEmail(sql, credentials.email);

  if (!user) {
    // Anti-enumeration: insert a fail attempt with user_id NULL, then return same error as wrong password.
    await insertLoginAttempt(sql, {
      userId: null,
      emailAttempted: credentials.email,
      success: false,
    });
    throw new AuthError('auth.error.invalidCredentials', 'Invalid email or password');
  }

  if (!user.is_active) {
    await insertLoginAttempt(sql, {
      userId: user.id,
      emailAttempted: credentials.email,
      success: false,
    });
    throw new ForbiddenError('auth.error.accountInactive', 'Account is inactive');
  }

  const valid = await verifyPassword(credentials.password, user.password_hash);
  if (!valid) {
    await insertLoginAttempt(sql, {
      userId: user.id,
      emailAttempted: credentials.email,
      success: false,
    });
    throw new AuthError('auth.error.invalidCredentials', 'Invalid email or password');
  }

  await insertLoginAttempt(sql, {
    userId: user.id,
    emailAttempted: credentials.email,
    success: true,
  });

  // Tenant (admin won't have one)
  const tenant = await findTenantByOwnerId(sql, user.id);

  const tokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  const accessToken = await signAccessToken(tokenPayload, jwtSecret, accessTokenTtl);
  const refreshToken = await signRefreshToken(tokenPayload, jwtSecret);

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
    refreshToken,
  };
}