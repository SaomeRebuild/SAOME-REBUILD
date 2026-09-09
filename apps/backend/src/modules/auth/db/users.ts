/**
 * Users table queries.
 *
 * @module modules/auth/db/users
 * @description Pure SQL functions for the `users` table. NO business logic.
 */

import type { Sql } from '@/shared/db/client';
import type { TenantsRow } from './tenants';

export interface UsersRow {
  id: string;
  email: string;
  password_hash: string;
  role: 'tenant' | 'admin';
  is_active: boolean;
  created_at: Date;
}

export async function findUserByEmail(sql: Sql, email: string): Promise<UsersRow | undefined> {
  const rows = await sql<UsersRow[]>`
    SELECT id, email, password_hash, role, is_active, created_at
      FROM users
     WHERE LOWER(email) = LOWER(${email})
     LIMIT 1
  `;
  return rows[0];
}

export async function findUserById(sql: Sql, id: string): Promise<UsersRow | undefined> {
  const rows = await sql<UsersRow[]>`
    SELECT id, email, password_hash, role, is_active, created_at
      FROM users
     WHERE id = ${id}
     LIMIT 1
  `;
  return rows[0];
}

export async function insertUser(
  sql: Sql,
  params: { email: string; passwordHash: string; role?: 'tenant' | 'admin'; isActive?: boolean }
): Promise<UsersRow> {
  const role = params.role ?? 'tenant';
  const isActive = params.isActive ?? true;
  const rows = await sql<UsersRow[]>`
    INSERT INTO users (email, password_hash, role, is_active)
    VALUES (${params.email}, ${params.passwordHash}, ${role}, ${isActive})
    RETURNING id, email, password_hash, role, is_active, created_at
  `;
  if (!rows[0]) {
    throw new Error('insertUser returned no rows');
  }
  return rows[0];
}

/**
 * Combined user + tenant lookup by email.
 *
 * Phase 3.2 (2026-09-09): replaces `findUserByEmail` + `findTenantByOwnerId`
 * with a single LEFT JOIN round-trip. Used by loginService so the login
 * path issues one query instead of two.
 *
 * Returns `undefined` if no user matches; otherwise `{ user, tenant }`
 * where `tenant` is `null` for admin users (no tenant record).
 *
 * @see runs/decisions/2026-09-09-jwt-tenant-id-trust.md
 */
export interface UserAndTenantRow {
  user: UsersRow;
  tenant: TenantsRow | null;
}

export async function findUserAndTenantByEmail(
  sql: Sql,
  email: string
): Promise<UserAndTenantRow | undefined> {
  const rows = await sql<
    Array<{
      id: string;
      email: string;
      password_hash: string;
      role: 'tenant' | 'admin';
      is_active: boolean;
      created_at: Date;
      t_id: string | null;
      t_owner_user_id: string | null;
      t_name: string | null;
      t_contact_name: string | null;
      t_phone_city: string | null;
      t_address: string | null;
      t_tax_id: string | null;
      t_invoice_address: string | null;
      t_mobile: string | null;
      t_website: string | null;
      t_email: string | null;
      t_created_at: Date | null;
    }>
  >`
    SELECT
      u.id, u.email, u.password_hash, u.role, u.is_active, u.created_at,
      t.id            AS t_id,
      t.owner_user_id AS t_owner_user_id,
      t.name          AS t_name,
      t.contact_name  AS t_contact_name,
      t.phone_city    AS t_phone_city,
      t.address       AS t_address,
      t.tax_id        AS t_tax_id,
      t.invoice_address AS t_invoice_address,
      t.mobile        AS t_mobile,
      t.website       AS t_website,
      t.email         AS t_email,
      t.created_at    AS t_created_at
      FROM users u
      LEFT JOIN tenants t ON t.owner_user_id = u.id
     WHERE LOWER(u.email) = LOWER(${email})
     LIMIT 1
  `;
  const r = rows[0];
  if (!r) return undefined;
  const user: UsersRow = {
    id: r.id,
    email: r.email,
    password_hash: r.password_hash,
    role: r.role,
    is_active: r.is_active,
    created_at: r.created_at,
  };
  const tenant: TenantsRow | null = r.t_id
    ? {
        id: r.t_id,
        owner_user_id: r.t_owner_user_id ?? user.id,
        name: r.t_name ?? '',
        contact_name: r.t_contact_name ?? '',
        phone_city: r.t_phone_city,
        address: r.t_address ?? '',
        tax_id: r.t_tax_id ?? '',
        invoice_address: r.t_invoice_address,
        mobile: r.t_mobile ?? '',
        website: r.t_website,
        email: r.t_email ?? '',
        created_at: r.t_created_at ?? new Date(0),
      }
    : null;
  return { user, tenant };
}