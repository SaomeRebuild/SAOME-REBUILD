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
    /** B4 (2026-09-05): POST /api/auth/logout — clears HttpOnly saome_refresh cookie. */
    logout: '/api/auth/logout',
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
    // Pass Holder Registration (public, no auth). Reserved today; the
    // frontend ships a mock service and will swap to these endpoints when
    // the backend lands.
    passTemplate: (id: string) => `/api/pass-templates/${id}/public`,
    passRegister: (id: string) => `/api/pass-templates/${id}/register`,
    // Public logo proxy — added 2026-10-01 per
    // runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md.
    // Serves the issuer logo via the backend (which rebuilds the R2 key
    // for multi-tenant audit). Mock-stage `template.issuerLogo` from
    // Picsum is absolute, so the frontend PassHolderHeader checks
    // `startsWith('http')` and only wraps R2 keys with this path.
    passLogo: (id: string) => `/api/pass-templates/${id}/logo`,
  },
} as const;
