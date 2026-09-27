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

  /**
   * Step 7 — Upload the rasterized table-card PNG to R2 and persist the
   * JSONB pointer (`settings.tableCard.exportKey` +
   * `settings.tableCard.lastExportedAt`).
   *
   * Frontend flow:
   * 1. `stage.toDataURL({ pixelRatio: 3 })` → Blob
   * 2. `cardService.exportTableCard(templateId, blob)` → POST multipart
   * 3. Update store via `setTableCardExport(exportKey, lastExportedAt)`
   *
   * Server-side: writes R2 at
   * `{tenant_id}/{template_id}/table-card-export.png` (single key per
   * template; overwritten on each export — latest snapshot only).
   *
   * @param templateId - Template UUID
   * @param blob - PNG Blob from Konva `stage.toDataURL({ mimeType: 'image/png' })`
   * @returns exportKey (R2 path), publicUrl, lastExportedAt ISO string
   */
  async exportTableCard(
    templateId: string,
    blob: Blob,
  ): Promise<{ exportKey: string; publicUrl: string; lastExportedAt: string }> {
    const formData = new FormData();
    // 'image' field name matches `exportTableCard.ts` `formData.get('image')`.
    // File name is required for FormData Blob entries in some environments;
    // 'table-card-export.png' matches the R2 key's basename.
    formData.append('image', blob, 'table-card-export.png');
    const res = await httpClient.post<{
      exportKey: string;
      publicUrl: string;
      lastExportedAt: string;
    }>(`${api.paths.cardById(templateId)}/table-card/export`, formData);
    return res;
  },

  /**
   * Step 7 — Download the latest exported table-card PNG.
   *
   * Uses `httpClient.getBlob` so the Bearer token is attached to the
   * request (Rule 036 — Authorization header is the source of truth,
   * not a `?token=` query param that lands in browser history). The
   * previous `window.open(url)` approach silently 401'd in production
   * because browser navigation requests do not include the
   * `Authorization` header.
   *
   * Caller is responsible for turning the returned Blob into a
   * browser download trigger (e.g. `URL.createObjectURL` + `<a download>`).
   *
   * @param templateId - Template UUID
   * @returns PNG Blob from the server (Content-Disposition is ignored;
   *          the frontend always saves with `table-card.png`)
   */
  async downloadTableCardBlob(templateId: string): Promise<Blob> {
    return httpClient.getBlob(
      `${api.paths.cardById(templateId)}/table-card/download`,
    );
  },

  /**
   * Step 7 — Generate a pre-signed R2 upload URL for a table-card image
   * element (logos, decorative images embedded in the canvas).
   *
   * Mirrors `generateUploadUrl` but for the table-card element case.
   * Frontend generates a UUID element id locally so the imageKey can be
   * set in `settings.tableCard.elements[i].imageKey` BEFORE the actual
   * upload completes (no second round-trip).
   *
   * Round 3 Fix 6 — accept the actual file contentType so the signed
   * PUT URL carries the matching `Content-Type` header. The previous
   * implementation hard-coded `image/png`, so JPG uploads produced a
   * signature mismatch → R2 403 → subsequent GETs returned 204 →
   * CanvasImage saw `status === 'loading'` forever.
   *
   * @param templateId - Template UUID
   * @param elementId - Client-generated UUID for the new element
   * @param contentType - Actual file MIME type from the File object
   * @returns Pre-signed upload URL + R2 key
   */
  async generateTableCardElementUploadUrl(
    templateId: string,
    elementId: string,
    contentType: 'image/png' | 'image/jpeg' = 'image/png',
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    const res = await httpClient.post<{
      uploadUrl: string;
      key: string;
      publicUrl: string;
    }>(`${api.paths.cardById(templateId)}/table-card/element/upload-url`, {
      elementId,
      contentType,
    });
    return res;
  },

  /**
   * Step 7 — Delete a table-card image element from both the DB row
   * (removes the JSONB reference) and R2 (frees the storage slot).
   *
   * Round 3 Fix 4.3 — without this call, removing an image element
   * from the editor leaves an orphan R2 object at
   * `{tenantId}/{templateId}/table-card/{elementId}.png`. A template
   * with 50 image-element edits would leave 50 orphan PNGs in R2.
   *
   * Best-effort: the store calls this fire-and-forget so a 5xx or
   * network blip doesn't block the editor's optimistic UI. A future
   * cron can sweep unreferenced R2 objects if any leak through.
   *
   * Backend route: `DELETE /api/cards/:id/table-card/element/:elementId`.
   * Returns 204 No Content on success.
   *
   * @param templateId - Template UUID
   * @param elementId - UUID of the image element to delete
   */
  async deleteTableCardElement(
    templateId: string,
    elementId: string,
  ): Promise<void> {
    await httpClient.delete<void>(
      `${api.paths.cardById(templateId)}/table-card/element/${elementId}`,
    );
  },
};
