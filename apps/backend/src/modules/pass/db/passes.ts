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

/**
 * Get pass status with calculated days remaining
 */
export async function getPassStatus(
  db: Sql,
  tenantId: string
): Promise<{ plan: string; daysRemaining: number; status: 'active' | 'expired' | 'cancelled'; endDate: Date } | null> {
  const pass = await findPassByTenantId(db, tenantId);
  if (!pass) return null;

  const now = new Date();
  const endDate = new Date(pass.end_date);
  const diffMs = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

  // Auto-update status if expired
  if (daysRemaining === 0 && pass.status === 'active') {
    await db`
      UPDATE public.passes
      SET status = 'expired'
      WHERE id = ${pass.id}
    `;
    return { plan: pass.plan, daysRemaining: 0, status: 'expired', endDate };
  }

  return { plan: pass.plan, daysRemaining, status: pass.status, endDate };
}
