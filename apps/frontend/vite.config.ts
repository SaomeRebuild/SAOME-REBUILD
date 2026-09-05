import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sharedRoot = path.resolve(__dirname, '../../packages/shared')
const rootNodeModules = path.resolve(__dirname, '../../node_modules')

// More specific alias MUST come before generic ones — Vite matches array form
// by declaration order; the first match wins (prefix matching).
const alias = [
  { find: 'zustand', replacement: path.resolve(rootNodeModules, 'zustand') },
  { find: /^@saome\/shared\/schemas\/auth$/, replacement: path.resolve(sharedRoot, 'schemas/auth.ts') },
  { find: /^@saome\/shared\/schemas\/member$/, replacement: path.resolve(sharedRoot, 'schemas/member.ts') },
  { find: /^@saome\/shared\/schemas\/order$/, replacement: path.resolve(sharedRoot, 'schemas/order.ts') },
  { find: /^@saome\/shared\/schemas\/pass$/, replacement: path.resolve(sharedRoot, 'schemas/pass.ts') },
  { find: /^@saome\/shared\/schemas\/cardBuilder$/, replacement: path.resolve(sharedRoot, 'schemas/cardBuilder.ts') },
  { find: /^@saome\/shared\/schemas$/, replacement: path.resolve(sharedRoot, 'schemas/index.ts') },
  { find: /^@saome\/shared\/logic\/member$/, replacement: path.resolve(sharedRoot, 'logic/member.ts') },
  { find: /^@saome\/shared\/logic\/order$/, replacement: path.resolve(sharedRoot, 'logic/order.ts') },
  { find: /^@saome\/shared\/logic\/pass$/, replacement: path.resolve(sharedRoot, 'logic/pass.ts') },
  { find: /^@saome\/shared\/logic\/imageCrop$/, replacement: path.resolve(sharedRoot, 'logic/imageCrop.ts') },
  { find: /^@saome\/shared\/logic\/color$/, replacement: path.resolve(sharedRoot, 'logic/color.ts') },
  { find: /^@saome\/shared\/logic\/links$/, replacement: path.resolve(sharedRoot, 'logic/links.ts') },
  { find: /^@saome\/shared\/logic\/cardSettings$/, replacement: path.resolve(sharedRoot, 'logic/cardSettings.ts') },
  { find: /^@saome\/shared\/logic$/, replacement: path.resolve(sharedRoot, 'logic/index.ts') },
  { find: /^@saome\/shared\/types\/member$/, replacement: path.resolve(sharedRoot, 'types/member.ts') },
  { find: /^@saome\/shared\/types\/order$/, replacement: path.resolve(sharedRoot, 'types/order.ts') },
  { find: /^@saome\/shared\/types\/pass$/, replacement: path.resolve(sharedRoot, 'types/pass.ts') },
  { find: /^@saome\/shared\/types\/imageCrop$/, replacement: path.resolve(sharedRoot, 'types/imageCrop.ts') },
  { find: /^@saome\/shared\/types$/, replacement: path.resolve(sharedRoot, 'types/index.ts') },
  { find: /^@saome\/shared\/constants\/role$/, replacement: path.resolve(sharedRoot, 'constants/role.ts') },
  { find: /^@saome\/shared\/constants\/card-images$/, replacement: path.resolve(sharedRoot, 'constants/card-images.ts') },
  { find: /^@saome\/shared\/constants\/card-fields$/, replacement: path.resolve(sharedRoot, 'constants/card-fields.ts') },
  { find: /^@saome\/shared\/constants\/color-presets$/, replacement: path.resolve(sharedRoot, 'constants/color-presets.ts') },
  { find: /^@saome\/shared\/constants\/crop-interaction$/, replacement: path.resolve(sharedRoot, 'constants/crop-interaction.ts') },
  { find: /^@saome\/shared\/constants\/card-back-fields$/, replacement: path.resolve(sharedRoot, 'constants/card-back-fields.ts') },
  { find: /^@saome\/shared\/constants\/r2$/, replacement: path.resolve(sharedRoot, 'constants/r2.ts') },
  { find: /^@saome\/shared\/constants$/, replacement: path.resolve(sharedRoot, 'constants/index.ts') },
  { find: /^@saome\/shared\/i18n\/detectLanguage$/, replacement: path.resolve(sharedRoot, 'i18n/detectLanguage.ts') },
  { find: /^@saome\/shared\/i18n\/zh-TW$/, replacement: path.resolve(sharedRoot, 'i18n/zh-TW.ts') },
  { find: /^@saome\/shared\/i18n\/en$/, replacement: path.resolve(sharedRoot, 'i18n/en.ts') },
  { find: /^@saome\/shared\/i18n$/, replacement: path.resolve(sharedRoot, 'i18n/index.ts') },
  { find: /^@saome\/shared\/bdd$/, replacement: path.resolve(sharedRoot, 'bdd/index.ts') },
  { find: '@saome/shared', replacement: path.resolve(sharedRoot, 'index.ts') },
  { find: '@', replacement: path.resolve(__dirname, './src') },
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias,
  },
  server: {
    proxy: {
      '/api': {
        // Bug-7 fix dev mode: proxy same-origin /api to production backend.
        // Cookies will be set as same-origin by the browser, sidestepping the
        // `SameSite=Lax` cross-site rejection. Production frontend deploys
        // don't use this proxy and hit the backend directly.
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})