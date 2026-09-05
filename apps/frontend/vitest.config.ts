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
  { find: '@saome/shared/schemas', replacement: resolve(sharedRoot, 'schemas/index.ts') },
  { find: '@saome/shared/logic/member', replacement: resolve(sharedRoot, 'logic/member.ts') },
  { find: '@saome/shared/logic/order', replacement: resolve(sharedRoot, 'logic/order.ts') },
  { find: '@saome/shared/logic/pass', replacement: resolve(sharedRoot, 'logic/pass.ts') },
  { find: '@saome/shared/logic/imageCrop', replacement: resolve(sharedRoot, 'logic/imageCrop.ts') },
  { find: '@saome/shared/logic/color', replacement: resolve(sharedRoot, 'logic/color.ts') },
  { find: '@saome/shared/logic/links', replacement: resolve(sharedRoot, 'logic/links.ts') },
  { find: '@saome/shared/logic/cardSettings', replacement: resolve(sharedRoot, 'logic/cardSettings.ts') },
  { find: '@saome/shared/logic/locations', replacement: resolve(sharedRoot, 'logic/locations.ts') },
  { find: '@saome/shared/logic', replacement: resolve(sharedRoot, 'logic/index.ts') },
  { find: '@saome/shared/types/member', replacement: resolve(sharedRoot, 'types/member.ts') },
  { find: '@saome/shared/types/order', replacement: resolve(sharedRoot, 'types/order.ts') },
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

