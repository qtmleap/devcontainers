import { UserCreateSchema } from '@app/shared'
import { Hono } from 'hono'

// Service binding: the DB worker is exposed via `DB_SERVICE.fetch(request)`.
// We call it like any other HTTP endpoint but without leaving the CF
// Workers runtime — no external network hop, no auth surface for the DB.
type Bindings = {
  DB_SERVICE: Fetcher
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.get('/users/:id', async (c) => {
  const id = c.req.param('id')
  const res = await c.env.DB_SERVICE.fetch(new Request(`http://db/users/${id}`))
  return new Response(res.body, res)
})

app.post('/users', async (c) => {
  const body = await c.req.json()
  const parsed = UserCreateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400)
  }
  const res = await c.env.DB_SERVICE.fetch(
    new Request('http://db/users', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  return new Response(res.body, res)
})

export default app
