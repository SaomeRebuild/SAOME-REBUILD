/**
 * Warmup cron route — keeps Hyperdrive connection pool warm.
 *
 * @module modules/health/routes/warmupCron
 *
 * The `saome-backend` Worker connects to Supabase Postgres through
 * Cloudflare Hyperdrive. Hyperdrive's idle connection timeout can sever the
 * pooled connection if the Worker sits idle for >60s. When the next request
 * comes in (a real user login / card save), the first attempt then hits a
 * `Error: Hyperdrive connection error` which manifests to the user as a
 * transient 503 from the API.
 *
 * Mitigation: trigger a tiny request every 5 minutes via Cloudflare Cron
 * Triggers. The route does an internal fetch to the backend's own `/health`
 * endpoint, which exercises the Hyperdrive pool without doing any DB work
 * (since `/health` doesn't touch the DB).
 *
 * Cron binding lives in `wrangler.jsonc` under `triggers.crons`. In dev,
 * `wrangler dev --test-scheduled` lets you trigger the cron manually.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

export const warmupCronRoute = new Hono<HonoEnv>();

warmupCronRoute.get('/', async (c) => {
  // Phase 3.4 (2026-09-05): SAOME_BACKEND_URL is now asserted, not optional-fallback.
  // wrangler.jsonc vars.SAOME_BACKEND_URL must be set. If unset (e.g. old
  // deploy before this fix), the cron logs a warning and still executes with
  // the hard-coded fallback so the pool stays warm rather than hard-failing.
  const baseUrl = c.env.SAOME_BACKEND_URL;
  if (!baseUrl) {
    console.warn(
      '[warmupCron] SAOME_BACKEND_URL not set in env — using hard-coded fallback. ' +
      'Set vars.SAOME_BACKEND_URL in wrangler.jsonc to silence this warning.',
    );
  }
  const targetUrl = baseUrl ?? 'https://saome-backend.josh1989213.workers.dev';

  const startedAt = Date.now();
  let upstreamStatus: number | null = null;
  let upstreamError: string | null = null;

  try {
    const res = await fetch(`${targetUrl}/health`, {
      method: 'GET',
      // Cloudflare Workers → Workers loopback is cheap; no need for auth
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    upstreamStatus = res.status;
  } catch (err) {
    upstreamError = err instanceof Error ? err.message : String(err);
  }

  return c.json({
    cron: 'warmup',
    executedAt: new Date().toISOString(),
    upstreamStatus,
    upstreamError,
    durationMs: Date.now() - startedAt,
  });
});

export default warmupCronRoute;
