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
  },
} as const;
