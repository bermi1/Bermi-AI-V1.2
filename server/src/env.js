import dotenv from 'dotenv'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Imported before everything else so env vars exist when modules (like the
// storage backend selector) evaluate. Loads server/.env first, then the
// repo-root .env as fallback; dotenv never overrides already-set vars.
const dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(dir, '..', '.env') })
dotenv.config({ path: join(dir, '..', '..', '.env') })

// Deploy-time secrets for platforms without env-var configuration (e.g. Vercel
// MCP file-tree deploys): a JSON file bundled into the serverless function via
// vercel.json `functions.includeFiles` and read here with fs (reliable, unlike
// a dynamic import which the bundler may drop). Never overrides real env vars.
try {
  const cfg = JSON.parse(readFileSync(join(dir, 'runtime-config.json'), 'utf8'))
  for (const [k, v] of Object.entries(cfg)) {
    if (v != null && process.env[k] == null) process.env[k] = String(v)
  }
} catch {
  /* absent locally — env vars / .env are the source of truth */
}

// Legacy JS config module (older deploys shipped secrets this way). Optional.
try {
  await import('./runtime-config.js')
} catch {
  /* absent in the repo — env vars are the source of truth */
}
