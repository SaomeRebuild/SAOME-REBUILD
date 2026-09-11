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
import type { Context } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

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

// =============================================================================
// Phase 3.2 — SQL call counter (Hyperdrive query spike observability)
// =============================================================================
//
// Attached to per-request Sql instances returned by `getDbForRequest`. The
// counter is incremented every time the Sql tag is invoked (including nested
// sub-template fragments and `sql.json()`). The `sqlCountMiddleware`
// reads the counter after the handler completes and emits a structured
// `[sql-count] route=METHOD path queries=N status=S` log line for
// Cloudflare tail / Dashboard aggregation.
//
// Bare `getDb()` instances (no per-request wrapping) BYPASS this counter —
// that's intentional for the cron handler and services that take `env`
// directly. The cron handler has its own structured log pattern.

/** Per-instance query counter (WeakMap so a dead Sql is GC'd). */
const _queryCounters = new WeakMap<object, number>();

/** Tag a Sql instance with a counter, return the same Sql. */
function withCounter(sql: Sql): Sql {
  _queryCounters.set(sql, 0);
  return sql;
}

/** Increment the counter for an Sql instance (idempotent on first call). */
function incrementCounter(sql: object): void {
  _queryCounters.set(sql, (_queryCounters.get(sql) ?? 0) + 1);
}

/**
 * Read the current query count for a Sql instance.
 * Returns 0 if the Sql was never tagged (e.g. bare `getDb()` outside
 * `getDbForRequest`).
 */
export function getQueryCount(sql: object): number {
  return _queryCounters.get(sql) ?? 0;
}

/**
 * Wrap a Sql instance with a Proxy that increments the counter on every
 * tagged-template invocation AND on `sql.json(...)`. The Proxy is
 * transparent to callers — postgres.js internals (thenables, chainable
 * methods like `.begin`, `.unsafe`) all work unchanged.
 *
 * Note: we wrap AFTER `setTestSql` injection so the mock bypasses the
 * counter (mock-driven tests don't contribute to production metrics).
 */
function attachQueryCounter(sql: Sql): Sql {
  const counterSql = new Proxy(sql, {
    apply(target, _thisArg, args) {
      // Tagged template invocation: sql`SELECT ...`
      incrementCounter(target);
      return Reflect.apply(target, _thisArg, args);
    },
    get(target, prop, receiver) {
      // Intercept sql.json(value) — also a wire query
      if (prop === 'json') {
        return (value: unknown) => {
          incrementCounter(target);
          return (target as unknown as { json: (v: unknown) => unknown }).json(value);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as Sql;
  return counterSql;
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

/**
 * Per-request memoization wrapper around `getDb`.
 *
 * Within a single request, multiple calls return the SAME sql instance
 * (no second pool creation, no second warmup `SELECT 1`). Across requests,
 * each call gets a fresh instance — required by Cloudflare Workers I/O
 * isolation rules (a pool from request A must NEVER be reused in request B).
 *
 * The returned Sql is wrapped with a Proxy that increments a per-instance
 * query counter (Phase 3.2). The `sqlCountMiddleware` reads the counter
 * after the handler completes and emits a `[sql-count]` structured log
 * line for Cloudflare tail / Dashboard aggregation.
 *
 * Usage:
 *   const sql = await getDbForRequest(c);   // preferred inside Hono handlers
 *
 * @see runs/decisions/2026-09-09-jwt-tenant-id-trust.md
 */
export async function getDbForRequest(
  c: Pick<Context<HonoEnv>, 'get' | 'set'> & { env: HonoEnv['Variables'] extends never ? never : { HYPERDRIVE: { connectionString: string } } }
): Promise<Sql> {
  const cached = c.get('db') as Sql | undefined;
  if (cached) return cached;
  const sql = withCounter(await getDb(c.env.HYPERDRIVE));
  c.set('db', sql as never);
  // Wrap with the query-counter Proxy after caching. This ensures the
  // counter is attached to the SAME Sql object that downstream code
  // receives (the Proxy is transparent — `sql\`SELECT ...\`` still
  // resolves through to postgres.js).
  return attachQueryCounter(sql);
}
