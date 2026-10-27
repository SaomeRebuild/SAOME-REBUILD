import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const sharedRoot = resolve(__dirname, '../../packages/shared');
const rootNodeModules = resolve(__dirname, '../../node_modules');

// IMPORTANT: Vite alias `find` matches by prefix in declaration order. More
// specific paths MUST come before less specific ones, otherwise
// `@saome/shared` will swallow `@saome/shared/schemas/member` and rewrite it
// to `index.ts`, leaving `/schemas/member` dangling.
const aliasArray: { find: string | RegExp; replacement: string }[] = [
  { find: 'zustand', replacement: resolve(rootNodeModules, 'zustand') },
  { find: '@', replacement: resolve(__dirname, './src') },
  // Most specific first
  { find: '@saome/shared/schemas/auth', replacement: resolve(sharedRoot, 'schemas/auth.ts') },
  { find: '@saome/shared/schemas/member', replacement: resolve(sharedRoot, 'schemas/member.ts') },
  { find: '@saome/shared/schemas/order', replacement: resolve(sharedRoot, 'schemas/order.ts') },
  { find: '@saome/shared/schemas/pass', replacement: resolve(sharedRoot, 'schemas/pass.ts') },
  { find: '@saome/shared/schemas/cardBuilder', replacement: resolve(sharedRoot, 'schemas/cardBuilder.ts') },
  { find: '@saome/shared/schemas/card', replacement: resolve(sharedRoot, 'schemas/card/index.ts') },
  // 2026-10-14 — Option B: stamp card image composition. Required by
  // uploadStampCardImage.ts and the Step 8 publish hook (Decision
  // 2026-10-14). Must come BEFORE generic `@saome/shared/schemas` per
  // Rule 016 § vitest alias 順序.
  { find: '@saome/shared/schemas/stampCard', replacement: resolve(sharedRoot, 'schemas/stampCard.ts') },
  // 2026-10-23 — gift-card purchase contract (Layer 1) + math.
  // Specific entries MUST come before the generic ones (Rule 016:
  // vitest alias is prefix-matching, first match wins).
  { find: '@saome/shared/schemas/passHolder', replacement: resolve(sharedRoot, 'schemas/passHolder.ts') },
  { find: '@saome/shared/logic/giftCardPurchase', replacement: resolve(sharedRoot, 'logic/giftCardPurchase.ts') },
  // 2026-10-23 — money formatting for the gift-card purchase section
  // (rate unit, amount fences, derived price, CTA). ONE formatter so
  // these figures cannot drift into different formats. Must come
  // BEFORE generic `@saome/shared/logic` per Rule 016 § vitest alias 順序.
  { find: '@saome/shared/logic/currency', replacement: resolve(sharedRoot, 'logic/currency.ts') },
  // 2026-10-24 - Pass runtime value domain (event ledger / snapshot /
  // formatter). Must come BEFORE generic `@saome/shared/logic` and
  // `@saome/shared/schemas` per Rule 016 § vitest alias 順序.
  { find: '@saome/shared/logic/passValueCalculator', replacement: resolve(sharedRoot, 'logic/passValueCalculator.ts') },
  { find: '@saome/shared/logic/passFieldFormatter', replacement: resolve(sharedRoot, 'logic/passFieldFormatter.ts') },
  { find: '@saome/shared/logic/passExpiry', replacement: resolve(sharedRoot, 'logic/passExpiry.ts') },
  // 2026-10-27 - Discount tier resolution + amount formatting (shared
  // between the Wallet payload and the editor preview). Must come
  // BEFORE generic `@saome/shared/logic` per Rule 016 § vitest alias
  // ordering.
  { find: '@saome/shared/logic/spendTier', replacement: resolve(sharedRoot, 'logic/spendTier.ts') },
  // 2026-10-27 - Visit count "number + unit" formatter (shared
  // between the Wallet payload and the editor preview). Must come
  // BEFORE generic `@saome/shared/logic` per Rule 016 § vitest alias
  // ordering.
  { find: '@saome/shared/logic/visitCount', replacement: resolve(sharedRoot, 'logic/visitCount.ts') },
  { find: '@saome/shared/schemas/passValues', replacement: resolve(sharedRoot, 'schemas/passValues.ts') },
  { find: '@saome/shared/schemas', replacement: resolve(sharedRoot, 'schemas/index.ts') },
  { find: '@saome/shared/logic/member', replacement: resolve(sharedRoot, 'logic/member.ts') },
  { find: '@saome/shared/logic/order', replacement: resolve(sharedRoot, 'logic/order.ts') },
  { find: '@saome/shared/logic/pass', replacement: resolve(sharedRoot, 'logic/pass.ts') },
  { find: '@saome/shared/logic/tableCard', replacement: resolve(sharedRoot, 'logic/tableCard.ts') },
  { find: '@saome/shared/logic/imageCrop', replacement: resolve(sharedRoot, 'logic/imageCrop.ts') },
  { find: '@saome/shared/logic/color', replacement: resolve(sharedRoot, 'logic/color.ts') },
  { find: '@saome/shared/logic/links', replacement: resolve(sharedRoot, 'logic/links.ts') },
  { find: '@saome/shared/logic/cardSettings', replacement: resolve(sharedRoot, 'logic/cardSettings.ts') },
  { find: '@saome/shared/logic/locations', replacement: resolve(sharedRoot, 'logic/locations.ts') },
  // 2026-10-13 — stamp card image composition (Phase 2). Must come BEFORE
  // generic `@saome/shared/logic` per Rule 016 § vitest alias 順序.
  { find: '@saome/shared/logic/stampCardImage', replacement: resolve(sharedRoot, 'logic/stampCardImage.ts') },
  { find: '@saome/shared/logic', replacement: resolve(sharedRoot, 'logic/index.ts') },
  { find: '@saome/shared/types/member', replacement: resolve(sharedRoot, 'types/member.ts') },
  { find: '@saome/shared/types/order', replacement: resolve(sharedRoot, 'types/order.ts') },
  { find: '@saome/shared/types/passHolder', replacement: resolve(sharedRoot, 'types/passHolder.ts') },
  { find: '@saome/shared/types/pass', replacement: resolve(sharedRoot, 'types/pass.ts') },
  { find: '@saome/shared/types/imageCrop', replacement: resolve(sharedRoot, 'types/imageCrop.ts') },
  { find: '@saome/shared/types', replacement: resolve(sharedRoot, 'types/index.ts') },
  { find: '@saome/shared/constants/role', replacement: resolve(sharedRoot, 'constants/role.ts') },
  { find: '@saome/shared/constants/card-images', replacement: resolve(sharedRoot, 'constants/card-images.ts') },
  { find: '@saome/shared/constants/card-fields', replacement: resolve(sharedRoot, 'constants/card-fields.ts') },
  { find: '@saome/shared/constants/card-back-fields', replacement: resolve(sharedRoot, 'constants/card-back-fields.ts') },
  { find: '@saome/shared/constants/color-presets', replacement: resolve(sharedRoot, 'constants/color-presets.ts') },
  { find: '@saome/shared/constants/crop-interaction', replacement: resolve(sharedRoot, 'constants/crop-interaction.ts') },
  { find: '@saome/shared/constants/r2', replacement: resolve(sharedRoot, 'constants/r2.ts') },
  { find: '@saome/shared/constants/balancePreview', replacement: resolve(sharedRoot, 'constants/balancePreview.ts') },
  { find: '@saome/shared/constants/cashbackPreviewAmounts', replacement: resolve(sharedRoot, 'constants/cashbackPreviewAmounts.ts') },
  { find: '@saome/shared/constants/discountPreviewAmounts', replacement: resolve(sharedRoot, 'constants/discountPreviewAmounts.ts') },
  { find: '@saome/shared/constants/couponPreviewAmounts', replacement: resolve(sharedRoot, 'constants/couponPreviewAmounts.ts') },
  { find: '@saome/shared/constants/gift-card', replacement: resolve(sharedRoot, 'constants/gift-card.ts') },
  // 2026-10-24 — header slot single source (cardType → kind → key/testId).
  // Must come BEFORE generic `@saome/shared/constants` per Rule 016 §
  // vitest alias 順序.
  { find: '@saome/shared/constants/headerSlots', replacement: resolve(sharedRoot, 'constants/headerSlots.ts') },
  // 2026-10-27 - Visit count demo value (editor + template library
  // preview). Must come BEFORE generic `@saome/shared/constants` per
  // Rule 016 § vitest alias 順序.
  { find: '@saome/shared/constants/visitCountPreview', replacement: resolve(sharedRoot, 'constants/visitCountPreview.ts') },
  { find: '@saome/shared/constants/table-card', replacement: resolve(sharedRoot, 'constants/table-card.ts') },
  { find: '@saome/shared/constants/stamp-card', replacement: resolve(sharedRoot, 'constants/stamp-card.ts') },
  { find: '@saome/shared/constants/reward-card', replacement: resolve(sharedRoot, 'constants/reward-card.ts') },
  { find: '@saome/shared/constants/cashback-card', replacement: resolve(sharedRoot, 'constants/cashback-card.ts') },
  { find: '@saome/shared/constants/discount-card', replacement: resolve(sharedRoot, 'constants/discount-card.ts') },
  { find: '@saome/shared/constants/membership-card', replacement: resolve(sharedRoot, 'constants/membership-card.ts') },
  { find: '@saome/shared/constants/coupon-card', replacement: resolve(sharedRoot, 'constants/coupon-card.ts') },
  // 2026-10-13 — stamp card image composition (Phase 2). Must come BEFORE
  // generic `@saome/shared/constants` per Rule 016 § vitest alias 順序.
  { find: '@saome/shared/constants/stampCard', replacement: resolve(sharedRoot, 'constants/stampCard.ts') },
  { find: '@saome/shared/constants', replacement: resolve(sharedRoot, 'constants/index.ts') },
  { find: '@saome/shared/i18n/zh-TW', replacement: resolve(sharedRoot, 'i18n/zh-TW.ts') },
  { find: '@saome/shared/i18n/en', replacement: resolve(sharedRoot, 'i18n/en.ts') },
  { find: '@saome/shared/i18n/detectLanguage', replacement: resolve(sharedRoot, 'i18n/detectLanguage.ts') },
  { find: '@saome/shared/i18n', replacement: resolve(sharedRoot, 'i18n/index.ts') },
  { find: '@saome/shared/bdd', replacement: resolve(sharedRoot, 'bdd/index.ts') },
  // Least specific last
  { find: '@saome/shared', replacement: resolve(sharedRoot, 'index.ts') },
];

// vitest 3.x bundles its own Vite (rollup-based), but `@vitejs/plugin-react`
// and `@tailwindcss/vite` installed at the workspace root target the new
// rolldown-based Vite. The two Plugin types are structurally incompatible
// (`PluginContextMeta.rolldownVersion` only exists on the rolldown build),
// so TypeScript rejects the assignment to `plugins: PluginOption`. The
// plugins work fine at runtime because vitest just forwards the array to
// Vite's plugin pipeline. Cast through `any` to silence the spurious type
// error while preserving the array's runtime shape.
// See https://github.com/vitest-dev/vitest/issues/7278 for the upstream
// discussion.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plugins = [react(), tailwindcss()] as any;

export default defineConfig({
  plugins,
  resolve: { alias: aliasArray },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    server: {
      deps: {
        inline: ['@saome/shared'],
      },
    },
  },
});

