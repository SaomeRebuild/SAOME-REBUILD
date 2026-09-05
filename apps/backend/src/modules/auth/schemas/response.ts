/**
 * Response zod schemas for the auth module.
 *
 * @module modules/auth/schemas/response
 * @description Mirrors `src/contracts/auth.ts` (DTO interfaces).
 *
 * NOTE: these are for documentation / runtime validation in tests only.
 * Routes manually `c.json({...})` using plain objects for performance.
 */

import { z } from 'zod';

export const authUserDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['tenant', 'admin']),
});

export const tenantDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contactName: z.string(),
  phoneCity: z.string(),
  address: z.string(),
  taxId: z.string(),
  invoiceAddress: z.string().nullable(),
  mobile: z.string().nullable(),
  website: z.string().nullable(),
  email: z.string().email().nullable(),
});

export const authSessionDtoSchema = z.object({
  user: authUserDtoSchema,
  tenant: tenantDtoSchema.nullable(),
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});

export const refreshResponseDtoSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});

export const meResponseDtoSchema = z.object({
  user: authUserDtoSchema,
  tenant: tenantDtoSchema.nullable(),
});

/** B4 (2026-09-05): logout response. Mirrors `LogoutResponseDto` in
 *  `src/contracts/auth.ts`. The route is idempotent and always returns
 *  `{ loggedOut: true }` — see `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md`. */
export const logoutResponseDtoSchema = z.object({
  loggedOut: z.literal(true),
});

export const errorResponseDtoSchema = z.object({
  error: z.object({
    code: z.string(),
    i18nKey: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  requestId: z.string(),
});

export const passDtoSchema = z.object({
  endDate: z.string().datetime(),
  daysRemaining: z.number().int().min(0),
  status: z.enum(['active', 'expired', 'cancelled']),
  plan: z.enum(['green', 'gold', 'platinum']),
  phase: z.enum(['trial', 'paid', 'expired']),
  paidAt: z.string().datetime().nullable(),
  billingCycleEnd: z.string().datetime().nullable(),
});
export type PassDto = z.infer<typeof passDtoSchema>;
export type AuthSessionDto = z.infer<typeof authSessionDtoSchema>;
export type RefreshResponseDto = z.infer<typeof refreshResponseDtoSchema>;
export type MeResponseDto = z.infer<typeof meResponseDtoSchema>;
export type LogoutResponseDtoZ = z.infer<typeof logoutResponseDtoSchema>;
export type ErrorResponseDto = z.infer<typeof errorResponseDtoSchema>;