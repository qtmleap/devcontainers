import { resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
  },
  plugins: [
    react(),
    cloudflare({
      configPath: './wrangler.toml',
    }),
  ],
  build: {
    target: 'esnext',
    minify: true,
  },
  worker: {
    format: 'es',
  },
  ssr: {
    target: 'webworker',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
