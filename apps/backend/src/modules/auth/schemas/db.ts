/**
 * Internal DB row schemas for the auth module.
 *
 * @module modules/auth/schemas/db
 * @description Zod validators for the SQL row shapes (used by `db/*.ts`).
 * These are INTERNAL — never serialize these directly into HTTP responses.
 * For response DTOs, see `src/contracts/auth.ts`.
 *
 * Field names use snake_case (Postgres convention) here; converters in
 * services/ map to camelCase DTOs.
 */

import { z } from 'zod';

export const usersRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  password_hash: z.string(),
  role: z.enum(['tenant', 'admin']),
  is_active: z.boolean(),
  created_at: z.date(),
});

export type UsersRowSchema = z.infer<typeof usersRowSchema>;

export const tenantsRowSchema = z.object({
  id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  name: z.string(),
  contact_name: z.string(),
  phone_city: z.string(),
  address: z.string(),
  tax_id: z.string(),
  invoice_address: z.string().nullable(),
  mobile: z.string().nullable(),
  website: z.string().nullable(),
  email: z.string().email(),
  created_at: z.date(),
});

export type TenantsRowSchema = z.infer<typeof tenantsRowSchema>;

export const loginAttemptsRowSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.string().uuid().nullable(),
  email_attempted: z.string(),
  success: z.boolean(),
  attempted_at: z.date(),
});

export type LoginAttemptsRowSchema = z.infer<typeof loginAttemptsRowSchema>;