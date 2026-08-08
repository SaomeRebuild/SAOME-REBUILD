import { z } from 'zod';

export const createPassRequestSchema = z.object({
  tenantId: z.string().uuid(),
  plan: z.enum(['green', 'gold', 'platinum']),
  trialDays: z.number().int().positive().optional().default(14),
});

export type CreatePassRequest = z.infer<typeof createPassRequestSchema>;
