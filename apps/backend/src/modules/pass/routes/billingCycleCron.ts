import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import type { Env } from '@/shared/types/bindings';

/**
 * GET /api/cron/billing-cycle
 * Cron job entry point. Advances billing cycles for all paid users
 * whose billing_cycle_end <= now().
 * Cloudflare Cron triggers this daily.
 */
export const billingCycleCronRoute = new Hono<HonoEnv>();

billingCycleCronRoute.get('/', async (c) => {
  const db = getDb(c.env.HYPERDRIVE);
  const now = new Date();

  // Advance billing cycles for all eligible paid users
  const result = await db`
    UPDATE public.passes
    SET billing_cycle_end = billing_cycle_end + interval '30 days'
    WHERE paid_at IS NOT NULL
      AND billing_cycle_end IS NOT NULL
      AND billing_cycle_end <= ${now}
    RETURNING id, tenant_id, billing_cycle_end
  `;

  const updatedCount = result.length;

  // Also expire trial users whose end_date has passed
  const expiredResult = await db`
    UPDATE public.passes
    SET status = 'expired'
    WHERE paid_at IS NULL
      AND status = 'active'
      AND end_date <= ${now}
    RETURNING id
  `;

  return c.json({
    cron: 'billing-cycle',
    executedAt: now.toISOString(),
    updatedBillingCycles: updatedCount,
    expiredTrials: expiredResult.length,
  });
});
