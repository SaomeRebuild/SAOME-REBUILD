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
};

export default worker;