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
  phoneCity: string | null; // nullable — city phone is optional
  address: string;
  taxId: string;
  invoiceAddress: string | null;
  mobile: string; // required — cell phone is mandatory
  website: string | null;
  email: string;
}

/** Pass phase — derived from paid_at */
export type PassPhase = 'trial' | 'paid' | 'expired';

/** Pass info embedded in login/refresh response — avoids polling /api/me/pass. */
export interface PassInfo {
  endDate: string; // ISO 8601, e.g. "2026-08-22T00:00:00.000Z"
  daysRemaining: number;
  status: 'active' | 'expired' | 'cancelled';
  plan: 'green' | 'gold' | 'platinum';
  phase: PassPhase; // derived: trial (paidAt=null & days>0) | paid (paidAt!=null) | expired (paidAt=null & days=0)
  paidAt: string | null; // ISO 8601, NULL = still in trial
  billingCycleEnd: string | null; // ISO 8601, NULL = not yet paid
}

/** AuthSession that includes optional tenant (login/register) */
export interface AuthSessionWithTenant extends AuthSession {
  tenant?: AuthTenant | null;
  expiresIn?: number;
  refreshToken?: string;
  pass?: PassInfo | null; // embedded from login/refresh — no polling needed
}

/** Frontend AuthProvider state shape */
export interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
  lockout: LockoutState | null;
}