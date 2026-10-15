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
import {
  getLogoRoute,
  getIconRoute,
  getBackgroundRoute,
} from './routes/getTemplateImage';
import { getStampImage0Route } from './routes/getTemplateStampImage';

/**
 * Mounted at /api/pass-templates in src/index.ts.
 *
 * IMPORTANT: more specific routes (`:id/public`, `:id/register`) must be
 * declared BEFORE `:id` if/when a generic `:id` route is added later.
 *
 * Image routes (`:id/logo`, `:id/icon`, `:id/background`) are public R2
 * proxies added per runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md
 * (logo) and the 2026-10-12 extension to icon + background.
 *
 * Stamp-image routes (`:id/stamp-image/0`) expose the composed stamp
 * card PNGs written by `stamp-images/services/uploadStampImage.ts` so
 * Passcreator can fetch them as `images.background` for stamp_card /
 * multipass pushes (2026-10-15, see runs/decisions/2026-10-15-
 * stamp-card-push-wiring.md). The Scanner will additionally push
 * fillCount 1..15 in Plan Phase 3 (deferred).
 */
export const passTemplatesModule = new Hono<HonoEnv>()
  .route('/', getPublicRoute)          // GET  /:id/public
  .route('/', registerRoute)           // POST /:id/register
  .route('/', getLogoRoute)            // GET  /:id/logo
  .route('/', getIconRoute)            // GET  /:id/icon          (2026-10-12)
  .route('/', getBackgroundRoute)      // GET  /:id/background    (2026-10-12)
  .route('/', getStampImage0Route);    // GET  /:id/stamp-image/0 (2026-10-15)

// Default export for `app.route('/api/pass-templates', passTemplatesModule)`
export default passTemplatesModule;