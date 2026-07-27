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
  email: z.string().email(),
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

export const errorResponseDtoSchema = z.object({
  error: z.object({
    code: z.string(),
    i18nKey: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  requestId: z.string(),
});

export type AuthSessionDto = z.infer<typeof authSessionDtoSchema>;
export type RefreshResponseDto = z.infer<typeof refreshResponseDtoSchema>;
export type MeResponseDto = z.infer<typeof meResponseDtoSchema>;
export type ErrorResponseDto = z.infer<typeof errorResponseDtoSchema>;