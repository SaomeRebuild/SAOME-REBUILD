/**
 * Users table queries.
 *
 * @module modules/auth/db/users
 * @description Pure SQL functions for the `users` table. NO business logic.
 */

import type { Sql } from '@/shared/db/client';

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