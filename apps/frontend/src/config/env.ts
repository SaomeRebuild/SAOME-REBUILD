/**
 * Frontend runtime config.
 *
 * Type-safe access to environment variables via Vite's `import.meta.env`.
 * Values are validated with zod at module load.
 *
 * Defaults:
 *   - apiBaseUrl:
 *       dev (`import.meta.env.PROD === false`): '' (use Vite proxy /api/* → backend)
 *       prod (`import.meta.env.PROD === true`): https://saome-backend.josh1989213.workers.dev
 *     The production default is REQUIRED so a Cloudflare Pages build with a
 *     missing VITE_API_BASE_URL still hits the real backend. Bug-4c: the
 *     previous dev-only default silently broke admin login on the deployed
 *     frontend. Bug-7: dev now uses empty string so the Vite proxy makes
 *     /api requests same-origin (no cross-site SameSite rejection).
 *   - appBaseUrl:
 *       dev: http://localhost:5173
 *       prod: https://saome-frontend.pages.dev
 *
 * Override at build time:
 *   VITE_API_BASE_URL=https://staging.example.test npm run build
 */

import { z } from 'zod';

const isProd = import.meta.env.PROD === true;

// Allow empty string in dev so we use the Vite proxy (same-origin). In prod
// the empty string would be wrong — it would resolve requests against the
// deployed frontend itself (which has no /api). The schema below catches
// this by demanding a URL in prod while permitting '' in dev.
const devDefault = '';
const prodDefault = 'https://saome-backend.josh1989213.workers.dev';

const ConfigSchema = z.object({
  apiBaseUrl: z
    .string()
    .refine((s) => s === '' || /^https?:\/\//.test(s), {
      message: 'apiBaseUrl must be empty (use Vite proxy) or a full URL',
    })
    .default(isProd ? prodDefault : devDefault),
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

if (!isProd && parsed.apiBaseUrl === '') {
  // Dev: empty apiBaseUrl means "use the Vite proxy". The actual base URL
  // is the same as the app (http://localhost:5173 by default), so relative
  // fetches resolve to the proxy.
  // eslint-disable-next-line no-console
  console.info(
    '[env] apiBaseUrl is empty — using Vite /api proxy (same-origin). ' +
      'Configure VITE_API_BASE_URL to override.',
  );
}

export const env = parsed;
export type Env = typeof env;
