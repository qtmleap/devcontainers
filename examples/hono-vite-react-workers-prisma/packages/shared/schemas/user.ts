import { z } from 'zod'

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1).max(120).nullable(),
  createdAt: z.iso.datetime(),
})

export type User = z.infer<typeof UserSchema>

export const UserCreateSchema = UserSchema.pick({
  email: true,
  name: true,
})

export type UserCreate = z.infer<typeof UserCreateSchema>
