/**
 * Pass Schemas
 * 
 * @module shared/schemas/pass
 */

import { z } from 'zod';

/**
 * Pass Plan enum — mirrors passes.plan CHECK constraint in DB
 * Values: 'green' | 'gold' | 'platinum'
 */
export const passTierSchema = z.enum(['green', 'gold', 'platinum']);
export type PassTier = z.infer<typeof passTierSchema>;

export const passStatusSchema = z.enum(['active', 'expired', 'cancelled']);
export type PassStatus = z.infer<typeof passStatusSchema>;

export const createPassSchema = z.object({
  memberId: z.string(),
  tier: passTierSchema,
  durationDays: z.number().int().positive(),
});

export type CreatePassInput = z.infer<typeof createPassSchema>;
