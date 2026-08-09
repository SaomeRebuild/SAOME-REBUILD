import type { Sql } from '@/shared/db/client';

export interface PassRow {
  id: string;
  tenant_id: string;
  plan: 'green' | 'gold' | 'platinum';
  trial_days: number;
  start_date: Date;
  end_date: Date;
  status: 'active' | 'expired' | 'cancelled';
  created_at: Date;
  paid_at: Date | null;
  billing_cycle_end: Date | null;
}

export interface CreatePassParams {
  tenantId: string;
  plan: 'green' | 'gold' | 'platinum';
  trialDays?: number;
}

/**
 * Insert a new pass record for a tenant
 */
export async function insertPass(
  db: Sql,
  params: CreatePassParams
): Promise<PassRow> {
  const trialDays = params.trialDays ?? 14;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + trialDays * 24 * 60 * 60 * 1000);

  const [row] = await db`
    INSERT INTO public.passes (tenant_id, plan, trial_days, start_date, end_date, status)
    VALUES (${params.tenantId}, ${params.plan}, ${trialDays}, ${startDate}, ${endDate}, 'active')
    RETURNING *
  `;

  return row as PassRow;
}

/**
 * Find pass by tenant ID
 */
export async function findPassByTenantId(
  db: Sql,
  tenantId: string
): Promise<PassRow | null> {
  const [row] = await db`
    SELECT * FROM public.passes WHERE tenant_id = ${tenantId}
  `;

  return (row as PassRow | undefined) ?? null;
}

export type PassPhase = 'trial' | 'paid' | 'expired';

/**
 * Advance billing cycle by 30 days for paid users.
 * Only advances if current billing_cycle_end <= now().
 * Returns the new billing_cycle_end, or null if no update was needed.
 */
export async function advanceBillingCycle(
  db: Sql,
  tenantId: string
): Promise<Date | null> {
  const now = new Date();
  const [row] = await db`
    UPDATE public.passes
    SET billing_cycle_end = billing_cycle_end + interval '30 days'
    WHERE tenant_id = ${tenantId}
      AND paid_at IS NOT NULL
      AND billing_cycle_end IS NOT NULL
      AND billing_cycle_end <= ${now}
    RETURNING billing_cycle_end
  `;
  return row ? (row.billing_cycle_end as Date) : null;
}

/**
 * Set paid_at and initial billing_cycle_end.
 * Called by /api/passes/confirm-payment after successful payment.
 */
export async function setPaidAt(
  db: Sql,
  tenantId: string,
  paidAt: Date = new Date()
): Promise<PassRow | null> {
  const billingCycleEnd = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [row] = await db`
    UPDATE public.passes
    SET
      paid_at = ${paidAt},
      billing_cycle_end = ${billingCycleEnd},
      status = 'active'
    WHERE tenant_id = ${tenantId}
    RETURNING *
  `;
  return (row as PassRow) ?? null;
}

/**
 * Get pass status with calculated days remaining and phase
 */
export async function getPassStatus(
  db: Sql,
  tenantId: string
): Promise<{
  plan: string;
  daysRemaining: number;
  status: 'active' | 'expired' | 'cancelled';
  endDate: Date;
  phase: PassPhase;
  paidAt: Date | null;
  billingCycleEnd: Date | null;
} | null> {
  const pass = await findPassByTenantId(db, tenantId);
  if (!pass) return null;

  const now = new Date();
  // paid user → billing_cycle_end; trial user → end_date
  const targetDate = pass.paid_at ? pass.billing_cycle_end : pass.end_date;
  const diffMs = (targetDate?.getTime() ?? now.getTime()) - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

  let phase: PassPhase;
  if (pass.paid_at) phase = 'paid';
  else if (daysRemaining > 0) phase = 'trial';
  else phase = 'expired';

  // Auto-update expired trial
  if (!pass.paid_at && daysRemaining === 0 && pass.status === 'active') {
    await db`
      UPDATE public.passes
      SET status = 'expired'
      WHERE id = ${pass.id}
    `;
    return {
      plan: pass.plan,
      daysRemaining: 0,
      status: 'expired',
      endDate: pass.end_date,
      phase: 'expired',
      paidAt: null,
      billingCycleEnd: null,
    };
  }

  return {
    plan: pass.plan,
    daysRemaining,
    status: pass.status,
    endDate: targetDate ?? pass.end_date,
    phase,
    paidAt: pass.paid_at,
    billingCycleEnd: pass.billing_cycle_end,
  };
}
