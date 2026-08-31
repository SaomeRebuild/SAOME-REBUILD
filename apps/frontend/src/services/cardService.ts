/**
 * cardService — card template CRUD operations.
 *
 * Uses `httpClient` for transport.
 *
 * Endpoints:
 * - POST   /api/cards          — Create a new template draft
 * - GET    /api/cards          — List all templates for the tenant
 * - GET    /api/cards/drafts   — Get the most recent draft (for "從頭建置" resume check)
 * - GET    /api/cards/:id      — Get a single template by ID
 * - PUT    /api/cards/:id      — Update a template
 * - POST   /api/cards/:id/publish — Publish a template
 * - PATCH  /api/cards/:id/touch — Reset draft TTL (auto-save keep-alive)
 * - DELETE /api/cards/:id      — Delete a template (used for both library delete & abandon)
 */

import { httpClient } from './httpClient';
import { api } from '@/config/api';
import type {
  CreateTemplatePayload,
  UpdateTemplatePayload,
  TemplateDto,
} from '@saome/shared/schemas/card';
import type { CardImageType } from '@saome/shared/constants/card-images';

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

interface GetLatestDraftResponse {
  draft: TemplateDto | null;
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
   * Create a new draft and return its ID.
   * Used by CardBuilderPage when user clicks "從頭建置".
   * The UUID is generated client-side so we can redirect immediately.
   */
  async createDraft(id: string): Promise<TemplateDto> {
    const res = await httpClient.post<CreateTemplateResponse>(api.paths.cards, { id });
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
    const res = await httpClient.put<UpdateTemplateResponse>(api.paths.cardById(id), payload);
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
    await httpClient.delete<DeleteTemplateResponse>(api.paths.cardById(id));
  },

  /**
   * Touch a draft template — reset its TTL to now() + 24h.
   * Called by the auto-save debounced effect to keep active drafts alive.
   */
  async touch(id: string): Promise<TemplateDto> {
    const res = await httpClient.patch<UpdateTemplateResponse>(api.paths.cardTouch(id));
    return res.template;
  },

  /**
   * Get the most recent draft template for the authenticated tenant.
   * Used by "從頭建置" to check if a resume-worthy draft exists.
   * Returns null if no draft is found.
   */
  async getLatestDraft(): Promise<TemplateDto | null> {
    const res = await httpClient.get<GetLatestDraftResponse>(api.paths.cardDrafts);
    return res.draft;
  },

  /**
   * Mark a draft template as abandoned — permanently deletes it.
   * Used by CardBuilderPage when user clicks "從頭建置" and chooses to discard the existing draft.
   */
  async abandon(id: string): Promise<void> {
    await httpClient.delete<DeleteTemplateResponse>(api.paths.cardById(id));
  },

  /**
   * Generate a pre-signed URL for direct R2 upload.
   *
   * Flow:
   * 1. Call this to get a pre-signed PUT URL
   * 2. Upload the cropped image directly to R2 using the pre-signed URL
   * 3. Call update() with the R2 key as issuerLogo
   *
   * @param templateId - Template UUID
   * @param imageType - Type of image to upload ('logo', 'background', 'icon')
   * @returns Pre-signed upload URL and R2 key
   */
  async generateUploadUrl(
    templateId: string,
    imageType: CardImageType,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    const res = await httpClient.post<{ uploadUrl: string; key: string; publicUrl: string }>(
      api.paths.cardGenerateUploadUrl(templateId),
      { imageType },
    );
    return res;
  },
};
