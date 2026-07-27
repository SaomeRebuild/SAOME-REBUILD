import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sharedRoot = path.resolve(__dirname, '../../packages/shared')

// More specific alias MUST come before generic ones — Vite matches array form
// by declaration order; the first match wins (prefix matching).
const alias = [
  { find: /^@saome\/shared\/schemas\/auth$/, replacement: path.resolve(sharedRoot, 'schemas/auth.ts') },
  { find: /^@saome\/shared\/schemas\/member$/, replacement: path.resolve(sharedRoot, 'schemas/member.ts') },
  { find: /^@saome\/shared\/schemas\/order$/, replacement: path.resolve(sharedRoot, 'schemas/order.ts') },
  { find: /^@saome\/shared\/schemas\/pass$/, replacement: path.resolve(sharedRoot, 'schemas/pass.ts') },
  { find: /^@saome\/shared\/schemas$/, replacement: path.resolve(sharedRoot, 'schemas/index.ts') },
  { find: /^@saome\/shared\/logic\/member$/, replacement: path.resolve(sharedRoot, 'logic/member.ts') },
  { find: /^@saome\/shared\/logic\/order$/, replacement: path.resolve(sharedRoot, 'logic/order.ts') },
  { find: /^@saome\/shared\/logic\/pass$/, replacement: path.resolve(sharedRoot, 'logic/pass.ts') },
  { find: /^@saome\/shared\/logic$/, replacement: path.resolve(sharedRoot, 'logic/index.ts') },
  { find: /^@saome\/shared\/types\/member$/, replacement: path.resolve(sharedRoot, 'types/member.ts') },
  { find: /^@saome\/shared\/types\/order$/, replacement: path.resolve(sharedRoot, 'types/order.ts') },
  { find: /^@saome\/shared\/types\/pass$/, replacement: path.resolve(sharedRoot, 'types/pass.ts') },
  { find: /^@saome\/shared\/types$/, replacement: path.resolve(sharedRoot, 'types/index.ts') },
  { find: /^@saome\/shared\/constants\/role$/, replacement: path.resolve(sharedRoot, 'constants/role.ts') },
  { find: /^@saome\/shared\/constants$/, replacement: path.resolve(sharedRoot, 'constants/index.ts') },
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
        target: 'http://localhost:8787',
        changeOrigin: false,
        secure: false,
      },
    },
  },
})