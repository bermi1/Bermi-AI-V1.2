// "Play me the best beat": turns a plain request ("I want to study hard, play
// something and balance the sound") into a playlist from the published audio
// library plus a mix of beat volume and a generated ambient layer.
//
// Deterministic by default (free, instant, works offline from any AI). When a
// request matches nothing the rules know, a tiny classification call can be
// used instead; the caller handles credits and falls back to the default.

export const MOODS = ['emotional', 'motivation', 'never-give-up', 'study', 'deep-focus']

const RULES = [
  { mood: 'deep-focus', re: /(deep|heavy|heavily|hard|serious|intens\w*|hyper)?\s*(focus|concentrat\w*|deep work|exam|coding|programming|writing|umakini|zingatia)/i, w: 3 },
  { mood: 'study', re: /(study|studying|revise|revision|homework|assignment|lecture|reading|lofi|lo-fi|somea|kusoma|masomo)/i, w: 3 },
  { mood: 'motivation', re: /(motivat\w*|gym|workout|work out|run|running|pump\w*|energy|energi[sz]e|hustle|grind|hype|nguvu|hamasa)/i, w: 3 },
  { mood: 'never-give-up', re: /(never give up|don'?t quit|dont quit|keep going|discipline|resilien\w*|persist\w*|hard day|push through|pushing through|fight|usikate tamaa|vumilia)/i, w: 4 },
  { mood: 'emotional', re: /(sad|love|heartbreak|broken|miss(ing)? (her|him|you)|cry\w*|romantic|emotion\w*|lonely|relax|unwind|calm|chill|wind down|sleep|moyo|mapenzi)/i, w: 3 },
]
const HEAVY = /(heavy|heavily|hard|serious|intens\w*|exam|deadline|maximum|max|all[- ]in|lock(ed)? in|hyper)/i
const LIGHT = /(light|easy|chill|relax\w*|gentle|soft|quiet|calm|background)/i
const NO_AMBIENT = /(no (ambient|noise|rain|extra)|just (the )?(beat|music))/i
const WANT_RAIN = /(rain|storm)/i
const WANT_AIR = /(air|breeze|wind|fan)/i
const WANT_HUSH = /(hush|brown noise|deep noise|rumble)/i

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** Intent from keywords. Returns { moods: [..ordered], confidence } */
export function detectIntent(text) {
  const scores = new Map()
  for (const r of RULES) if (r.re.test(text)) scores.set(r.mood, (scores.get(r.mood) ?? 0) + r.w)
  // "study hard / study heavily" should lean to deep focus, not light lofi.
  if (scores.has('study') && HEAVY.test(text)) scores.set('deep-focus', (scores.get('deep-focus') ?? 0) + 3)
  const moods = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m)
  return { moods, confidence: moods.length ? Math.max(...scores.values()) : 0 }
}

/** The mix: how loud the beat is and whether a generated ambient layer sits underneath. */
export function mixFor(text, mood) {
  const heavy = HEAVY.test(text)
  const light = LIGHT.test(text) && !heavy
  let scene = null
  let ambient = 0
  if (!NO_AMBIENT.test(text)) {
    if (mood === 'deep-focus') [scene, ambient] = ['brown', heavy ? 0.22 : 0.16]
    else if (mood === 'study') [scene, ambient] = [light ? 'rain' : 'brown', 0.2]
    else if (mood === 'emotional') [scene, ambient] = ['rain', 0.28]
    else if (mood === 'motivation' || mood === 'never-give-up') [scene, ambient] = [null, 0]
    if (WANT_RAIN.test(text)) [scene, ambient] = ['rain', 0.3]
    else if (WANT_AIR.test(text)) [scene, ambient] = ['air', 0.25]
    else if (WANT_HUSH.test(text)) [scene, ambient] = ['brown', 0.25]
  }
  // Heavy focus wants the beat further back so it doesn't compete with thinking.
  const beatVolume = mood === 'deep-focus' ? (heavy ? 55 : 65) : mood === 'study' ? 65 : mood === 'emotional' ? 60 : 80
  return { scene, ambient, beatVolume }
}

const LABEL = { 'deep-focus': 'Deep focus', study: 'Study beats', motivation: 'Motivation', 'never-give-up': 'Never give up', emotional: 'Emotional & love' }

/** Picks up to `limit` tracks, long mixes first, rotated so repeat requests vary. */
export function pickTracks(audio, moods, text, limit = 8) {
  const ok = audio.filter((a) => a.status === 'published' && moods.includes(a.category))
  const rank = (a) => moods.indexOf(a.category) * 1000 - Math.min(a.minutes ?? 30, 240)
  const sorted = [...ok].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title))
  if (!sorted.length) return []
  const primary = sorted.filter((a) => a.category === moods[0])
  const rest = sorted.filter((a) => a.category !== moods[0])
  const start = primary.length ? hash(`${text}|${new Date().toISOString().slice(0, 10)}`) % primary.length : 0
  const rotated = [...primary.slice(start), ...primary.slice(0, start)]
  return [...rotated, ...rest].slice(0, limit)
}

export function buildPick({ text, audio, moods, source }) {
  const mood = moods[0]
  const tracks = pickTracks(audio, moods, text)
  const mix = mixFor(text, mood)
  const sceneName = { brown: 'deep hush', rain: 'light rain', air: 'soft air' }[mix.scene]
  return {
    source,
    mood,
    title: `${LABEL[mood]} mix`,
    trackIds: tracks.map((t) => t.id),
    ...mix,
    reason: `${LABEL[mood]} fits what you asked for. ${mix.scene ? `Beat at ${mix.beatVolume}% with ${sceneName} underneath at ${Math.round(mix.ambient * 100)}%.` : `Beat at ${mix.beatVolume}%, no extra sound.`}`,
  }
}
