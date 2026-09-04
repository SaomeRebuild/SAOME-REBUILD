import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { z } from 'zod';
import { setPaidAt } from '../db/passes';
import { getDb } from '@/shared/db/client';
import type { Env } from '@/shared/types/bindings';
import { SaomeError } from '@/shared/lib/saomeError';
import { confirmPaymentResponseSchema } from '../schemas/response';

const confirmPaymentRequestSchema = z.object({
  tenantId: z.string().uuid(),
});

export const confirmPaymentRoute = new Hono<HonoEnv>();

/**
 * POST /api/passes/confirm-payment
 * Called by frontend after LINE Pay payment succeeds.
 * Sets paid_at and initial billing_cycle_end.
 */
confirmPaymentRoute.post('/', async (c) => {
  const body = confirmPaymentRequestSchema.parse(await c.req.json());
  const db = await getDb(c.env.HYPERDRIVE);

  const pass = await setPaidAt(db, body.tenantId);
  if (!pass) {
    throw new SaomeError({
      status: 404,
      code: 'NOT_FOUND',
      i18nKey: 'common.error.notFound',
      message: 'Pass not found for tenant',
    });
  }

  return c.json(confirmPaymentResponseSchema.parse({
    id: pass.id,
    tenantId: pass.tenant_id,
    plan: pass.plan,
    paidAt: pass.paid_at?.toISOString() ?? null,
    billingCycleEnd: pass.billing_cycle_end?.toISOString() ?? null,
    status: pass.status,
  }), 201);
});
