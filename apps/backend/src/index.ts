/**
 * saome-backend — Hono Worker entry point.
 *
 * @file src/index.ts
 * @description Composes the global middleware stack and mounts feature
 * modules. This is the ONLY file the runtime invokes (per wrangler.jsonc
 * `"main": "src/index.ts"`).
 *
 * Layer:
 *   1. cors — Access-Control-Allow-* headers + OPTIONS preflight
 *   2. requestId — attach X-Request-Id to context + response
 *   3. onError — convert SaomeError / unknown to JSON ErrorResponseDto
 *
 * Modules:
 *   - /api/auth  → authModule (register / login / refresh / me)
 *   - /api/pass  → passModule (subscription management)
 *   - /api/cards → cardsModule (card builder templates)
 *
 * Health check:
 *   - GET /health → { ok: true } (no DB, no auth)
 *
 * Convention: this file does NOT contain business logic. To add a new
 * endpoint, edit the relevant module under src/modules/.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { corsMiddleware } from '@/shared/middleware/cors';
import { requestIdMiddleware } from '@/shared/middleware/requestId';
import { errorHandler } from '@/shared/middleware/errorHandler';
import { ensureCorsOnResponse } from '@/shared/middleware/runtimeCors';
import { authModule } from '@/modules/auth';
import { passModule } from '@/modules/pass';
import { billingCycleCronRoute } from '@/modules/pass/routes/billingCycleCron';
import { cardsModule } from '@/modules/cards';
import { healthModule } from '@/modules/health';
import { getDb } from '@/shared/db/client';

/**
 * Composed Hono app — handles all in-Worker requests via the standard
 * middleware chain (cors → requestId → onError → route).
 *
 * Exported for unit tests that exercise the Hono surface directly
 * (`app.request(...)` in `corsMiddleware.test.ts` and friends).
 */
export const app = new Hono<HonoEnv>();

// Global middleware stack (order matters)
app.use('*', corsMiddleware);
app.use('*', requestIdMiddleware);

// Error handler
app.onError(errorHandler);

// Health check (no auth, no DB)
app.get('/health', (c) => c.json({ ok: true }));

// Feature modules
app.route('/api/auth', authModule);
app.route('/api/pass', passModule);
app.route('/api/cron/billing-cycle', billingCycleCronRoute);
app.route('/api/cron', healthModule);
app.route('/api/cards', cardsModule);

/**
 * Default export — Worker entry point.
 *
 * Cloudflare runtime invokes this on every HTTP request. We wrap the Hono
 * app in a defensive `fetch` handler so that ANY response — including
 * Worker-runtime-emitted ones (e.g., when bindings fail before our code
 * runs) — carries CORS headers for known production origins. Without this
 * wrapper, a runtime-level 503 hits the browser without CORS headers and
 * is silently dropped (Bug: production CORS drop, 2026-09-06).
 *
 * The CORS injection itself lives in `shared/middleware/runtimeCors.ts`
 * (separated so it can be unit-tested without pulling in the full app
 * graph).
 */
const worker: ExportedHandler<HonoEnv['Bindings']> = {
  async fetch(request, env, ctx) {
    try {
      const res = await app.fetch(request, env, ctx);
      return ensureCorsOnResponse(request, res);
    } catch (err) {
      // Top-level safety net. Hono's `app.onError(errorHandler)` already
      // converts SaomeError / unknown to a JSON response with CORS
      // headers, so reaching this catch means something escaped Hono
      // entirely (e.g., a module-level throw, a binding resolution
      // failure before the route handler ran, or Cloudflare's runtime
      // emitting a 503 because of CPU/memory limits).
      console.error('[worker.fetch] uncaught error:', err);
      const fallback = new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'Internal server error',
          },
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      );
      return ensureCorsOnResponse(request, fallback);
    }
  },

  /**
   * Cloudflare Cron Trigger handler — fires per `wrangler.jsonc::triggers.crons`.
   *
   * ROOT CAUSE FIX (2026-09-09): before this commit, wrangler.jsonc
   * declared `triggers.crons` but the Worker had NO `scheduled` handler.
   * Cloudflare fired the cron every 5 minutes into the void, the Worker
   * isolate stayed subject to Cloudflare's normal idle-eviction policy,
   * and after 15-30 minutes of idle time the next real user request
   * triggered a cold start. For a ~450 KB Worker bundle, cold start can
   * exceed Cloudflare's internal 503 threshold, producing a runtime-emitted
   * 503 that has no CORS header → browser silent drop → user sees
   * "Network error" (the recurring 503+CORS symptom this whole week).
   *
   * Two-purpose cron (keep-alive + scheduled business work):
   *   1. HTTP layer keep-alive: internal `fetch('/health')` exercises the
   *      full Hono pipeline (corsMiddleware → requestId → handler → CORS
   *      wrap-after-next) so an idle Worker stays warm AND any Layer 1
   *      regression surfaces in cron logs (not user-facing failures).
   *   2. Hyperdrive keep-alive: `SELECT 1` pings the connection pool so
   *      Hyperdrive's >60s idle disconnect doesn't bite the next real
   *      user request (the original motivation for `warmupCron.ts`, which
   *      was incorrectly mounted as an HTTP route).
   *   3. Billing cycle: every cron tick, advance billing cycles whose
   *      `billing_cycle_end <= now()`. The original `billingCycleCronRoute`
   *      was also mounted as an HTTP route — its intent was to be invoked
   *      by THIS handler, but the wiring was never completed.
   *
   * Errors are swallowed with `console.warn` so a transient blip doesn't
   * crash the cron. Production observability (`wrangler tail`) will still
   * surface the warning.
   *
   * Frequency tuning: wrangler.jsonc triggers.crons is now every-2-minutes
   * (every 2 minutes) — short enough to survive Cloudflare's idle eviction
   * window, long enough to not waste CPU/DB cycles.
   */
  async scheduled(event, env, ctx) {
    const cronName = event.cron;
    const startedAt = Date.now();

    // Purpose 1: HTTP layer keep-alive (warm the Hono pipeline)
    try {
      const res = await fetch(`${env.SAOME_BACKEND_URL}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      });
      console.log(`[scheduled] cron=${cronName} http-warmup status=${res.status} durationMs=${Date.now() - startedAt}`);
    } catch (err) {
      console.warn(`[scheduled] cron=${cronName} http-warmup FAILED:`, err instanceof Error ? err.message : String(err));
    }

    // Purpose 2: Hyperdrive keep-alive (`SELECT 1` — forces a fresh pooled
    // connection if the old one was evicted, and prevents Hyperdrive's
    // >60s idle disconnect from biting the next user request).
    try {
      const sql = await getDb(env.HYPERDRIVE);
      const [{ ok }] = await sql<{ ok: number }[]>`SELECT 1 AS ok`;
      console.log(`[scheduled] cron=${cronName} hyperdrive-keepalive ok=${ok}`);
    } catch (err) {
      console.warn(`[scheduled] cron=${cronName} hyperdrive-keepalive FAILED:`, err instanceof Error ? err.message : String(err));
    }

    // Purpose 3: billing cycle advancement (was previously mounted as an
    // unused HTTP route at /api/cron/billing-cycle — now invoked by the
    // cron handler every tick. Idempotent: rows whose end_date <= now()
    // are updated once, and the route returns the count).
    try {
      const res = await fetch(`${env.SAOME_BACKEND_URL}/api/cron/billing-cycle`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
      const body = await res.json().catch(() => ({}));
      console.log(`[scheduled] cron=${cronName} billing-cycle status=${res.status} body=${JSON.stringify(body)}`);
    } catch (err) {
      console.warn(`[scheduled] cron=${cronName} billing-cycle FAILED:`, err instanceof Error ? err.message : String(err));
    }
  },
};

export default worker;