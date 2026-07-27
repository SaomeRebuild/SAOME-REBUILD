import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sharedRoot = path.resolve(__dirname, '../../packages/shared')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@saome/shared': path.resolve(sharedRoot, 'index.ts'),
      '@saome/shared/schemas': path.resolve(sharedRoot, 'schemas/index.ts'),
      '@saome/shared/schemas/member': path.resolve(sharedRoot, 'schemas/member.ts'),
      '@saome/shared/schemas/order': path.resolve(sharedRoot, 'schemas/order.ts'),
      '@saome/shared/schemas/pass': path.resolve(sharedRoot, 'schemas/pass.ts'),
      '@saome/shared/logic': path.resolve(sharedRoot, 'logic/index.ts'),
      '@saome/shared/logic/member': path.resolve(sharedRoot, 'logic/member.ts'),
      '@saome/shared/logic/order': path.resolve(sharedRoot, 'logic/order.ts'),
      '@saome/shared/logic/pass': path.resolve(sharedRoot, 'logic/pass.ts'),
      '@saome/shared/types': path.resolve(sharedRoot, 'types/index.ts'),
      '@saome/shared/types/member': path.resolve(sharedRoot, 'types/member.ts'),
      '@saome/shared/types/order': path.resolve(sharedRoot, 'types/order.ts'),
      '@saome/shared/types/pass': path.resolve(sharedRoot, 'types/pass.ts'),
      '@saome/shared/i18n': path.resolve(sharedRoot, 'i18n/index.ts'),
      '@saome/shared/i18n/zh-TW': path.resolve(sharedRoot, 'i18n/zh-TW.ts'),
      '@saome/shared/i18n/en': path.resolve(sharedRoot, 'i18n/en.ts'),
      '@saome/shared/bdd': path.resolve(sharedRoot, 'bdd/index.ts'),
    },
  },
})
