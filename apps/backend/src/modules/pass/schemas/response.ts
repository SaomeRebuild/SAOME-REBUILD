import { z } from 'zod';

export const passResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  plan: z.enum(['green', 'gold', 'platinum']),
  trialDays: z.number().int(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.enum(['active', 'expired', 'cancelled']),
  createdAt: z.string().datetime(),
});

export type PassResponse = z.infer<typeof passResponseSchema>;

export const passStatusResponseSchema = z.object({
  daysRemaining: z.number().int(),
  status: z.enum(['active', 'expired', 'cancelled']),
  endDate: z.string().datetime(),
});

export type PassStatusResponse = z.infer<typeof passStatusResponseSchema>;
