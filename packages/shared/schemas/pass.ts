/**
 * Pass Schemas
 * 
 * @module shared/schemas/pass
 */

import { z } from 'zod';

export const passTierSchema = z.enum(['basic', 'premium', 'enterprise']);
export type PassTier = z.infer<typeof passTierSchema>;

export const passStatusSchema = z.enum(['active', 'expired', 'cancelled']);
export type PassStatus = z.infer<typeof passStatusSchema>;

export const createPassSchema = z.object({
  memberId: z.string(),
  tier: passTierSchema,
  durationDays: z.number().int().positive(),
});

export type CreatePassInput = z.infer<typeof createPassSchema>;
