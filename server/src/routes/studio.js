import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { storage } from '../storage/index.js'
import { complete } from '../openrouter.js'
import { renderDocument } from '../doc-render.js'

export const studioRouter = Router()

// Use a fast, reliable writer that returns clean Markdown. (Reasoning models
// like R1 often emit <think> traces or get rate-limited, which is why docs were
// falling back to the scaffold.)
const DRAFT_MODEL = process.env.DRAFT_MODEL || 'bermi-core'
const OUTLINE_MODEL = process.env.OUTLINE_MODEL || 'bermi-fast'

/** Strips reasoning traces and wrapping code fences from model output. */
function cleanMarkdown(raw) {
  if (!raw) return ''
  let t = String(raw)
  // Remove <think>…</think> reasoning blocks (some models leak these).
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '')
  t = t.replace(/<\/?think>/gi, '')
  // Unwrap a single fenced block that wraps the whole document.
  const fence = t.trim().match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i)
  if (fence) t = fence[1]
  return t.trim()
}

/** A genuinely full, structured document when the model is unavailable. */
function scaffold({ title, prompt, kind, isSlides }) {
  const t = title || 'Untitled document'
  if (isSlides) {
    return (
      `# ${t}\n\n` +
      `## Introduction\n- What this is about\n- Why it matters now\n\n` +
      `## Background\n- Key context\n- The current situation\n\n` +
      `## Main Points\n- First key idea\n- Second key idea\n- Third key idea\n\n` +
      `## Details\n- Supporting evidence\n- Practical examples\n\n` +
      `## Recommendations\n- What to do next\n- Priorities\n\n` +
      `## Conclusion\n- Summary\n- Call to action\n\n> Brief: ${prompt}`
    )
  }
  return (
    `# ${t}\n\n` +
    `## Introduction\n\n${prompt}\n\nThis document sets out the key points, context, and recommendations on the topic above.\n\n` +
    `## Background\n\nProvide the relevant context and current situation here.\n\n` +
    `## Key Considerations\n\n- First consideration and why it matters\n- Second consideration\n- Third consideration\n\n` +
    `## Analysis\n\nDiscuss the topic in depth, weighing the options and evidence.\n\n` +
    `## Recommendations\n\n1. First recommended action\n2. Second recommended action\n3. Next steps\n\n` +
    `## Conclusion\n\nSummarise the main points and the path forward.`
  )
}

// Document kinds shape the AI's drafting instructions.
const KINDS = {
  report: 'a professional report with a title, short intro, clear ## sections with analysis, and a conclusion',
  proposal: 'a persuasive business proposal with problem, proposed solution, scope, timeline, pricing, and next steps',
  letter: 'a formal letter with sender/recipient context, body paragraphs, and a sign-off',
  essay: 'a well-structured essay with an introduction, argued body sections, and a conclusion',
  plan: 'an actionable plan with objectives, phased steps, responsibilities, and milestones',
  notes: 'clean structured notes with headings and concise bullet points',
  resume: 'a resume with summary, experience, skills, and education sections',
  slides: 'a slide deck outline: each ## heading is one slide title followed by 3-5 concise bullet points',
}

function studioSummary(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    version: row.current_version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function loadStudioDoc(id, userId, version) {
  const doc = await storage.getDocument(id)
  if (!doc || doc.user_id !== userId || doc.type !== 'studio') return null
  const v = version ?? doc.current_version
  const versionRow = await storage.getDocumentVersion(id, v)
  if (!versionRow) return null
  const data = typeof versionRow.data === 'string' ? JSON.parse(versionRow.data) : versionRow.data
  return { ...studioSummary(doc), version: v, data }
}

/**
 * POST /api/studio/generate { title, prompt, kind, format }
 * The AI drafts markdown content; we store it as a versioned document that can
 * be downloaded as Word, PowerPoint, or PDF.
 */
studioRouter.post('/studio/generate', async (req, res, next) => {
  try {
    const { title = '', prompt = '', kind = 'report', format = 'pdf' } = req.body ?? {}
    if (!prompt.trim()) return res.status(400).json({ error: 'Describe what the document should contain' })
    const kindDesc = KINDS[kind] || KINDS.report

    const isSlides = kind === 'slides' || format === 'pptx'

    const writeSystem = isSlides
      ? 'You are Bermi, an expert presentation writer. Produce a complete, presentation-ready deck in ' +
        'GitHub-flavored Markdown ONLY. Rules: use # for the deck title (title slide); use ## for EACH ' +
        'slide title; under each slide put 2-5 concise bullet points with - ; keep bullets punchy (max ~12 words); ' +
        'bold key terms with **. Produce 8-12 slides with a logical arc (hook → context → substance → takeaways → call to action). ' +
        'Output ONLY the markdown deck, no preamble, no commentary, no <think> tags.'
      : 'You are Bermi, an expert document writer. Produce a COMPLETE, long, publish-ready ' +
        kindDesc +
        '. Respond in GitHub-flavored Markdown ONLY. ' +
        'Use # for the title, ## for sections, ### for sub-points, - for bullets, **bold** for emphasis, and tables where useful. ' +
        'Write in full, substantive PARAGRAPHS under each section — several sentences each, not just bullet points. ' +
        'Produce at least 5 well-developed sections and 500+ words. ' +
        'Output ONLY the finished document — no preamble, no commentary, no <think> tags, no code fences around the whole thing.'

    // One reliable pass: the model plans internally, then writes the whole
    // document in a single call. `complete` already walks a free-first model
    // fallback chain, so we avoid extra round-trips (which were the main source
    // of latency and mismatched output).
    async function draft(model) {
      const raw = await complete({
        model,
        maxTokens: isSlides ? 3200 : 4096,
        messages: [
          { role: 'system', content: writeSystem },
          {
            role: 'user',
            content:
              `Title: ${title || '(choose a fitting title)'}\n\nBrief: ${prompt}\n\n` +
              `Plan the structure first (in your head), then write the complete ${
                isSlides ? 'deck' : 'document'
              } directly and in full. Stay strictly on the brief.`,
          },
        ],
      })
      return cleanMarkdown(raw)
    }

    const enough = (md) => md && md.replace(/\s+/g, ' ').length >= 250

    let markdown = ''
    try {
      markdown = await draft(DRAFT_MODEL)
      // One fast fallback on a different model if the first result is too thin.
      if (!enough(markdown)) markdown = await draft(OUTLINE_MODEL)
    } catch (err) {
      console.error('Studio draft failed, using scaffold:', err.message)
    }

    if (!markdown || markdown.replace(/\s+/g, ' ').length < 120) {
      markdown = scaffold({ title, prompt, kind, isSlides })
    }

    // Derive a title from the first heading when not provided.
    const derived = title || (markdown.match(/^#\s+(.+)$/m)?.[1] ?? 'Untitled document').trim()
    const data = { title: derived, kind, format, markdown: markdown.trim() }

    const now = new Date().toISOString()
    const id = randomUUID()
    await storage.createDocument(
      {
        id,
        user_id: req.user.id,
        type: 'studio',
        title: derived,
        status: 'draft',
        created_at: now,
        updated_at: now,
      },
      data,
    )
    res.status(201).json(await loadStudioDoc(id, req.user.id))
  } catch (err) {
    next(err)
  }
})

studioRouter.get('/studio/:id', async (req, res, next) => {
  try {
    const version = req.query.version ? Number(req.query.version) : undefined
    const doc = await loadStudioDoc(req.params.id, req.user.id, version)
    if (!doc) return res.status(404).json({ error: 'Document not found' })
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

// Edits create a new version — nothing is overwritten.
studioRouter.put('/studio/:id', async (req, res, next) => {
  try {
    const { markdown, title, format } = req.body ?? {}
    const doc = await storage.getDocument(req.params.id)
    if (!doc || doc.user_id !== req.user.id || doc.type !== 'studio') {
      return res.status(404).json({ error: 'Document not found' })
    }
    const prev = await storage.getDocumentVersion(doc.id, doc.current_version)
    const prevData = typeof prev.data === 'string' ? JSON.parse(prev.data) : prev.data
    const data = {
      ...prevData,
      ...(title !== undefined ? { title } : {}),
      ...(format !== undefined ? { format } : {}),
      ...(markdown !== undefined ? { markdown } : {}),
    }
    const now = new Date().toISOString()
    await storage.addDocumentVersion(doc.id, {
      version: doc.current_version + 1,
      data,
      title: data.title || doc.title,
      status: 'draft',
      updated_at: now,
    })
    res.json(await loadStudioDoc(doc.id, req.user.id))
  } catch (err) {
    next(err)
  }
})

// Download in any format regardless of the stored default.
studioRouter.get('/studio/:id/download', async (req, res, next) => {
  try {
    const version = req.query.version ? Number(req.query.version) : undefined
    const format = String(req.query.format || 'pdf').toLowerCase()
    const doc = await loadStudioDoc(req.params.id, req.user.id, version)
    if (!doc) return res.status(404).json({ error: 'Document not found' })
    const { buffer, mime, ext } = await renderDocument(format, {
      title: doc.data.title,
      markdown: doc.data.markdown,
    })
    const safe = (doc.data.title || 'document').replace(/[^\w\-]+/g, '_').slice(0, 60)
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `attachment; filename="${safe}.${ext}"`)
    res.send(Buffer.from(buffer))
  } catch (err) {
    next(err)
  }
})
