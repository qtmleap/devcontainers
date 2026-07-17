import type { User } from '@app/shared'
import { UserSchema } from '@app/shared'
import { useEffect, useState } from 'react'
import { z } from 'zod'

export const App = () => {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    void fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        const parsed = z.array(UserSchema).safeParse(data)
        if (parsed.success) setUsers(parsed.data)
      })
  }, [])

  return (
    <main>
      <h1>Users</h1>
      <ul>
        {users.map((u) => (
          <li key={u.id}>{u.email}</li>
        ))}
      </ul>
    </main>
  )
}
