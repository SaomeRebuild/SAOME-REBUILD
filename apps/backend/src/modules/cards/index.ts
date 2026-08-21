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
 * - DELETE /:id       — Delete a template
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

/**
 * Mounted at /api/cards in src/index.ts.
 */
export const cardsModule = new Hono<HonoEnv>()
  // Routes
  .route('/', createCardRoute)
  .route('/', listCardsRoute)
  .route('/', getCardRoute)
  .route('/', updateCardRoute)
  .route('/', publishCardRoute)
  .route('/', touchCardRoute)
  .route('/', deleteCardRoute);

// Default export for `app.route('/api/cards', cardsModule)`
export default cardsModule;
