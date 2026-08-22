// A real retrieval layer for Bermi's knowledge bases ("brains") and other
// long text sources, replacing "dump the first 20k characters and hope the
// answer is in there." Large source material is chunked, then ranked by
// BM25 (the same relevance-ranking algorithm search engines used for
// decades before neural embeddings) so the query actually determines what
// gets included — a 200-page document now works, not just the first few
// pages of one, because the WHOLE thing is searched, not just the head.
//
// This is deliberately NOT a neural embedding / vector database — that
// would need either a paid embeddings API or a heavy local model, neither
// of which fits "stay free, no added infrastructure cost." BM25 is a real,
// well-established retrieval technique in its own right (still a core
// component of most production "hybrid search" RAG systems alongside
// embeddings) and needs nothing but CPU and text.

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about', 'as', 'by', 'this', 'that', 'these', 'those',
  'it', 'its', 'from', 'into', 'than', 'then', 'so', 'do', 'does', 'did', 'has', 'have', 'had',
  'i', 'you', 'he', 'she', 'we', 'they', 'them', 'his', 'her', 'their', 'our', 'your', 'my',
])

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || []
}

function tokenizeQuery(text) {
  return tokenize(text).filter((t) => !STOPWORDS.has(t) && t.length > 1)
}

/**
 * Splits text into overlapping chunks on paragraph/sentence boundaries where
 * possible (never mid-word) — overlap means a fact sitting right at a chunk
 * boundary still appears whole in at least one chunk instead of being cut
 * in half and lost to both neighbors.
 */
export function chunkText(text, { chunkSize = 900, overlap = 150 } = {}) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!clean) return []
  if (clean.length <= chunkSize) return [clean]

  const chunks = []
  let start = 0
  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length)
    if (end < clean.length) {
      // Prefer breaking at a paragraph, then sentence, then word boundary —
      // in that order of preference — searching backward from `end` within
      // a reasonable window so we don't wander far from the target size.
      const window = clean.slice(start, end)
      const paraBreak = window.lastIndexOf('\n\n')
      const sentBreak = Math.max(window.lastIndexOf('. '), window.lastIndexOf('.\n'))
      const spaceBreak = window.lastIndexOf(' ')
      const breakAt = paraBreak > chunkSize * 0.5 ? paraBreak : sentBreak > chunkSize * 0.5 ? sentBreak + 1 : spaceBreak
      if (breakAt > 0) end = start + breakAt
    }
    const piece = clean.slice(start, end).trim()
    if (piece) chunks.push(piece)
    if (end >= clean.length) break
    start = Math.max(end - overlap, start + 1) // always make forward progress
  }
  return chunks
}

const K1 = 1.5
const B = 0.75

/**
 * Ranks pre-chunked passages against a query using BM25, returning the
 * `topK` best-matching chunks (each with its score) in relevance order.
 * `chunks` is an array of `{ text, ...anyExtraMetadata }` — extra fields are
 * passed through untouched so callers can carry a source name/id alongside
 * each chunk.
 */
export function rankChunks(query, chunks, topK = 5) {
  if (!chunks.length) return []
  const queryTerms = [...new Set(tokenizeQuery(query))]
  if (!queryTerms.length) return chunks.slice(0, topK).map((c) => ({ ...c, score: 0 }))

  const docs = chunks.map((c) => tokenize(c.text))
  const docLengths = docs.map((d) => d.length)
  const avgDocLength = docLengths.reduce((a, b) => a + b, 0) / docs.length || 1

  // Document frequency: how many chunks contain each query term at all.
  const df = new Map()
  for (const term of queryTerms) {
    let count = 0
    for (const doc of docs) if (doc.includes(term)) count++
    df.set(term, count)
  }

  const N = docs.length
  const scored = chunks.map((chunk, i) => {
    const doc = docs[i]
    const docLen = docLengths[i]
    let score = 0
    for (const term of queryTerms) {
      const n = df.get(term) || 0
      if (n === 0) continue
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1)
      const tf = doc.filter((w) => w === term).length
      if (tf === 0) continue
      const denom = tf + K1 * (1 - B + (B * docLen) / avgDocLength)
      score += idf * ((tf * (K1 + 1)) / denom)
    }
    return { ...chunk, score }
  })

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/**
 * Convenience: chunk a source's text once and immediately return the top-K
 * chunks relevant to a query — what callers actually want most of the time
 * (a knowledge base's raw content in, the relevant excerpt out).
 */
export function retrieveRelevant(query, text, opts = {}) {
  const { topK = 5, chunkSize, overlap } = opts
  const chunks = chunkText(text, { chunkSize, overlap }).map((t) => ({ text: t }))
  return rankChunks(query, chunks, topK)
}
