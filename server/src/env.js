import dotenv from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Imported before everything else so env vars exist when modules (like the
// storage backend selector) evaluate. Loads server/.env first, then the
// repo-root .env as fallback; dotenv never overrides already-set vars.
const dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(dir, '..', '.env') })
dotenv.config({ path: join(dir, '..', '..', '.env') })
