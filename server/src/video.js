import { complete } from './openrouter.js'

// Best-effort YouTube transcript fetch — no API key, no extra dependency.
// Reads the public watch page, pulls the caption track list out of the
// embedded player response, then fetches that track as JSON3 captions.
// Anything can go wrong here (page shape changes, no captions on the video,
// network hiccups) so every step is defensive and failure is reported back
// as a plain reason, never thrown into the chat response.

export function youtubeVideoId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/)
  return m ? m[1] : null
}

async function fetchCaptionTracks(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' },
  })
  if (!res.ok) throw new Error(`YouTube page fetch failed (${res.status})`)
  const html = await res.text()
  const m = html.match(/"captionTracks":(\[.*?\])(?=,")/)
  if (!m) return []
  try {
    return JSON.parse(m[1])
  } catch {
    return []
  }
}

async function fetchTranscriptText(videoId) {
  const tracks = await fetchCaptionTracks(videoId)
  if (!tracks.length) return ''
  const track = tracks.find((t) => String(t.languageCode || '').startsWith('en')) || tracks[0]
  const res = await fetch(`${track.baseUrl}&fmt=json3`)
  if (!res.ok) return ''
  const data = await res.json()
  return (data.events || [])
    .flatMap((e) => (e.segs || []).map((s) => s.utf8 || ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Summarize a lesson video for a learner. Returns { ok: true, summary } or
 * { ok: false, reason } — never throws, so callers can surface the reason
 * plainly instead of failing the whole chat turn.
 */
export async function summarizeVideo(url, { title } = {}) {
  const videoId = youtubeVideoId(url)
  if (!videoId) {
    return { ok: false, reason: 'Only YouTube video links can be summarized right now.' }
  }
  let transcript = ''
  try {
    transcript = await fetchTranscriptText(videoId)
  } catch (err) {
    return { ok: false, reason: `Could not read this video's captions (${err.message}).` }
  }
  if (!transcript) {
    return { ok: false, reason: 'This video has no captions or transcript available to summarize.' }
  }
  try {
    const raw = await complete({
      model: 'bermi-core',
      maxTokens: 900,
      messages: [
        {
          role: 'system',
          content:
            'Summarize a video transcript for a learner studying a course. Markdown, well-structured: a one-line ' +
            'overview, then the main points as short sections or a list, then a short "Key takeaways" list. Be ' +
            'concise but complete — cover everything substantive. Do not mention "the transcript" or "captions".',
        },
        {
          role: 'user',
          content: `Video${title ? ` ("${title}")` : ''} transcript:\n${transcript.slice(0, 15000)}`,
        },
      ],
    })
    const summary = String(raw || '').trim()
    if (!summary) return { ok: false, reason: 'Could not generate a summary for this video.' }
    return { ok: true, summary }
  } catch (err) {
    return { ok: false, reason: `Could not generate a summary (${err.message}).` }
  }
}
