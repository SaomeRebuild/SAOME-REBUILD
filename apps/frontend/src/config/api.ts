/**
 * API configuration constants.
 */

import { env } from './env';

export const api = {
  baseUrl: env.apiBaseUrl,
  paths: {
    register: '/api/auth/register',
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
    // Cards module
    cards: '/api/cards',
    cardById: (id: string) => `/api/cards/${id}`,
    cardPublish: (id: string) => `/api/cards/${id}/publish`,
    cardTouch: (id: string) => `/api/cards/${id}/touch`,
    cardDrafts: '/api/cards/drafts',
    cardGenerateUploadUrl: (id: string) => `/api/cards/${id}/generate-upload-url`,
    cardImage: (id: string, type: 'logo' | 'background' | 'icon') =>
      `/api/cards/${id}/image/${type}`,
  },
} as const;
