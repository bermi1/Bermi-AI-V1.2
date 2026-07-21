import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { storage } from '../storage/index.js'
import { complete } from '../openrouter.js'
import { renderDocument } from '../doc-render.js'

export const studioRouter = Router()

const DRAFT_MODEL = process.env.DRAFT_MODEL || 'bermi-core'

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

    let markdown = null
    try {
      markdown = await complete({
        model: DRAFT_MODEL,
        maxTokens: 2200,
        messages: [
          {
            role: 'system',
            content:
              'You are Bermi, an expert document writer. Produce ' +
              kindDesc +
              '. Respond in GitHub-flavored Markdown ONLY (no code fences around the whole thing). ' +
              'Use # for the document title, ## for sections, - for bullets, **bold** for emphasis. ' +
              'Be substantive and well-organized. Do not include commentary about the task.',
          },
          {
            role: 'user',
            content: `Title: ${title || '(choose a fitting title)'}\n\nBrief: ${prompt}`,
          },
        ],
      })
    } catch (err) {
      console.error('Studio draft failed, using scaffold:', err.message)
    }

    if (!markdown) {
      // No API key / model — still produce a usable scaffold.
      markdown = `# ${title || 'Untitled document'}\n\n## Overview\n\n${prompt}\n\n## Details\n\n- Point one\n- Point two\n\n## Conclusion\n\nSummary of the above.`
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
