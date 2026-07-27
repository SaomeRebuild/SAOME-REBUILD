/**
 * Auth Schemas (zod)
 *
 * @module shared/schemas/auth
 * @description TDD-driven; failing tests live in schemas/auth.test.ts
 */

import { z } from 'zod';
export { ROLE_TENANT, ROLE_ADMIN, type Role } from '../constants/role';

/** Role enum mirrors DB users.role; the inferred type alias `Role` lives in constants/role.ts */
export const roleSchema = z.enum(['tenant', 'admin']);

/**
 * `tax_id` accepts:
 *  - the literal "0" (個人戶/工作室 — 無統編)
 *  - 8 numeric digits
 * Rejects everything else with a stable error message.
 */
export const taxIdSchema = z
  .string()
  .refine((v) => v === '0', { message: 'taxIdInvalid' })
  .or(
    z.string().regex(/^\d{8}$/, { message: 'taxIdInvalid' }),
  );

/**
 * Tenant Step 1 — store info (店家資料)
 */
export const tenantInfoSchema = z.object({
  contactName: z.string().min(2).max(100),
  phoneCity: z.string().min(7).max(30),
  address: z.string().min(5).max(500),
  taxId: taxIdSchema,
  companyName: z.string().min(2).max(200),
  invoiceAddress: z.string().max(500).optional().default(''),
});
export type TenantInfoInput = z.infer<typeof tenantInfoSchema>;

/**
 * Tenant Step 2 — account info (帳號資料)
 *
 * Note: `accountInfoBase` is the ZodObject shape (supports `.omit()`),
 * and `accountInfoSchema` adds the password-mismatch refinement on top.
 * Splitting these lets `registrationPayloadSchema` reuse the base without
 * pulling in `confirmPassword` (which the backend doesn't need).
 */
export const accountInfoBase = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
  mobile: z.string().regex(/^(\+?\d{8,15})?$/).optional(),
  website: z.string().url().optional(),
  businessEmail: z.string().email().optional(),
});

export const accountInfoSchema = accountInfoBase.refine(
  (d) => d.password === d.confirmPassword,
  {
    message: 'passwordMismatch',
    path: ['confirmPassword'],
  },
);
export type AccountInfoInput = z.infer<typeof accountInfoBase>;

/** Account credentials only (for login) — pulled out so backend can share */
export const accountCredentialsSchema = accountInfoBase.pick({ email: true, password: true });
export type AccountCredentials = z.infer<typeof accountCredentialsSchema>;

/** Login form */
export const loginCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;

/** Server-emitted lockout state */
export const lockoutStateSchema = z.object({
  locked: z.boolean(),
  remainingSeconds: z.number().int().nonnegative(),
});
export type LockoutState = z.infer<typeof lockoutStateSchema>;

/** JWT payload carried in access & refresh tokens */
export const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: roleSchema,
  iat: z.number().int(),
  exp: z.number().int(),
});
export type JwtPayloadSchema = z.infer<typeof jwtPayloadSchema>;

/** Successful login response (frontend receives this as JSON; refresh token comes via HttpOnly cookie) */
export const authSessionSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: roleSchema,
  }),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

/** Successful registration response (tokens + tenant id) */
export const registerResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: roleSchema,
  }),
  tenantId: z.string().uuid(),
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

/** A login attempt row (used by BDD fixtures + server-side rate limit) */
export const loginAttemptSchema = z.object({
  id: z.number().int().nonnegative(),
  userId: z.string().uuid().nullable(),
  emailAttempted: z.string(),
  success: z.boolean(),
  attemptedAt: z.union([z.date(), z.number()]),
});
export type LoginAttempt = z.infer<typeof loginAttemptSchema>;

/** Combined registration payload sent to the backend (Tenant Info + Account Info flat) */
export const registrationPayloadSchema = tenantInfoSchema.merge(
  accountInfoBase.omit({ confirmPassword: true }),
).extend({
  invoiceAddress: z.string().min(1).max(500),
});
export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;
