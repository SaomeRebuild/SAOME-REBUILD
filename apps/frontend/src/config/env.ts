/**
 * Frontend runtime config.
 *
 * Type-safe access to environment variables via Vite's `import.meta.env`.
 * Values are validated with zod at module load.
 */

import { z } from 'zod';

const ConfigSchema = z.object({
  apiBaseUrl: z.string().url().default('http://localhost:8787'),
  appBaseUrl: z.string().url().default('http://localhost:5173'),
});

const parsed = ConfigSchema.parse({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  appBaseUrl: import.meta.env.VITE_APP_BASE_URL,
});

export const env = parsed;
export type Env = typeof env;
