/**
 * Vitest configuration for saome-backend.
 *
 * Uses @cloudflare/vitest-pool-workers so tests run inside workerd (the
 * same runtime that powers Cloudflare Workers) with real bindings
 * (HYPERDRIVE, etc.) from wrangler.jsonc.
 *
 * Test scripts:
 *   npm test              ← vitest run (CI mode)
 *   npm run test:watch    ← vitest --watch (dev mode)
 *   npm run test:ui       ← vitest --ui
 *   npm run test:coverage ← vitest run --coverage
 *
 * Pool-workers setup notes:
 *   - `wrangler.jsonc` is read for bindings
 *   - Hyperdrive binding requires `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`
 *     env var (set by CI / devs before `npm test`). It points at a local
 *     Postgres connection; even though most tests `vi.mock` the DB layer,
 *     wrangler ≥ 4.30 refuses to initialize the runtime without one.
 *   - Secrets (JWT_SECRET) come from `.dev.vars` in dev or `CLOUDFLARE_*` env in CI
 */

import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

if (!process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE) {
  process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE =
    'postgres://postgres:postgres@127.0.0.1:5432/postgres';
}

export default defineWorkersConfig({
  test: {
    globals: true,
    poolOptions: {
      workers: {
        singleWorker: true,
        // Match wrangler.jsonc (workerd latest supported: 2025-09-06 as of v0.8.x)
        compatibilityDate: '2025-09-06',
        compatibilityFlags: ['nodejs_compat'],
        wrangler: {
          configPath: path.resolve(__dirname, 'wrangler.jsonc'),
        },
      },
    },
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/schemas/*.ts', // zod schemas are tested via schema.test.ts
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/shared': path.resolve(__dirname, 'src/shared'),
      '@/shared/': path.resolve(__dirname, 'src/shared/'),
      '@saome/shared/schemas': path.resolve(__dirname, '../../packages/shared/schemas/index.ts'),
      '@saome/shared/schemas/': path.resolve(__dirname, '../../packages/shared/schemas/'),
      '@saome/shared/types': path.resolve(__dirname, '../../packages/shared/types/index.ts'),
      '@saome/shared/types/': path.resolve(__dirname, '../../packages/shared/types/'),
      '@saome/shared/logic': path.resolve(__dirname, '../../packages/shared/logic/index.ts'),
      '@saome/shared/logic/': path.resolve(__dirname, '../../packages/shared/logic/'),
    },
  },
});