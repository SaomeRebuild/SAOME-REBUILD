/**
 * Login attempts table queries.
 *
 * @module modules/auth/db/loginAttempts
 */

import type { Sql } from '@/shared/db/client';

export interface LoginAttemptsRow {
  id: number;
  user_id: string | null;
  email_attempted: string;
  success: boolean;
  attempted_at: Date;
}

export async function insertLoginAttempt(
  sql: Sql,
  params: { userId: string | null; emailAttempted: string; success: boolean }
): Promise<LoginAttemptsRow> {
  const rows = await sql<LoginAttemptsRow[]>`
    INSERT INTO login_attempts (user_id, email_attempted, success)
    VALUES (${params.userId}, ${params.emailAttempted}, ${params.success})
    RETURNING id, user_id, email_attempted, success, attempted_at
  `;
  if (!rows[0]) {
    throw new Error('insertLoginAttempt returned no rows');
  }
  return rows[0];
}

export async function countRecentFailures(
  sql: Sql,
  email: string,
  windowSeconds: number
): Promise<number> {
  const rows = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
      FROM login_attempts
     WHERE LOWER(email_attempted) = LOWER(${email})
       AND success = false
       AND attempted_at > now() - make_interval(secs => ${windowSeconds})
  `;
  return rows[0]?.count ?? 0;
}