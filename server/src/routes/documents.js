import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db.js'
import { complete } from '../openrouter.js'
import { renderInvoiceHtml } from '../invoice-template.js'
import { htmlToPdf } from '../pdf.js'

export const documentsRouter = Router()

const DRAFT_MODEL = process.env.DRAFT_MODEL || 'anthropic/claude-haiku-4.5'

function docSummary(row) {
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

function loadDocument(id, version) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id)
  if (!doc) return null
  const v = version ?? doc.current_version
  const versionRow = db
    .prepare('SELECT * FROM document_versions WHERE document_id = ? AND version = ?')
    .get(id, v)
  if (!versionRow) return null
  return { ...docSummary(doc), version: v, data: JSON.parse(versionRow.data) }
}

function nextInvoiceNumber() {
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM documents WHERE type = 'invoice'")
    .get().n
  const year = new Date().getFullYear()
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`
}

/**
 * Ask the model to polish the invoice copy (terms, notes, item descriptions).
 * Falls back to sensible defaults when no API key is configured or the model
 * returns something unusable, so the generator works end-to-end regardless.
 */
async function draftInvoiceContent(input, base) {
  const fallback = {
    terms:
      base.terms ||
      'Payment is due within 30 days of the invoice date. Please reference the invoice number with your payment.',
    notes: base.notes || 'Thank you for your business.',
    items: base.items,
  }
  try {
    const raw = await complete({
      model: DRAFT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You draft professional invoice copy. Respond with ONLY a JSON object, no markdown fences, ' +
            'shaped as {"items":[{"description":string,"quantity":number,"unit_price":number}],"terms":string,"notes":string}. ' +
            'Rewrite item descriptions to be clear and professional but keep quantities and unit prices EXACTLY as given. ' +
            'Terms should be concise payment terms; notes a short friendly closing. Honor any special instructions.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            client: input.client_name,
            items: base.items,
            currency: base.currency,
            tax_rate: base.tax_rate,
            special_instructions: input.instructions || 'none',
          }),
        },
      ],
    })
    if (!raw) return fallback
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    const parsed = JSON.parse(jsonText)
    const items =
      Array.isArray(parsed.items) && parsed.items.length === base.items.length
        ? parsed.items.map((it, i) => ({
            description: String(it.description || base.items[i].description),
            quantity: base.items[i].quantity,
            unit_price: base.items[i].unit_price,
          }))
        : base.items
    return {
      items,
      terms: typeof parsed.terms === 'string' && parsed.terms ? parsed.terms : fallback.terms,
      notes: typeof parsed.notes === 'string' && parsed.notes ? parsed.notes : fallback.notes,
    }
  } catch {
    return fallback
  }
}

documentsRouter.get('/documents', (_req, res) => {
  const rows = db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all()
  res.json(rows.map(docSummary))
})

documentsRouter.post('/documents/invoice', async (req, res) => {
  const input = req.body ?? {}
  if (!input.client_name || !Array.isArray(input.items) || input.items.length === 0) {
    return res.status(400).json({ error: 'client_name and at least one line item are required' })
  }

  const items = input.items.map((it) => ({
    description: String(it.description || 'Service'),
    quantity: Number(it.quantity) || 1,
    unit_price: Number(it.unit_price) || 0,
  }))

  const today = new Date()
  const due = new Date(today.getTime() + 30 * 24 * 3600 * 1000)
  const toDate = (d) => d.toISOString().slice(0, 10)

  const base = {
    invoice_number: nextInvoiceNumber(),
    issue_date: toDate(today),
    due_date: toDate(due),
    from_name: String(input.from_name || 'Your Company'),
    from_details: String(input.from_details || ''),
    client_name: String(input.client_name),
    client_details: String(input.client_details || ''),
    items,
    tax_rate: Number(input.tax_rate) || 0,
    currency: String(input.currency || 'USD'),
    terms: '',
    notes: '',
  }

  const drafted = await draftInvoiceContent(input, base)
  const data = { ...base, ...drafted }

  const now = new Date().toISOString()
  const id = randomUUID()
  const title = `${data.invoice_number} — ${data.client_name}`
  db.prepare(
    'INSERT INTO documents (id, type, title, status, current_version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
  ).run(id, 'invoice', title, 'draft', now, now)
  db.prepare(
    'INSERT INTO document_versions (document_id, version, data, created_at) VALUES (?, 1, ?, ?)',
  ).run(id, JSON.stringify(data), now)

  res.status(201).json(loadDocument(id))
})

documentsRouter.get('/documents/:id', (req, res) => {
  const version = req.query.version ? Number(req.query.version) : undefined
  const doc = loadDocument(req.params.id, version)
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  res.json(doc)
})

documentsRouter.get('/documents/:id/versions', (req, res) => {
  const rows = db
    .prepare(
      'SELECT version, created_at FROM document_versions WHERE document_id = ? ORDER BY version DESC',
    )
    .all(req.params.id)
  if (rows.length === 0) return res.status(404).json({ error: 'Document not found' })
  res.json(rows)
})

// Edits always create a new version — previous versions stay intact.
documentsRouter.put('/documents/:id', (req, res) => {
  const { data, status } = req.body ?? {}
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'data is required' })
  }

  const now = new Date().toISOString()
  const nextVersion = doc.current_version + 1
  const title = data.invoice_number
    ? `${data.invoice_number} — ${data.client_name || ''}`.trim()
    : doc.title

  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO document_versions (document_id, version, data, created_at) VALUES (?, ?, ?, ?)',
    ).run(doc.id, nextVersion, JSON.stringify(data), now)
    db.prepare(
      'UPDATE documents SET current_version = ?, title = ?, status = ?, updated_at = ? WHERE id = ?',
    ).run(nextVersion, title, status === 'final' ? 'final' : 'draft', now, doc.id)
  })
  tx()

  res.json(loadDocument(doc.id))
})

documentsRouter.delete('/documents/:id', (req, res) => {
  const result = db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Document not found' })
  res.json({ ok: true })
})

documentsRouter.get('/documents/:id/pdf', async (req, res) => {
  const version = req.query.version ? Number(req.query.version) : undefined
  const doc = loadDocument(req.params.id, version)
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  try {
    const pdf = await htmlToPdf(renderInvoiceHtml(doc.data))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.data.invoice_number || 'invoice'}.pdf"`,
    )
    res.send(Buffer.from(pdf))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

documentsRouter.get('/documents/:id/html', (req, res) => {
  const version = req.query.version ? Number(req.query.version) : undefined
  const doc = loadDocument(req.params.id, version)
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  res.setHeader('Content-Type', 'text/html')
  res.send(renderInvoiceHtml(doc.data))
})
