/**
 * Card template service — business logic layer.
 *
 * @module modules/cards/services/cardService
 * @description Orchestrates card template operations: create, get, list, update, publish, delete.
 */

import type { Sql } from '@/shared/db/client';
import {
  insertTemplate,
  findTemplateById,
  findTemplatesByTenantId,
  updateTemplate,
  deleteTemplate,
  touchExpiresAt,
} from '../db/templates';
import { NotFoundError } from '@/shared/lib/saomeError';
import type {
  TemplatesRow,
  TemplateSettings,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '../db/templates';
import type {
  TemplateDto,
  CreateTemplateResponse,
  GetTemplateResponse,
  ListTemplatesResponse,
  UpdateTemplateResponse,
  DeleteTemplateResponse,
} from '../schemas/response';

/**
 * Convert a DB row to a TemplateDto.
 */
function toDto(row: TemplatesRow): TemplateDto {
  return {
    id: row.id,
    status: row.status,
    name: row.name,
    cardType: row.card_type,
    settings: (typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings) as TemplateSettings,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

/**
 * Create a new template draft.
 *
 * @param sql - Database client
 * @param tenantId - Tenant ID from JWT
 * @param cardType - Card type (optional — NULL if user has not selected yet)
 * @param name - Optional template name
 * @param settings - Optional initial settings
 * @param id - Optional client-generated UUID (for immediate redirect)
 */
export async function createTemplateService(
  sql: Sql,
  tenantId: string,
  cardType: string | undefined,
  name?: string,
  settings?: Partial<TemplateSettings>,
  id?: string,
): Promise<CreateTemplateResponse> {
  const input: CreateTemplateInput = {
    id,
    tenantId,
    name: name ?? '未命名卡片',
    cardType: cardType as CreateTemplateInput['cardType'],
    settings,
  };
  const row = await insertTemplate(sql, input);
  return { template: toDto(row) };
}

/**
 * Get a template by ID.
 *
 * @param sql - Database client
 * @param templateId - Template UUID
 * @param tenantId - Tenant ID from JWT (for ownership check)
 */
export async function getTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
): Promise<GetTemplateResponse> {
  const row = await findTemplateById(sql, templateId);
  if (!row) {
    throw new NotFoundError('common.error.notFound', 'Template not found');
  }
  // Ownership check: ensure the template belongs to the tenant
  if (row.tenant_id !== tenantId) {
    throw new NotFoundError('common.error.notFound', 'Template not found');
  }
  return { template: toDto(row) };
}

/**
 * List all templates for a tenant.
 *
 * @param sql - Database client
 * @param tenantId - Tenant ID from JWT
 */
export async function listTemplatesService(
  sql: Sql,
  tenantId: string,
): Promise<ListTemplatesResponse> {
  const rows = await findTemplatesByTenantId(sql, tenantId);
  return { templates: rows.map(toDto) };
}

/**
 * Update a template.
 *
 * @param sql - Database client
 * @param templateId - Template UUID
 * @param tenantId - Tenant ID from JWT (for ownership check)
 * @param name - Optional new name
 * @param cardType - Optional new card type
 * @param settings - Optional partial settings
 * @param status - Optional new status
 */
export async function updateTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
  name?: string,
  cardType?: string,
  settings?: Partial<TemplateSettings>,
  status?: 'draft' | 'published' | 'abandoned',
): Promise<UpdateTemplateResponse> {
  // Ownership check
  const existing = await findTemplateById(sql, templateId);
  if (!existing || existing.tenant_id !== tenantId) {
    throw new NotFoundError('common.error.notFound', 'Template not found');
  }

  const input: UpdateTemplateInput = {};
  if (name !== undefined) input.name = name;
  if (cardType !== undefined) input.cardType = cardType as UpdateTemplateInput['cardType'];
  if (settings !== undefined) input.settings = settings;
  if (status !== undefined) input.status = status;

  const row = await updateTemplate(sql, templateId, input);
  return { template: toDto(row) };
}

/**
 * Publish a template (change status from draft to published).
 */
export async function publishTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
): Promise<UpdateTemplateResponse> {
  return updateTemplateService(sql, templateId, tenantId, undefined, undefined, undefined, 'published');
}

/**
 * Delete a template.
 *
 * @param sql - Database client
 * @param templateId - Template UUID
 * @param tenantId - Tenant ID from JWT (for ownership check)
 */
export async function deleteTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
): Promise<DeleteTemplateResponse> {
  // Ownership check
  const existing = await findTemplateById(sql, templateId);
  if (!existing || existing.tenant_id !== tenantId) {
    throw new NotFoundError('common.error.notFound', 'Template not found');
  }

  await deleteTemplate(sql, templateId);
  return { success: true };
}

/**
 * Touch a draft template — reset its expires_at to now() + 24h.
 * Called by frontend auto-save to keep drafts alive.
 */
export async function touchTemplateService(
  sql: Sql,
  templateId: string,
  tenantId: string,
): Promise<UpdateTemplateResponse> {
  // Ownership check
  const existing = await findTemplateById(sql, templateId);
  if (!existing || existing.tenant_id !== tenantId) {
    throw new NotFoundError('common.error.notFound', 'Template not found');
  }
  if (existing.status !== 'draft') {
    // Touching a published template is a no-op
    return { template: toDto(existing) };
  }
  const row = await touchExpiresAt(sql, templateId);
  return { template: toDto(row) };
}
