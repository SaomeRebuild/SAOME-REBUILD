import { z } from 'zod';
import type { Env } from '@/shared/types/bindings';
import { getDb } from '@/shared/db/client';
import { createPassRequestSchema } from '../schemas/request';
import { passResponseSchema, passStatusResponseSchema } from '../schemas/response';
import { SaomeError } from '@/shared/lib/saomeError';
import { insertPass, getPassStatus, findPassByTenantId, advanceBillingCycle } from '../db/passes';

export interface CreatePassResult {
  pass: z.infer<typeof passResponseSchema>;
}

export async function createPassService(
  env: Env,
  request: { tenantId: string; plan: 'green' | 'gold' | 'platinum'; trialDays?: number }
): Promise<CreatePassResult> {
  const parsed = createPassRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new SaomeError({
      status: 400,
      code: 'VALIDATION_ERROR',
      i18nKey: 'common.error.validationFailed',
      message: 'Invalid pass creation request',
      details: { issues: parsed.error.issues },
    });
  }

  const db = getDb(env.HYPERDRIVE);
  
  // Check if tenant already has a pass
  const existing = await findPassByTenantId(db, parsed.data.tenantId);
  if (existing) {
    throw new SaomeError({
      status: 409,
      code: 'CONFLICT',
      i18nKey: 'common.error.conflict',
      message: 'Tenant already has a pass',
    });
  }

  const pass = await insertPass(db, {
    tenantId: parsed.data.tenantId,
    plan: parsed.data.plan,
    trialDays: parsed.data.trialDays,
  });

  return {
    pass: passResponseSchema.parse({
      id: pass.id,
      tenantId: pass.tenant_id,
      plan: pass.plan,
      trialDays: pass.trial_days,
      startDate: pass.start_date.toISOString(),
      endDate: pass.end_date.toISOString(),
      status: pass.status,
      createdAt: pass.created_at.toISOString(),
    }),
  };
}

export interface GetPassStatusResult {
  daysRemaining: number;
  status: 'active' | 'expired' | 'cancelled';
  endDate: string;
  paidAt: string | null;
  billingCycleEnd: string | null;
  phase: 'trial' | 'paid' | 'expired';
  needsRenewalNotice: boolean;
}

export async function getPassStatusService(
  env: Env,
  tenantId: string
): Promise<GetPassStatusResult> {
  const db = getDb(env.HYPERDRIVE);

  // Lazy update: advance billing cycle if needed (for paid users)
  await advanceBillingCycle(db, tenantId);

  const result = await getPassStatus(db, tenantId);

  if (!result) {
    throw new SaomeError({
      status: 404,
      code: 'NOT_FOUND',
      i18nKey: 'common.error.notFound',
      message: 'Pass not found for tenant',
    });
  }

  // Paid user within 7 days of expiry → needs renewal notice
  const needsRenewalNotice =
    result.phase === 'paid' && result.daysRemaining <= 7 && result.daysRemaining >= 0;

  return {
    daysRemaining: result.daysRemaining,
    status: result.status,
    endDate: result.endDate.toISOString(),
    paidAt: result.paidAt?.toISOString() ?? null,
    billingCycleEnd: result.billingCycleEnd?.toISOString() ?? null,
    phase: result.phase,
    needsRenewalNotice,
  };
}
