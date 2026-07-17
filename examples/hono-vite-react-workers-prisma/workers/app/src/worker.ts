import { Hono } from 'hono'

// This worker acts as the HTTP shell for the SPA:
//  - `/api/*` requests are forwarded to the API worker via service binding
//  - anything else falls through to the ASSETS binding (Vite build output)
type Bindings = {
  ASSETS: Fetcher
  API_SERVICE: Fetcher
}

const app = new Hono<{ Bindings: Bindings }>()

app.all('/api/*', async (c) => {
  const url = new URL(c.req.url)
  const path = url.pathname.replace(/^\/api/, '')
  const forwarded = new Request(`http://api${path}${url.search}`, c.req.raw)
  return c.env.API_SERVICE.fetch(forwarded)
})

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
