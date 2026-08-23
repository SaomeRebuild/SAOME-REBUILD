/**
 * Cards module — Hono sub-app.
 *
 * @module modules/cards
 * @description Composes card template CRUD routes into a single Hono sub-app
 * that is mounted at `/api/cards` in src/index.ts.
 *
 * Routes:
 * - POST   /          — Create a new template draft
 * - GET    /          — List all templates for the tenant
 * - GET    /:id       — Get a single template by ID
 * - PUT    /:id       — Update a template
 * - POST   /:id/publish — Publish a template
 * - PATCH  /:id/touch  — Reset draft TTL (auto-save keep-alive)
 * - DELETE /:id       — Delete a template (draft or published; draft-only enforced in service)
 */

import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { createCardRoute } from './routes/create';
import { listCardsRoute } from './routes/list';
import { getCardRoute } from './routes/getById';
import { updateCardRoute } from './routes/update';
import { publishCardRoute } from './routes/publish';
import { touchCardRoute } from './routes/touch';
import { deleteCardRoute } from './routes/delete';
import { getLatestDraftRoute } from './routes/getLatestDraft';
import { generateUploadUrlRoute } from './routes/generate-upload-url';
import { getImageRoute } from './routes/getImage';

/**
 * Mounted at /api/cards in src/index.ts.
 *
 * IMPORTANT: Route order matters! More specific routes must come BEFORE
 * parameterized routes (/:id) to avoid matching issues.
 * - /drafts must come before /:id
 * - /:id/generate-upload-url must come before /:id
 * - /:id/image/:type must come before /:id
 * - /:id/publish must come before /:id
 * - /:id/touch must come before /:id
 */
export const cardsModule = new Hono<HonoEnv>()
  // Routes (specific paths before parameterized paths)
  .route('/', getLatestDraftRoute)  // GET /drafts — MUST be before /:id
  .route('/', createCardRoute)       // POST /
  .route('/', listCardsRoute)        // GET /
  .route('/', generateUploadUrlRoute) // POST /:id/generate-upload-url — MUST be before /:id
  .route('/', getImageRoute)         // GET /:id/image/:type — MUST be before /:id
  .route('/', publishCardRoute)       // POST /:id/publish — MUST be before /:id
  .route('/', touchCardRoute)        // PATCH /:id/touch — MUST be before /:id
  .route('/', getCardRoute)          // GET /:id — AFTER all /:id/* routes
  .route('/', updateCardRoute)       // PUT /:id
  .route('/', deleteCardRoute);      // DELETE /:id

// Default export for `app.route('/api/cards', cardsModule)`
export default cardsModule;
