/**
 * Request zod schemas for the auth module.
 *
 * @module modules/auth/schemas/request
 * @description Mirrors `packages/shared/schemas/auth.ts`. Local copies live
 * under `src/shared/schemas/from-shared/` and are imported here.
 *
 * Once the from-shared/ files are cp'd at SAOME-11+, replace these stubs
 * with `export * from '@/shared/schemas/from-shared/auth';`.
 */

import { z } from 'zod';

/**
 * Body of POST /api/auth/register.
 * Combines `tenantInfo` (business info) + `accountInfo` (login creds).
 */
export const registrationPayloadSchema = z.object({
  tenantInfo: z.object({
    name: z.string().min(1),
    contactName: z.string().min(1),
    phoneCity: z.string().min(1),
    address: z.string().min(1),
    taxId: z.string(),
    invoiceAddress: z.string().optional().nullable(),
    mobile: z.string().optional().nullable(),
    website: z.string().url().optional().nullable(),
    email: z.string().email(),
  }),
  accountInfo: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  }).refine((d) => d.password === d.confirmPassword, {
    message: 'passwordsDoNotMatch',
    path: ['confirmPassword'],
  }),
});

export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;

/**
 * Body of POST /api/auth/login.
 */
export const loginCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;