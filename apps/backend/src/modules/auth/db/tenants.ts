/**
 * Tenants table queries.
 *
 * @module modules/auth/db/tenants
 * @description Pure SQL functions for the `tenants` table.
 */

import type { Sql } from '@/shared/db/client';

export interface TenantsRow {
  id: string;
  owner_user_id: string;
  name: string;
  contact_name: string;
  phone_city: string | null; // nullable — city phone is optional
  address: string;
  tax_id: string;
  invoice_address: string | null;
  mobile: string; // required — cell phone is mandatory
  website: string | null;
  email: string;
  created_at: Date;
}

export async function insertTenant(
  sql: Sql,
  params: {
    ownerUserId: string;
    name: string;
    contactName: string;
    phoneCity: string | null; // nullable
    address: string;
    taxId: string;
    invoiceAddress: string | null;
    mobile: string; // required
    website: string | null;
    email: string;
  }
): Promise<TenantsRow> {
  const rows = await sql<TenantsRow[]>`
    INSERT INTO tenants (
      owner_user_id, name, contact_name, phone_city, address,
      tax_id, invoice_address, mobile, website, email
    )
    VALUES (
      ${params.ownerUserId}, ${params.name}, ${params.contactName},
      ${params.phoneCity}, ${params.address}, ${params.taxId},
      ${params.invoiceAddress}, ${params.mobile}, ${params.website},
      ${params.email}
    )
    RETURNING id, owner_user_id, name, contact_name, phone_city, address,
              tax_id, invoice_address, mobile, website, email, created_at
  `;
  if (!rows[0]) {
    throw new Error('insertTenant returned no rows');
  }
  return rows[0];
}

export async function findTenantByOwnerId(sql: Sql, ownerUserId: string): Promise<TenantsRow | undefined> {
  const rows = await sql<TenantsRow[]>`
    SELECT id, owner_user_id, name, contact_name, phone_city, address,
           tax_id, invoice_address, mobile, website, email, created_at
      FROM tenants
     WHERE owner_user_id = ${ownerUserId}
     LIMIT 1
  `;
  return rows[0];
}

export async function findTenantByTaxId(sql: Sql, taxId: string): Promise<TenantsRow | undefined> {
  const rows = await sql<TenantsRow[]>`
    SELECT id, owner_user_id, name, contact_name, phone_city, address,
           tax_id, invoice_address, mobile, website, email, created_at
      FROM tenants
     WHERE tax_id = ${taxId}
     LIMIT 1
  `;
  return rows[0];
}