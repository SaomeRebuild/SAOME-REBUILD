/**
 * Postgres.js client bound to Hyperdrive.
 *
 * @module shared/db/client
 * @description Single entry point for ALL database access in saome-backend.
 *
 * Why this layer exists:
 *   - Centralizes the Hyperdrive binding unwrap (`connectionString`)
 *   - Ensures every module uses the SAME pool
 *   - Provides a single seam to mock in vitest (`getDb(env)` is the only public API)
 *
 * Usage in modules:
 *   import { getDb } from '@/shared/db/client';
 *   const sql = getDb(c.env.HYPERDRIVE);
 *   const user = await sql<UserRow>`SELECT * FROM users WHERE id = ${id}`;
 *
 * Vitest mocking:
 *   vi.mock('@/shared/db/client', () => ({
 *     getDb: vi.fn().mockReturnValue(mockSql),
 *   }));
 */

import postgres from 'postgres';

/**
 * Postgres.js client type — the SQL template literal tag.
 * Use `sql\`...\`` to run parameterized queries.
 */
export type Sql = ReturnType<typeof postgres>;

/**
 * Get a Postgres.js client bound to the given Hyperdrive instance.
 *
 * Hyperdrive provides a `connectionString` that wraps the underlying
 * Postgres pool. In production, this string looks like:
 *   postgres://...@...hyperdrive-pool:5432/postgres
 *
 * @param hyperdrive - The Hyperdrive binding from `env.HYPERDRIVE`
 * @returns A `sql` template literal tag for running parameterized queries
 */
export function getDb(hyperdrive: { connectionString: string }): Sql {
  return postgres(hyperdrive.connectionString, {
    // Disable prepare statements; Hyperdrive uses prepared statements at the
    // edge so we don't need them in postgres.js.
    prepare: false,
    // Hyperdrive caps concurrent connections; let postgres.js queue.
    max: 10,
    // Workerd-friendly: keep idle connections short.
    idle_timeout: 20,
  });
}