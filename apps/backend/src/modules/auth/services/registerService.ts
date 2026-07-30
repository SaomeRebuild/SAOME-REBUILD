/**
 * Registration business logic.
 *
 * @module modules/auth/services/registerService
 * @description Orchestrates: hash password → DB transaction (insert user +
 * insert tenant) → sign tokens. Pure function: takes sql, secrets, payload.
 */

import type { Sql } from '@/shared/db/client';
import type { RegistrationPayload } from '../schemas/request';
import type { AuthSessionDto } from '@/contracts/auth';
import { ConflictError } from '@/shared/lib/saomeError';
import { hashPassword } from '@/shared/lib/password';
import { signAccessToken, signRefreshToken } from '@/shared/lib/jwt';
import { insertUser, findUserByEmail } from '../db/users';
import { insertTenant, findTenantByTaxId } from '../db/tenants';

const ACCESS_TOKEN_TTL_DEFAULT = 900; // 15 min

export async function registerService(
  sql: Sql,
  jwtSecret: string,
  payload: RegistrationPayload,
  accessTokenTtl: number = ACCESS_TOKEN_TTL_DEFAULT
): Promise<AuthSessionDto> {
  // 1. Check email uniqueness before insert (fast-fail)
  const existing = await findUserByEmail(sql, payload.email);
  if (existing) {
    throw new ConflictError(
      'auth.error.emailTaken',
      'Email already in use',
      { email: payload.email },
    );
  }

  // 1b. Check tax_id uniqueness (only if taxId is provided and not "0")
  if (payload.taxId && payload.taxId !== '0') {
    const existingTenant = await findTenantByTaxId(sql, payload.taxId);
    if (existingTenant) {
      throw new ConflictError(
        'auth.error.taxIdTaken',
        'Tax ID already in use',
        { taxId: payload.taxId },
      );
    }
  }

  // 2. Hash password
  const passwordHash = await hashPassword(payload.password);

  // 3. Insert user + tenant in a transaction
  const result = await sql.begin(async (tx) => {
    const user = await insertUser(tx as unknown as Sql, {
      email: payload.email!,
      passwordHash,
      role: 'tenant',
    });
    const tenant = await insertTenant(tx as unknown as Sql, {
      ownerUserId: user.id,
      name: payload.name,
      contactName: payload.contactName,
      phoneCity: payload.phoneCity,
      address: payload.address,
      taxId: payload.taxId,
      invoiceAddress: payload.invoiceAddress ?? null,
      mobile: payload.mobile ?? null,
      website: payload.website ?? null,
      email: payload.email ?? null,
    });
    return { user, tenant };
  });

  // 4. Sign tokens
  const tokenPayload = {
    sub: result.user.id,
    email: result.user.email,
    role: 'tenant' as const,
  };
  const accessToken = await signAccessToken(tokenPayload, jwtSecret, accessTokenTtl);
  const refreshToken = await signRefreshToken(tokenPayload, jwtSecret);

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      role: 'tenant',
    },
    tenant: {
      id: result.tenant.id,
      name: result.tenant.name,
      contactName: result.tenant.contact_name,
      phoneCity: result.tenant.phone_city,
      address: result.tenant.address,
      taxId: result.tenant.tax_id,
      invoiceAddress: result.tenant.invoice_address,
      mobile: result.tenant.mobile,
      website: result.tenant.website,
      email: result.tenant.email,
    },
    accessToken,
    expiresIn: accessTokenTtl,
    refreshToken,
  };
}