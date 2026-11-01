// Chapter lists for the audiobook player. LibriVox recordings live on the
// Internet Archive; its public metadata endpoint lists every file, and we pick
// ONE MP3 rendition per chapter so the app can show its own player instead of
// an embedded one. Lookups only ever happen for ids of published audiobooks,
// are cached, and time out quickly.

const RANK = ['VBR MP3', '64Kbps MP3', '128Kbps MP3', 'MP3']
const TTL_MS = 12 * 60 * 60_000
const cache = new Map()

/** "754.12", "12:34" or "01:02:03" -> seconds (0 when unknown). */
export function parseLength(v) {
  if (v == null) return 0
  const s = String(v).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s))
  const parts = s.split(':').map(Number)
  if (parts.some((n) => !Number.isFinite(n)) || parts.length > 3) return 0
  return Math.round(parts.reduce((acc, n) => acc * 60 + n, 0))
}

const prettify = (name) =>
  name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/_?(64|128)kb$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Picks one MP3 rendition per chapter from Internet Archive item metadata. */
export function pickTracks(meta, archiveId) {
  const files = Array.isArray(meta?.files) ? meta.files : []
  const mp3 = files.filter((f) => typeof f?.name === 'string' && /mp3$/i.test(f.name) && !/_(sample|preview)\b/i.test(f.name))
  const format = RANK.find((r) => mp3.some((f) => f.format === r)) ?? null
  const chosen = format ? mp3.filter((f) => f.format === format) : mp3
  const num = (f) => {
    const t = parseInt(String(f.track ?? '').split('/')[0], 10)
    return Number.isFinite(t) ? t : Infinity
  }
  return chosen
    .sort((a, b) => num(a) - num(b) || a.name.localeCompare(b.name, undefined, { numeric: true }))
    .slice(0, 200)
    .map((f, i) => ({
      name: f.name,
      title: String(f.title || prettify(f.name) || `Part ${i + 1}`).slice(0, 120),
      seconds: parseLength(f.length),
      url: `https://archive.org/download/${archiveId}/${encodeURIComponent(f.name)}`,
    }))
}

/** Tracks for one archive item (cached). `fetchFn` is injectable for tests. */
export async function getTracks(archiveId, fetchFn = fetch) {
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(archiveId)) throw Object.assign(new Error('Invalid audiobook id'), { status: 400 })
  const hit = cache.get(archiveId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tracks
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 10_000)
  try {
    const res = await fetchFn(`https://archive.org/metadata/${archiveId}`, { signal: ctl.signal })
    if (!res.ok) throw new Error(`archive.org answered ${res.status}`)
    const tracks = pickTracks(await res.json(), archiveId)
    if (!tracks.length) throw new Error('No audio files found for this recording')
    cache.set(archiveId, { at: Date.now(), tracks })
    return tracks
  } catch (err) {
    throw Object.assign(new Error('The chapter list could not be loaded from the Internet Archive just now.'), { status: 502, cause: err })
  } finally {
    clearTimeout(timer)
  }
}
