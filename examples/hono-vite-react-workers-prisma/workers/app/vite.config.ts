import { resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// ESM equivalent of the CJS __dirname global. Available in Node 20.11+.
const dirname = import.meta.dirname

// Multi-worker CF Vite config. Without `auxiliaryWorkers`, `vite dev` only
// runs the app worker and the api / db service bindings resolve to nothing;
// with it, all three workers spin up together and bindings actually connect.
export default defineConfig({
  server: {
    port: 5173,
    // Host aliases used when the dev server runs inside a devcontainer.
    allowedHosts: ['host.docker.internal', 'localhost'],
  },
  plugins: [
    react(),
    cloudflare({
      configPath: './wrangler.toml',
      // Share the D1 SQLite state with the db worker so `wrangler d1 migrations
      // apply --local` in workers/db and `vite dev` in workers/app see the
      // same database.
      persistState: { path: resolve(dirname, '../db/.wrangler/state') },
      // Bring up the api and db workers alongside the app worker. Their
      // wrangler.toml is the source of truth for bindings + dev ports.
      auxiliaryWorkers: [
        { configPath: resolve(dirname, '../api/wrangler.toml') },
        { configPath: resolve(dirname, '../db/wrangler.toml') },
      ],
      // Everything runs locally in dev; never reach out to remote CF resources.
      remoteBindings: false,
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
      '@': resolve(dirname, './src'),
    },
  },
})
