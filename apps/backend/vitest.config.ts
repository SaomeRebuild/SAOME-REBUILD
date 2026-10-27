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
      // Specific entries (with subpath) MUST come BEFORE the generic ones
      // (Rule 016: vite alias is prefix-matching, first match wins).
      // The trailing-slash generic entry already matches `…/card` etc. as
      // subpath lookups; the bare `@saome/shared/schemas` resolves to the
      // barrel `index.ts` for callers that import from the index only.
      '@saome/shared/schemas/card': path.resolve(__dirname, '../../packages/shared/schemas/card/index.ts'),
      // 2026-10-23 — gift-card purchase contract (Layer 1). Value
      // imports need an EXPLICIT `.ts` entry: the generic trailing-slash
      // alias below only resolves for `import type` (erased at compile
      // time, never handed to Vite). Same pattern as `schemas/card` and
      // `logic/cardSettings` above. Declared BEFORE the generic entries
      // per Rule 016 (vite alias is prefix-matching, first match wins).
      '@saome/shared/schemas/passHolder': path.resolve(__dirname, '../../packages/shared/schemas/passHolder.ts'),
      '@saome/shared/logic/giftCardPurchase': path.resolve(__dirname, '../../packages/shared/logic/giftCardPurchase.ts'),
      // 2026-10-14 — stamp card image composition (Phase 3). Specific
      // entries MUST come before the generic ones per Rule 016.
      '@saome/shared/schemas/stampCard': path.resolve(__dirname, '../../packages/shared/schemas/stampCard.ts'),
      // 2026-10-24 - Pass runtime value domain (event ledger / snapshot /
      // formatter). Specific entries MUST come BEFORE the generic
      // trailing-slash entries per Rule 016 § vitest alias 順序.
      '@saome/shared/logic/passValueCalculator': path.resolve(__dirname, '../../packages/shared/logic/passValueCalculator.ts'),
      '@saome/shared/logic/passFieldFormatter': path.resolve(__dirname, '../../packages/shared/logic/passFieldFormatter.ts'),
      '@saome/shared/logic/passExpiry': path.resolve(__dirname, '../../packages/shared/logic/passExpiry.ts'),
      // 2026-10-27 - Discount tier resolution + amount formatting.
      // Value imports need an EXPLICIT `.ts` entry: the generic
      // trailing-slash alias below only resolves for `import type`
      // (erased at compile time, never handed to Vite). Declared
      // BEFORE the generic entries per Rule 016 (vite alias is
      // prefix-matching, first match wins).
      '@saome/shared/logic/spendTier': path.resolve(__dirname, '../../packages/shared/logic/spendTier.ts'),
      // 2026-10-27 — membership tier snapshot resolver. Value import
      // needs an EXPLICIT `.ts` entry for the same reason as
      // `spendTier` above: the generic trailing-slash alias only
      // resolves `import type` (erased at compile time).
      '@saome/shared/logic/membershipTier': path.resolve(__dirname, '../../packages/shared/logic/membershipTier.ts'),
      '@saome/shared/schemas/passValues': path.resolve(__dirname, '../../packages/shared/schemas/passValues.ts'),
      '@saome/shared/schemas/': path.resolve(__dirname, '../../packages/shared/schemas/'),
      '@saome/shared/schemas': path.resolve(__dirname, '../../packages/shared/schemas/index.ts'),
      '@saome/shared/types/': path.resolve(__dirname, '../../packages/shared/types/'),
      '@saome/shared/types': path.resolve(__dirname, '../../packages/shared/types/index.ts'),
      '@saome/shared/logic/': path.resolve(__dirname, '../../packages/shared/logic/'),
      '@saome/shared/logic/cardSettings': path.resolve(__dirname, '../../packages/shared/logic/cardSettings.ts'),
      '@saome/shared/logic/cardSettings/': path.resolve(__dirname, '../../packages/shared/logic/cardSettings/'),
      '@saome/shared/logic/stampCardImage': path.resolve(__dirname, '../../packages/shared/logic/stampCardImage.ts'),
      '@saome/shared/logic': path.resolve(__dirname, '../../packages/shared/logic/index.ts'),
      // Specific entries (with subpath) MUST come BEFORE the generic ones
      // (Rule 016: vite alias is prefix-matching, first match wins).
      '@saome/shared/constants/card-fields': path.resolve(__dirname, '../../packages/shared/constants/card-fields.ts'),
      '@saome/shared/constants/card-images': path.resolve(__dirname, '../../packages/shared/constants/card-images.ts'),
      '@saome/shared/constants/coupon-card': path.resolve(__dirname, '../../packages/shared/constants/coupon-card.ts'),
      '@saome/shared/constants/membership-card': path.resolve(__dirname, '../../packages/shared/constants/membership-card.ts'),
      '@saome/shared/constants/multipass-card': path.resolve(__dirname, '../../packages/shared/constants/multipass-card.ts'),
      // 2026-10-14 — stamp card image composition (Phase 3). Specific
      // entries MUST come before the generic ones per Rule 016.
      '@saome/shared/constants/stampCard': path.resolve(__dirname, '../../packages/shared/constants/stampCard.ts'),
      // 2026-10-24 — header slot single source (cardType → kind →
      // key/testId). Must come BEFORE the generic trailing-slash entry
      // per Rule 016 § vitest alias 順序.
      '@saome/shared/constants/headerSlots': path.resolve(__dirname, '../../packages/shared/constants/headerSlots.ts'),
      '@saome/shared/constants/': path.resolve(__dirname, '../../packages/shared/constants/'),
      '@saome/shared/constants': path.resolve(__dirname, '../../packages/shared/constants/index.ts'),
      // Specific entries (with subpath) MUST come BEFORE the generic ones
      // (Rule 016: vite alias is prefix-matching, first match wins).
      '@saome/shared/i18n/fieldLabels': path.resolve(__dirname, '../../packages/shared/i18n/fieldLabels.ts'),
      '@saome/shared/i18n/detectLanguage': path.resolve(__dirname, '../../packages/shared/i18n/detectLanguage.ts'),
      '@saome/shared/i18n/': path.resolve(__dirname, '../../packages/shared/i18n/'),
      '@saome/shared/i18n': path.resolve(__dirname, '../../packages/shared/i18n/index.ts'),
    },
  },
});