/**
 * Refresh token rotation logic.
 *
 * @module modules/auth/services/refreshService
 */

import type { Sql } from '@/shared/db/client';
import type { RefreshResponseDto } from '@/contracts/auth';
import { AuthError, ForbiddenError } from '@/shared/lib/saomeError';
import { verifyToken, signAccessToken, signRefreshToken } from '@/shared/lib/jwt';
import { findUserById } from '../db/users';

const ACCESS_TOKEN_TTL_DEFAULT = 900;

export async function refreshService(
  sql: Sql,
  jwtSecret: string,
  refreshToken: string,
  accessTokenTtl: number = ACCESS_TOKEN_TTL_DEFAULT
): Promise<RefreshResponseDto> {
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

  return {
    accessToken,
    expiresIn: accessTokenTtl,
    refreshToken: newRefreshToken,
  };
}