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
 * Rejects everything else with a stable error message (i18n key).
 */
export const taxIdSchema = z
  .string()
  .refine((v) => v === '0', { message: 'validation.taxIdInvalid' })
  .or(
    z.string().regex(/^\d{8}$/, { message: 'validation.taxIdInvalid' }),
  );

/**
 * E.164 international phone number regex.
 *
 * Format: optional leading `+` followed by 8-15 digits, with the first
 * digit being 1-9 (no leading zero after `+`). Accepts:
 *   - +886912345678  (international, 12 chars)
 *   - +14155551234   (US, 12 chars)
 *
 * Rejects strings with non-digit characters (no dashes / spaces),
 * leading zeros, and lengths outside 8-15 digits.
 */
export const e164PhoneRegex = /^\+[1-9]\d{7,14}$/;

/**
 * Normalize a phone string into E.164.
 *
 * Per UX decision (2026-07-31 AskQuestion response):
 *   - If the input already starts with `+`, validate as-is.
 *   - If the input is Taiwan bare local `09xxxxxxxx` (10 digits),
 *     prepend `+886` and drop the leading `0` → `+8869xxxxxxxx`.
 *   - Anything else is left untouched and will fail the regex check.
 *
 * Empty string input is allowed (the field is optional). Returns the
 * normalized form, or the original input if no rule matched.
 */
export function normalizePhoneToE164(input: string): string {
  if (typeof input !== 'string') return input;
  const trimmed = input.trim();
  if (trimmed === '') return trimmed;
  if (trimmed.startsWith('+')) return trimmed;
  // Taiwan bare local: 09xxxxxxxx (10 digits, "09" mobile prefix).
  if (/^09\d{8}$/.test(trimmed)) {
    return `+886${trimmed.slice(1)}`;
  }
  // Otherwise leave as-is so the regex check decides the verdict.
  return trimmed;
}

/**
 * Tenant Step 1 — store info (店家資料)
 *
 * `name` is the **company / store legal name** (公司 / 店家名稱) — what
 * appears on the registration certificate and on issued invoices.
 * Historically this column was called `companyName`; the backend's
 * `registrationPayloadSchema` (apps/backend/src/modules/auth/schemas/request.ts)
 * requires it under the canonical key `name`, so we keep both client and
 * server aligned here.
 *
 * `mobile` is the store / owner's **cell phone** in E.164 format.
 * It is distinct from `phoneCity` (office landline). Per decision
 * runs/decisions/2026-07-31-add-mobile-field.md it lives on
 * tenantInfoSchema (not accountInfoBase) because the DB column is
 * `tenants.mobile` and the wire format already accepts it as flat.
 *
 * `invoiceAddress` is optional at the schema level — the frontend may
 * default it to '' if the merchant does not have a separate invoice
 * address, and the backend `registrationPayloadSchema` upgrades the
 * min(1) requirement at the merged-payload level.
 */
export const tenantInfoSchema = z.object({
  name: z.string().min(2, 'validation.companyNameTooShort').max(200),
  contactName: z.string().min(2, 'validation.contactNameTooShort').max(100),
  // Mobile (cell phone) — REQUIRED; normalized to E.164 before submit
  mobile: z
    .preprocess((v) => {
      if (typeof v !== 'string') return v;
      if (v.trim() === '') return null;
      return normalizePhoneToE164(v);
    }, z.string().regex(e164PhoneRegex, 'validation.mobileInvalid')),
  // City phone (landline) — OPTIONAL
  phoneCity: z.string().max(30).optional().nullable(),
  address: z.string().min(5, 'validation.addressTooShort').max(500),
  taxId: taxIdSchema,
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
  email: z.string().email('validation.email'),
  password: z.string().min(8, 'validation.passwordTooShort'),
  confirmPassword: z.string().min(8, 'validation.passwordTooShort'),
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

/** Pricing plan enum — mirrors passes.plan CHECK constraint in DB */
export const planSchema = z.enum(['green', 'gold', 'platinum']);
export type Plan = z.infer<typeof planSchema>;

/** Successful login response (frontend receives this as JSON; refresh token comes via HttpOnly cookie) */
export const authSessionSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: roleSchema,
  }),
  pass: z
    .object({
      endDate: z.string(),
      daysRemaining: z.number().int().nonnegative(),
      status: z.enum(['active', 'expired', 'cancelled']),
      plan: planSchema,
    })
    .optional()
    .nullable(),
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

/**
 * Combined registration payload sent to the backend (Tenant Info + Account Info flat).
 *
 * MUST mirror `apps/backend/src/modules/auth/schemas/request.ts` —
 * the backend is the source of truth at runtime, but the client validates
 * against this copy first so we can surface field errors before hitting
 * the network.
 *
 * Note: `accountInfoBase` does not include `mobile` / `website` /
 * `businessEmail` at the moment (those optional tenantInfo fields have
 * not yet been wired into the Step 2 form), so we omit them from the
 * merged payload here. When the UI grows those inputs, extend this schema
 * in lockstep with the backend.
 */
export const registrationPayloadSchema = tenantInfoSchema.merge(
  accountInfoBase.omit({ confirmPassword: true }),
).extend({
  invoiceAddress: z.string().min(1, 'validation.required').max(500),
  // mobile is required (from tenantInfoSchema), phoneCity is optional
});
export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;

/**
 * Registration payload with plan selection (Step 3)
 */
export const registrationWithPlanSchema = registrationPayloadSchema.extend({
  plan: planSchema,
});
export type RegistrationWithPlanPayload = z.infer<typeof registrationWithPlanSchema>;
