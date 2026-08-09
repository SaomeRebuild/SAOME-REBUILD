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
  paidAt: z.string().datetime().nullable().optional(),
  billingCycleEnd: z.string().datetime().nullable().optional(),
});

export type PassResponse = z.infer<typeof passResponseSchema>;

export const passStatusResponseSchema = z.object({
  daysRemaining: z.number().int(),
  status: z.enum(['active', 'expired', 'cancelled']),
  endDate: z.string().datetime(),
  paidAt: z.string().datetime().nullable(),
  billingCycleEnd: z.string().datetime().nullable(),
  phase: z.enum(['trial', 'paid', 'expired']),
  needsRenewalNotice: z.boolean().optional(), // true if paid + <= 7 days remaining
});

export type PassStatusResponse = z.infer<typeof passStatusResponseSchema>;

export const confirmPaymentResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  plan: z.enum(['green', 'gold', 'platinum']),
  paidAt: z.string().datetime().nullable(),
  billingCycleEnd: z.string().datetime().nullable(),
  status: z.enum(['active', 'expired', 'cancelled']),
});

export type ConfirmPaymentResponse = z.infer<typeof confirmPaymentResponseSchema>;
