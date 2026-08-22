// Open-weight models don't reliably follow "output ONLY JSON" — they
// sometimes wrap it in a code fence, add a stray sentence before/after, or
// leave a <think> block in. A naive strip-fences-then-parse breaks (and
// silently kills the whole call) the moment any of that happens. This finds
// the actual {...} object by matching the first '{' to its balanced closing
// '}', tolerating anything a model adds around it.
export function extractJson(raw) {
  const text = String(raw).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think>/gi, '')
  const start = text.indexOf('{')
  if (start === -1) throw new Error('No JSON object found in the response')
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return JSON.parse(text.slice(start, i + 1))
    }
  }
  throw new Error('Malformed JSON object in the response')
}
