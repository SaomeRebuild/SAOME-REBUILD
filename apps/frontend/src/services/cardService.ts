/**
 * cardService — card template CRUD operations.
 *
 * Uses `httpClient` for transport.
 *
 * Endpoints:
 * - POST   /api/cards       — Create a new template draft
 * - GET    /api/cards       — List all templates for the tenant
 * - GET    /api/cards/:id   — Get a single template by ID
 * - PUT    /api/cards/:id   — Update a template
 * - POST   /api/cards/:id/publish — Publish a template
 * - DELETE /api/cards/:id   — Delete a template
 */

import { httpClient } from './httpClient';
import { api } from '@/config/api';
import type {
  CreateTemplatePayload,
  UpdateTemplatePayload,
  TemplateDto,
} from '@saome/shared/schemas/card';

interface CreateTemplateResponse {
  template: TemplateDto;
}

interface GetTemplateResponse {
  template: TemplateDto;
}

interface ListTemplatesResponse {
  templates: TemplateDto[];
}

interface UpdateTemplateResponse {
  template: TemplateDto;
}

interface DeleteTemplateResponse {
  success: boolean;
}

export const cardService = {
  /**
   * Create a new card template draft.
   * Called when user clicks "從頭建置".
   */
  async create(payload: CreateTemplatePayload): Promise<TemplateDto> {
    const res = await httpClient.post<CreateTemplateResponse>(api.paths.cards, payload);
    return res.template;
  },

  /**
   * List all templates for the authenticated tenant.
   */
  async list(): Promise<TemplateDto[]> {
    const res = await httpClient.get<ListTemplatesResponse>(api.paths.cards);
    return res.templates;
  },

  /**
   * Get a single template by ID.
   */
  async getById(id: string): Promise<TemplateDto> {
    const res = await httpClient.get<GetTemplateResponse>(api.paths.cardById(id));
    return res.template;
  },

  /**
   * Update a template.
   * Usually called when user completes a step (auto-save).
   */
  async update(id: string, payload: UpdateTemplatePayload): Promise<TemplateDto> {
    const res = await httpClient.post<UpdateTemplateResponse>(api.paths.cardById(id), payload);
    return res.template;
  },

  /**
   * Publish a template (change status from draft to published).
   */
  async publish(id: string): Promise<TemplateDto> {
    const res = await httpClient.post<UpdateTemplateResponse>(api.paths.cardPublish(id));
    return res.template;
  },

  /**
   * Delete a template.
   */
  async delete(id: string): Promise<void> {
    await httpClient.post<DeleteTemplateResponse>(api.paths.cardById(id));
  },

  /**
   * Touch a draft template — reset its TTL to now() + 24h.
   * Called by the auto-save debounced effect to keep active drafts alive.
   */
  async touch(id: string): Promise<TemplateDto> {
    const res = await httpClient.patch<UpdateTemplateResponse>(api.paths.cardTouch(id));
    return res.template;
  },
};
