/**
 * Response types for the cards module.
 *
 * @module modules/cards/schemas/response
 * @description DTOs returned by card template endpoints.
 */

import type { CardType, TemplateSettings } from '../db/templates';

export interface TemplateDto {
  id: string;
  status: 'draft' | 'published';
  name: string;
  cardType: CardType;
  settings: TemplateSettings;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateTemplateResponse {
  template: TemplateDto;
}

export interface GetTemplateResponse {
  template: TemplateDto;
}

export interface ListTemplatesResponse {
  templates: TemplateDto[];
}

export interface UpdateTemplateResponse {
  template: TemplateDto;
}

export interface DeleteTemplateResponse {
  success: boolean;
}
