import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma 7+ config. Points the CLI at the schema + migrations dir. The
// `datasource.url` is only used by `prisma migrate dev` locally (writes to a
// SQLite file under .wrangler/state/). Runtime uses the D1 binding from
// wrangler.toml via the @prisma/adapter-d1 adapter.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: `file:${path.join(__dirname, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', 'db.sqlite')}`,
  },
})
