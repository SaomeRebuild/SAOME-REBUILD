/**
 * Postgres.js client bound to Hyperdrive.
 *
 * @module shared/db/client
 * @description Single entry point for ALL database access in saome-backend.
 *
 * Why this layer exists:
 *   - Centralizes the Hyperdrive binding unwrap (`connectionString`)
 *   - Creates a fresh pool per request to avoid Cloudflare Workers I/O isolation
 *     violations that occur when sharing pool objects via globalThis across requests
 *   - Provides a single seam to mock in vitest (`getDb(env)` is the only public API)
 *
 * Workers I/O isolation note:
 *   Workers do not support sharing I/O objects (sockets, streams, Response bodies)
 *   across concurrent request handlers. A pool created in one request's context
 *   must NOT be used in another request. Each getDb() call creates a fresh pool.
 *
 * Usage in modules:
 *   import { getDb } from '@/shared/db/client';
 *   const sql = await getDb(c.env.HYPERDRIVE);  // ← MUST AWAIT
 *   const user = await sql<UserRow>`SELECT * FROM users WHERE id = ${id}`;
 *
 * Vitest mocking:
 *   vi.mock('@/shared/db/client', () => ({
 *     getDb: vi.fn().mockResolvedValue(mockSql),
 *   }));
 */

import postgres from 'postgres';

/**
 * Postgres.js client type — the SQL template literal tag.
 * Use `sql\`...\`` to run parameterized queries.
 */
export type Sql = ReturnType<typeof postgres>;

// Vitest: override getDb with a mock Sql via this module-level variable.
let _testSql: Sql | undefined;

/**
 * Set the mock Sql for vitest.
 * Tests call this in beforeEach / vi.mock setup.
 */
export function setTestSql(sql: Sql): void {
  _testSql = sql;
}

/**
 * Get a Postgres.js client bound to the given Hyperdrive instance.
 *
 * Creates a FRESH pool per call (no global cache) to satisfy Cloudflare
 * Workers I/O isolation requirements. Each request gets its own pool.
 *
 * On first call per request, this issues an eager warmup ping (SELECT 1) to
 * force the TCP handshake before any business logic runs. This eliminates the
 * cold-start "first query fails in ~27ms" pattern where postgres.js deferred
 * the handshake to the first real query and it raced the request context.
 *
 * @param hyperdrive - The Hyperdrive binding from `env.HYPERDRIVE`
 * @returns A `sql` template literal tag, guaranteed to have an open connection
 */
export async function getDb(hyperdrive: { connectionString: string }): Promise<Sql> {
  // Vitest: return the injected mock sql.
  if (_testSql) return _testSql;

  const connStr = hyperdrive.connectionString;
  if (!connStr) {
    throw new Error('[getDb] Hyperdrive connectionString is empty — still initializing?');
  }

  const sql = postgres(connStr, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // Eager warmup: force the TCP handshake before returning the sql instance.
  // This adds ~200-500ms to the first request but prevents cold-start 500s
  // where postgres.js deferred the handshake to the first real query.
  try {
    await sql.unsafe('SELECT 1');
    console.log('[getDb] pool warmup OK');
  } catch (err) {
    console.error('[getDb] pool warmup FAILED:', err);
    throw err;
  }

  return sql;
}
