/**
 * Auth Types
 *
 * @module shared/types/auth
 * @description DTO / interface shapes for the auth domain.
 * For request/response **validation** use zod schemas at shared/schemas/auth.ts.
 * For runtime **instances** (e.g. "this user object I just received from the API"),
 * the inferred zod types are re-exported here for non-zod consumers.
 *
 * Note: `Role` lives in `constants/role.ts` to avoid name collisions when
 * `types/index.ts` and `constants/index.ts` both re-export it.
 */

import type {
  LoginCredentials,
  AuthSession,
  RegisterResponse,
  LoginAttempt,
  LockoutState,
  JwtPayloadSchema,
  RegistrationPayload,
  TenantInfoInput,
  AccountInfoInput,
} from '../schemas/auth';
import type { Role } from '../constants/role';

export { Role };
export type { LoginCredentials, AuthSession, RegisterResponse, LoginAttempt, LockoutState };
export type JwtPayload = JwtPayloadSchema;
export type { RegistrationPayload, TenantInfoInput, AccountInfoInput };

/** A public-safe representation of a tenant user (no DB row shape) */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

/** A public-safe representation of a tenant profile (no DB row shape) */
export interface AuthTenant {
  id: string;
  ownerUserId: string;
  name: string;
  contactName: string;
  phoneCity: string;
  address: string;
  taxId: string;
  invoiceAddress: string | null;
  mobile: string | null;
  website: string | null;
  email: string;
}

/** AuthSession that includes optional tenant (login/register) */
export interface AuthSessionWithTenant extends AuthSession {
  tenant?: AuthTenant | null;
  expiresIn?: number;
  refreshToken?: string;
}

/** Frontend AuthProvider state shape */
export interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
  lockout: LockoutState | null;
}