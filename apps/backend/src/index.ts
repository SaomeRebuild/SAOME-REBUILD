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
import { authModule } from '@/modules/auth';
import { passModule } from '@/modules/pass';
import { billingCycleCronRoute } from '@/modules/pass/routes/billingCycleCron';
import { cardsModule } from '@/modules/cards';
import { healthModule } from '@/modules/health';

/**
 * Default export — Worker entry point.
 * Cloudflare runtime invokes this on every HTTP request.
 */
const app = new Hono<HonoEnv>();

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

export default app;