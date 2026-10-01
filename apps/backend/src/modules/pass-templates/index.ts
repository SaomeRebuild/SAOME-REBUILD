/**
 * Pass-templates module — Hono sub-app.
 *
 * @module modules/pass-templates
 * @description Composes the public, no-auth pass-templates routes into a
 * single Hono sub-app that is mounted at `/api/pass-templates` in `src/index.ts`.
 *
 * Routes:
 *   - GET  /:id/public   — Read a public-safe template view
 *   - POST /:id/register — Register a Pass Holder against a template (idempotent)
 *
 * Both endpoints are NO AUTH. UUID v4 entropy provides tenant isolation;
 * see Decision Log § Decision 3 (tenant isolation).
 *
 * Decision log: runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { getPublicRoute } from './routes/getPublic';
import { registerRoute } from './routes/register';
import { getLogoRoute } from './routes/getLogo';

/**
 * Mounted at /api/pass-templates in src/index.ts.
 *
 * IMPORTANT: more specific routes (`:id/public`, `:id/register`) must be
 * declared BEFORE `:id` if/when a generic `:id` route is added later.
 *
 * getLogoRoute (`:id/logo`) is added 2026-10-01 per
 * runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md.
 */
export const passTemplatesModule = new Hono<HonoEnv>()
  .route('/', getPublicRoute)        // GET  /:id/public
  .route('/', registerRoute)         // POST /:id/register
  .route('/', getLogoRoute);         // GET  /:id/logo  (2026-10-01)

// Default export for `app.route('/api/pass-templates', passTemplatesModule)`
export default passTemplatesModule;