// Barrel export for shared Zod schemas + DTOs.
// Each domain schema lives next to this file (e.g. `user.ts`, `game.ts`) and
// gets re-exported from here so consumers can `import { UserSchema } from '@app/shared'`.

export * from './user'
