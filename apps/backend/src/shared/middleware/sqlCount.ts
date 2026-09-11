/**
 * SQL count middleware — Phase 3 of Hyperdrive 87% Query Spike Fix.
 *
 * @module shared/middleware/sqlCount
 * @description Emits a structured `[sql-count]` log line after every
 * authenticated request, reporting the total `sql\`...\`` tag invocations
 * (including warmup SELECT 1, business queries, json helpers, sub-template
 * fragments) so Cloudflare tail + Dashboard can aggregate daily counts.
 *
 * Why: in September 2026 Hyperdrive Free plan = 100,000 queries/day, and
 * the saome-backend was averaging 87,000/day (87% of quota) — driven by
 * a stack of multipliers (#1: findTenantById per route, #2: redundant
 * `getDb()` warmup in middleware + handler). After Phase 1.1 + 1.2 the
 * per-route count dropped ~44%; this middleware makes the residual count
 * VISIBLE so future refactors can spot regressions in tail logs without
 * re-running the diagnostic.
 *
 * The counter is attached to the per-request Sql instance via
 * `shared/db/client.ts::getDbForRequest` (Phase 3.2). Bare `getDb()`
 * instances (e.g. the scheduled cron handler, services that take `env`
 * directly) BYPASS this middleware — that's fine because cron uses a
 * known fixed pattern (already logged separately).
 *
 * @example Output (visible in `wrangler tail saome-backend --format pretty`):
 *   [sql-count] route=POST /api/cards queries=2 status=201
 *   [sql-count] route=GET /api/cards/:id/image/logo queries=2 status=200
 *   [sql-count] route=POST /api/auth/refresh queries=3 status=200
 *
 * @see runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md
 *      § 9 follow-up: [sql-count] structured log section
 */

import type { MiddlewareHandler } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getQueryCount } from '@/shared/db/client';

/**
 * Tracks `sql\`...\`` call count on the per-request Sql instance and logs
 * `[sql-count] route=METHOD path queries=N status=S` after `next()` completes.
 *
 * Mount AFTER `requestIdMiddleware` so the structured log carries the
 * request id (set by requestId). Mount AFTER `corsMiddleware` so a
 * preflight OPTIONS that short-circuits the chain still gets the log.
 *
 * Skip conditions:
 *   - Sql not found in context (no `getDbForRequest` call was made —
 *     typical for /health, /api/cron/*, scheduled handler)
 *   - The route was a CORS preflight OPTIONS (Cloudflare logs those
 *     separately; double-logging wastes quota)
 */
export const sqlCountMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  await next();

  // Skip CORS preflight — they never reach the handler chain anyway,
  // but the cron preflight does, and we'd rather count the real request.
  if (c.req.method === 'OPTIONS') return;

  const sql = c.get('db');
  if (!sql) {
    // No DB call was made for this request (e.g. /health). Still log a
    // zero-count line so dashboard aggregation shows all routes.
    console.log(
      `[sql-count] route=${c.req.method} ${c.req.path} queries=0 status=${c.res.status}`,
    );
    return;
  }

  const queries = getQueryCount(sql);
  console.log(
    `[sql-count] route=${c.req.method} ${c.req.path} queries=${queries} status=${c.res.status}`,
  );
};
