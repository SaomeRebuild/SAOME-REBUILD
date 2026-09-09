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
import { findTenantById } from '../db/tenants';
import { getPassStatus, advanceBillingCycle } from '@/modules/pass/db/passes';
import { isTokenRevoked } from '../db/revokedTokens';

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

  // Phase 2.2 (2026-09-05): server-side revocation check. A token that
  // was explicitly revoked (e.g. on logout) is rejected here, before we
  // even look up the user. Cached in-process so refresh storms don't
  // pile up DB hits.
  if (await isTokenRevoked(sql, payload.jti)) {
    throw new AuthError('auth.error.tokenRevoked', 'Refresh token has been revoked');
  }

  // Issue new access token + new refresh token (rotation).
  // Phase 3.2 (2026-09-09): trust the verified JWT for user identity
  // (no `findUserById` DB lookup). Tenant id is taken from the JWT claim
  // and resolved via PK lookup below. See
  // `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`.
  const tokenPayload = {
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    tenantId: payload.tenantId,
  };
  const accessToken = await signAccessToken(tokenPayload, jwtSecret, accessTokenTtl);
  const newRefreshToken = await signRefreshToken(tokenPayload, jwtSecret);

  // Hydrate tenant (admin won't have one)
  const tenant = payload.tenantId ? await findTenantById(sql, payload.tenantId) : null;

  // Pass — embedded in session to avoid a separate /api/me/pass polling call.
  // Lazy update: advance billing cycle if needed (for paid users who haven't logged in for a while).
  if (tenant) await advanceBillingCycle(sql, tenant.id);
  const passStatus = tenant ? await getPassStatus(sql, tenant.id) : null;
  const pass: AuthSessionDto['pass'] = passStatus
    ? {
        endDate: passStatus.endDate.toISOString(),
        daysRemaining: passStatus.daysRemaining,
        status: passStatus.status,
        plan: passStatus.plan as 'green' | 'gold' | 'platinum',
        phase: passStatus.phase,
        paidAt: passStatus.paidAt?.toISOString() ?? null,
        billingCycleEnd: passStatus.billingCycleEnd?.toISOString() ?? null,
      }
    : null;

  const authUserDto = {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  };

  return {
    user: authUserDto,
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          contactName: tenant.contact_name,
          phoneCity: tenant.phone_city ?? null,
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
    pass,
  };
}