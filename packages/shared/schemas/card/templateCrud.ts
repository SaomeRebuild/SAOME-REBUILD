/**
 * Card template CRUD request payloads.
 *
 * @module shared/schemas/card/templateCrud
 * @description Request bodies for creating and updating a card template.
 *
 * Part of the card schema contract (Rule 019 § 4.1) — frontend and
 * backend MUST import from `shared/schemas/card`.
 */

import { z } from 'zod';
import { cardTypeSchema, templateStatusSchema } from './enums';
import { templateSettingsSchema } from './templateSettings';

/**
 * Card ID (optional; client-generated UUID for optimistic creation,
 * so we can redirect to the editor immediately). If omitted, the DB generates one.
 */
export const createTemplateSchema = z.object({
  /** Client-generated UUID for immediate redirect. */
  id: z.string().uuid().optional(),
  name: z.string().optional(),
  /** Card type. NULL = user has not selected a type yet (orphan draft). */
  cardType: cardTypeSchema.optional(),
  settings: templateSettingsSchema.optional(),
});

export type CreateTemplatePayload = z.infer<typeof createTemplateSchema>;

/**
 * PUT /api/cards/:id — Update a template
 */
export const updateTemplateSchema = z.object({
  name: z.string().optional(),
  cardType: cardTypeSchema.optional(),
  settings: templateSettingsSchema.optional(),
  status: templateStatusSchema.optional(),
});

export type UpdateTemplatePayload = z.infer<typeof updateTemplateSchema>;
