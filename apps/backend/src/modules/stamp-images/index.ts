/**
 * Stamp Images module — Hono sub-app.
 *
 * @module modules/stamp-images
 * @description Composes the stamp card image upload routes into a
 * single Hono sub-app that is mounted at `/api/templates` in
 * `src/index.ts`. The path name (`/api/templates`) intentionally
 * mirrors the frontend's URL contract — `uploadStampCardImage` builds
 * `${apiBaseUrl}/api/templates/${templateId}/stamp-images/${fillCount}`
 * — so no URL-rewrite layer is needed.
 *
 * Routes:
 *   - PUT /:templateId/stamp-images/:fillCount — Upload a rendered
 *     stamp card PNG (base64) to R2. See routes/uploadStampImage.ts.
 *
 * Auth: every endpoint requires a Bearer JWT (requireAuth middleware).
 * Tenant ownership is enforced inside the route handler via a
 * `findTemplateById` lookup that matches `template.tenant_id` against
 * the JWT's `tenantId` claim.
 *
 * Migration: see supabase/migrations/20261013000001_022_init_stamp_card_images.sql.
 * Decision log: see runs/decisions/2026-10-13-stamp-card-image-composition-frontend.md.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { uploadStampImageRoute } from './routes/uploadStampImage';

/**
 * Mounted at /api/templates in src/index.ts.
 *
 * IMPORTANT: This module DOES NOT host generic `/api/templates/:id`
 * routes. The cards module (`apps/backend/src/modules/cards/`) owns
 * the templates-table CRUD and is mounted at `/api/cards`. The
 * `/api/templates` mount is reserved for resources that live under
 * a template but are NOT part of the cards CRUD itself (e.g. stamp
 * images, future table-card exports if we decide to move them).
 *
 * Route order matters in Hono: a `/:templateId` "catch-all" would
 * shadow the `/:templateId/stamp-images/:fillCount` route. There is
 * NO catch-all here on purpose — every future sub-resource gets its
 * own dedicated route declaration.
 */
export const stampImagesModule = new Hono<HonoEnv>()
  .route('/', uploadStampImageRoute); // PUT /:templateId/stamp-images/:fillCount

// Default export for `app.route('/api/templates', stampImagesModule)`
export default stampImagesModule;