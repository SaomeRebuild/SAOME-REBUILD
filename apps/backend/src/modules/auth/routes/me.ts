/**
 * GET /api/auth/me
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { requireAuth, getAuthenticatedUser } from '@/shared/middleware/auth';
import { getDb } from '@/shared/db/client';
import { findTenantByOwnerId } from '../db/tenants';

export const meRoute = new Hono<HonoEnv>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const user = getAuthenticatedUser(c);
    const sql = getDb(c.env.HYPERDRIVE);
    const tenant = await findTenantByOwnerId(sql, user.id);
    return c.json({
      user,
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            contactName: tenant.contact_name,
            phoneCity: tenant.phone_city,
            address: tenant.address,
            taxId: tenant.tax_id,
            invoiceAddress: tenant.invoice_address,
            mobile: tenant.mobile,
            website: tenant.website,
            email: tenant.email,
          }
        : null,
    });
  });

export default meRoute;