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
 * Combined registration payload sent to the backend (flat structure, NOT nested).
 *
 * Mirrors the frontend's `RegistrationPayload` type from packages/shared/schemas/auth.
 * The frontend sends tenant fields + account fields at the top level (flat),
 * not as `{ tenantInfo, accountInfo }`.
 */

/**
 * Tax ID: accepts literal "0" (個人戶/工作室) or 8 numeric digits.
 * Zod message must be the i18n key that frontend looks up.
 */
const taxIdSchema = z
  .string()
  .refine((v) => v === '0', { message: 'validation.taxIdInvalid' })
  .or(z.string().regex(/^\d{8}$/, { message: 'validation.taxIdInvalid' }));

export const registrationPayloadSchema = z.object({
  // tenantInfo fields (required)
  name: z.string().min(1, 'validation.required'),
  contactName: z.string().min(1, 'validation.required'),
  phoneCity: z.string().min(1, 'validation.required'),
  address: z.string().min(1, 'validation.required'),
  taxId: taxIdSchema,
  // invoiceAddress is optional in tenantInfo but required in the combined payload
  invoiceAddress: z.string().min(1, 'validation.required'),
  // optional tenantInfo fields
  mobile: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  // accountInfo fields (confirmPassword is omitted — frontend doesn't send it)
  email: z.string().email('validation.email'),
  password: z.string().min(8, 'validation.passwordTooShort'),
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