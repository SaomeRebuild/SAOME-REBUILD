/**
 * Frontend runtime config.
 *
 * Type-safe access to environment variables via Vite's `import.meta.env`.
 * Values are validated with zod at module load.
 *
 * Defaults:
 *   - apiBaseUrl:
 *       dev (`import.meta.env.PROD === false`): http://localhost:8787
 *       prod (`import.meta.env.PROD === true`): https://saome-backend.josh1989213.workers.dev
 *     The production default is REQUIRED so a Cloudflare Pages build with a
 *     missing VITE_API_BASE_URL still hits the real backend. Bug-4c: the
 *     previous dev-only default silently broke admin login on the deployed
 *     frontend.
 *   - appBaseUrl:
 *       dev: http://localhost:5173
 *       prod: https://saome-frontend.pages.dev
 *
 * Override at build time:
 *   VITE_API_BASE_URL=https://staging.example.test npm run build
 */

import { z } from 'zod';

const isProd = import.meta.env.PROD === true;

const ConfigSchema = z.object({
  apiBaseUrl: z
    .string()
    .url()
    .default(
      isProd
        ? 'https://saome-backend.josh1989213.workers.dev'
        : 'http://localhost:8787',
    ),
  appBaseUrl: z
    .string()
    .url()
    .default(
      isProd
        ? 'https://saome-frontend.pages.dev'
        : 'http://localhost:5173',
    ),
});

const parsed = ConfigSchema.parse({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  appBaseUrl: import.meta.env.VITE_APP_BASE_URL,
});

export const env = parsed;
export type Env = typeof env;
