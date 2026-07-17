import { UserCreateSchema } from '@app/shared'
import { PrismaD1 } from '@prisma/adapter-d1'
import { Hono } from 'hono'
import { PrismaClient } from './generated/prisma/client'

// This worker exists solely because @prisma/client + engine push the api
// worker past the 1MB script size limit. Isolating Prisma here keeps the
// api bundle lean and lets us redeploy schema changes without touching api.
type Bindings = {
  DB: D1Database
}

const prismaFor = (env: Bindings): PrismaClient => {
  const adapter = new PrismaD1(env.DB)
  return new PrismaClient({ adapter })
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/users/:id', async (c) => {
  const prisma = prismaFor(c.env)
  const user = await prisma.user.findUnique({ where: { id: c.req.param('id') } })
  if (!user) return c.json({ error: 'not_found' }, 404)
  return c.json(user)
})

app.post('/users', async (c) => {
  const body = await c.req.json()
  const parsed = UserCreateSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400)
  const prisma = prismaFor(c.env)
  const user = await prisma.user.create({ data: parsed.data })
  return c.json(user, 201)
})

export default app
