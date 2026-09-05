/**
 * Auth module — Hono sub-app.
 *
 * @module modules/auth
 * @description Composes register/login/refresh/me routes into a single Hono
 * sub-app that is mounted at `/api/auth` in src/index.ts.
 *
 * This file does NOT contain business logic; it only assembles routes and
 * module-specific middleware (rateLimit).
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { registerRoute } from './routes/register';
import { loginRoute } from './routes/login';
import { refreshRoute } from './routes/refresh';
import { meRoute } from './routes/me';
import { logoutRoute } from './routes/logout';
import { rateLimitMiddleware } from './middleware/rateLimit';

/**
 * Mounted at /api/auth in src/index.ts.
 */
export const authModule = new Hono<HonoEnv>()
  // Module-wide middleware: rate limit login + register
  .use('/register', rateLimitMiddleware)
  .use('/login', rateLimitMiddleware)
  // Routes
  .route('/register', registerRoute)
  .route('/login', loginRoute)
  .route('/refresh', refreshRoute)
  .route('/logout', logoutRoute)
  .route('/me', meRoute);

// Default export for `app.route('/api/auth', authModule)`
export default authModule;