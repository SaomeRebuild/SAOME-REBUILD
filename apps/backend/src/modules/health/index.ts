/**
 * Health feature module — currently just exposes the warmup cron route.
 *
 * @module modules/health
 * @description Houses operational endpoints that don't belong under any
 * business feature (auth/cards/pass). Kept intentionally minimal — just
 * the warmup cron for now.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { warmupCronRoute } from './routes/warmupCron';

export const healthModule = new Hono<HonoEnv>()
  .route('/warmup', warmupCronRoute);

export default healthModule;
