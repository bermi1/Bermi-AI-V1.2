import { SqliteStorage } from './sqlite.js'

/**
 * Storage backend selection: Supabase when SUPABASE_URL + SUPABASE_KEY are
 * configured AND reachable, local SQLite otherwise. Both expose the same
 * async interface, so routes never care which backend is active.
 */
async function pickStorage() {
  const url = process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY

  if (url && key) {
    try {
      const { SupabaseStorage } = await import('./supabase.js')
      const supabase = new SupabaseStorage(url, key)
      // Startup probe with a short timeout — a configured-but-unreachable
      // Supabase (offline dev, egress-restricted sandbox) degrades to SQLite
      // instead of breaking every request.
      await Promise.race([
        supabase.getSetting('__startup_probe__'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('probe timeout')), 6000),
        ),
      ])
      console.log('Storage backend: Supabase (%s)', new URL(url).hostname)
      return supabase
    } catch (err) {
      console.warn(
        'Supabase configured but unreachable (%s) — falling back to SQLite.',
        err.message,
      )
    }
  }
  console.log('Storage backend: SQLite (server/data/bermi.db)')
  return new SqliteStorage()
}

export const storage = await pickStorage()
