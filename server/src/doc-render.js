import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import PptxGenJS from 'pptxgenjs'
import { htmlToPdf } from './pdf.js'

const BRAND = '3B2FBF'

// ---------- tiny markdown model ----------

/** Parses markdown into a flat block list the renderers consume. */
export function parseBlocks(md) {
  const blocks = []
  const lines = String(md || '').replace(/\r/g, '').split('\n')
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) {
      blocks.push({ type: 'space' })
      continue
    }
    let m
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      blocks.push({ type: 'heading', level: m[1].length, text: m[2].trim() })
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      blocks.push({ type: 'bullet', text: m[1].trim() })
    } else if ((m = line.match(/^\s*(\d+)\.\s+(.*)$/))) {
      blocks.push({ type: 'number', text: m[2].trim() })
    } else {
      blocks.push({ type: 'para', text: line.trim() })
    }
  }
  return blocks
}

/** Splits **bold** runs out of a line into {text, bold} segments. */
function inlineRuns(text) {
  const parts = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), bold: false })
    parts.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false })
  return parts.length ? parts : [{ text, bold: false }]
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inlineHtml(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

// ---------- DOCX ----------

// Premium DOCX typography — a real title block, tuned heading sizes/colors,
// comfortable line spacing, and a subtle divider under the title. Sizes are in
// half-points (docx unit): body 21 = 10.5pt, H1 30 = 15pt, etc.
export async function renderDocx({ title, markdown }) {
  const blocks = parseBlocks(markdown)
  const children = []

  // If the first block is an H1 matching the title, don't repeat it.
  let start = 0
  if (title && blocks[0]?.type === 'heading' && blocks[0].level === 1) start = 1

  if (title) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 44, color: BRAND, font: 'Georgia' })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        border: { bottom: { color: BRAND, size: 12, space: 6, style: 'single' } },
        spacing: { after: 260 },
      }),
    )
  }

  const HSIZE = { 1: 30, 2: 26, 3: 23, 4: 21 }
  const HCOLOR = { 1: BRAND, 2: '1C1C1A', 3: '1C1C1A', 4: '5C5B56' }
  for (let i = start; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === 'space') continue
    if (b.type === 'heading') {
      children.push(
        new Paragraph({
          children: inlineRuns(b.text).map(
            (r) =>
              new TextRun({
                text: r.text,
                bold: true,
                size: HSIZE[b.level] || 21,
                color: HCOLOR[b.level] || '1C1C1A',
                font: b.level <= 2 ? 'Georgia' : 'Calibri',
              }),
          ),
          spacing: { before: 300, after: 120 },
          keepNext: true,
        }),
      )
    } else if (b.type === 'bullet' || b.type === 'number') {
      children.push(
        new Paragraph({
          bullet: b.type === 'bullet' ? { level: 0 } : undefined,
          children: inlineRuns((b.type === 'number' ? '• ' : '') + b.text).map(
            (r) => new TextRun({ text: r.text, bold: r.bold, size: 21, font: 'Calibri' }),
          ),
          spacing: { after: 90, line: 276 },
        }),
      )
    } else {
      children.push(
        new Paragraph({
          children: inlineRuns(b.text).map(
            (r) => new TextRun({ text: r.text, bold: r.bold, size: 21, font: 'Calibri' }),
          ),
          spacing: { after: 160, line: 288 },
        }),
      )
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 21, color: '1C1C1A' } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1200, bottom: 1200, left: 1300, right: 1300 } } },
        children,
      },
    ],
  })
  return Packer.toBuffer(doc)
}

// ---------- PPTX (Gamma-style designed deck) ----------

const DARK = '1B1630'
const INK = '1C1C1A'
const MUTED = '6B6A75'
const ACCENT = BRAND
const ACCENT2 = '7C6FF0'
const SOFT = 'EDEBFB'

export async function renderPptx({ title, markdown }) {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 })
  pptx.layout = 'WIDE'
  pptx.theme = { headFontFace: 'Georgia', bodyFontFace: 'Arial' }

  // Parse markdown into slides. Each ## (or #) heading starts a slide.
  const blocks = parseBlocks(markdown)
  const deckTitle = title || blocks.find((b) => b.type === 'heading' && b.level === 1)?.text || 'Presentation'
  const slides = []
  let current = null
  for (const b of blocks) {
    if (b.type === 'heading' && b.level === 1) continue // deck title → cover only
    if (b.type === 'heading') {
      current = { title: b.text, bullets: [] }
      slides.push(current)
    } else if (b.type === 'bullet' || b.type === 'number' || b.type === 'para') {
      if (!current) {
        current = { title: 'Overview', bullets: [] }
        slides.push(current)
      }
      current.bullets.push(b.text.replace(/\*\*/g, ''))
    }
  }
  if (slides.length === 0) slides.push({ title: deckTitle, bullets: [] })

  // ---- Cover slide: bold, on-brand ----
  const cover = pptx.addSlide()
  cover.background = { color: DARK }
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: ACCENT } })
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 6.9, w: 13.33, h: 0.6, fill: { color: ACCENT } })
  cover.addText('BERMI AI', {
    x: 0.9, y: 1.5, w: 11, h: 0.4, fontSize: 13, color: ACCENT2, bold: true, charSpacing: 3,
  })
  cover.addText(deckTitle, {
    x: 0.9, y: 2.1, w: 11.2, h: 2.6, fontSize: 44, bold: true, color: 'FFFFFF', fontFace: 'Georgia', valign: 'top',
  })
  cover.addText('Presentation', {
    x: 0.9, y: 5.1, w: 11, h: 0.4, fontSize: 15, color: SOFT,
  })

  // ---- Section agenda slide (if enough slides) ----
  if (slides.length >= 4) {
    const agenda = pptx.addSlide()
    agenda.background = { color: 'FFFFFF' }
    agenda.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.5, fill: { color: SOFT } })
    agenda.addText('Contents', {
      x: 0.7, y: 0.45, w: 12, h: 0.7, fontSize: 30, bold: true, color: ACCENT, fontFace: 'Georgia',
    })
    agenda.addText(
      slides.map((s, i) => ({
        text: `${String(i + 1).padStart(2, '0')}   ${s.title}`,
        options: { fontSize: 18, color: INK, breakLine: true, paraSpaceAfter: 10 },
      })),
      { x: 0.9, y: 1.9, w: 11.5, h: 5, valign: 'top' },
    )
  }

  // ---- Content slides ----
  slides.forEach((s, idx) => {
    const slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }
    // Header band
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.35, fill: { color: DARK } })
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 1.35, w: 13.33, h: 0.08, fill: { color: ACCENT } })
    slide.addText(String(idx + 1).padStart(2, '0'), {
      x: 0.6, y: 0.3, w: 1, h: 0.8, fontSize: 30, bold: true, color: ACCENT2, fontFace: 'Georgia',
    })
    slide.addText(s.title, {
      x: 1.7, y: 0.3, w: 11, h: 0.8, fontSize: 25, bold: true, color: 'FFFFFF', fontFace: 'Georgia', valign: 'middle',
    })
    if (s.bullets.length) {
      slide.addText(
        s.bullets.slice(0, 6).map((t) => ({
          text: t,
          options: {
            bullet: { code: '2022', indent: 18 },
            fontSize: s.bullets.length > 4 ? 17 : 19,
            color: INK,
            paraSpaceAfter: 12,
            breakLine: true,
          },
        })),
        { x: 0.9, y: 1.9, w: 11.5, h: 5.0, valign: 'top', lineSpacingMultiple: 1.15 },
      )
    }
    // Footer
    slide.addText(deckTitle, { x: 0.6, y: 7.0, w: 8, h: 0.35, fontSize: 10, color: MUTED })
    slide.addText(`${idx + 1} / ${slides.length}`, {
      x: 11.4, y: 7.0, w: 1.3, h: 0.35, fontSize: 10, color: MUTED, align: 'right',
    })
  })

  // ---- Closing slide ----
  const end = pptx.addSlide()
  end.background = { color: DARK }
  end.addShape(pptx.ShapeType.rect, { x: 0, y: 3.5, w: 13.33, h: 0.08, fill: { color: ACCENT } })
  end.addText('Thank you', {
    x: 0.9, y: 2.6, w: 11.5, h: 1, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Georgia',
  })
  end.addText('Created with Bermi AI', { x: 0.9, y: 3.8, w: 11, h: 0.5, fontSize: 15, color: SOFT })

  return pptx.write({ outputType: 'nodebuffer' })
}

// ---------- PDF ----------

export function renderDocHtml({ title, markdown }) {
  const blocks = parseBlocks(markdown)
  // Avoid printing the title twice when the markdown opens with the same H1.
  if (title && blocks[0]?.type === 'heading' && blocks[0].level === 1) blocks.shift()
  let html = ''
  let listOpen = null
  const closeList = () => {
    if (listOpen) {
      html += `</${listOpen}>`
      listOpen = null
    }
  }
  for (const b of blocks) {
    if (b.type === 'space') {
      closeList()
    } else if (b.type === 'heading') {
      closeList()
      html += `<h${b.level}>${inlineHtml(b.text)}</h${b.level}>`
    } else if (b.type === 'bullet') {
      if (listOpen !== 'ul') {
        closeList()
        html += '<ul>'
        listOpen = 'ul'
      }
      html += `<li>${inlineHtml(b.text)}</li>`
    } else if (b.type === 'number') {
      if (listOpen !== 'ol') {
        closeList()
        html += '<ol>'
        listOpen = 'ol'
      }
      html += `<li>${inlineHtml(b.text)}</li>`
    } else {
      closeList()
      html += `<p>${inlineHtml(b.text)}</p>`
    }
  }
  closeList()

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      color:#1c1c1a; padding:64px 72px; line-height:1.7; font-size:14.5px;
      -webkit-font-smoothing: antialiased;
    }
    h1,h2 { font-family: Georgia,'Times New Roman',serif; letter-spacing:-0.01em; }
    h1 { color:#3b2fbf; font-size:32px; line-height:1.2; margin:0 0 4px; font-weight:600; }
    h2 { font-size:21px; margin:32px 0 10px; font-weight:600; color:#1c1c1a; }
    h3 { font-size:16.5px; margin:24px 0 7px; font-weight:600; }
    h4 { font-size:13px; margin:18px 0 4px; color:#5c5b56; text-transform:uppercase; letter-spacing:0.06em; }
    p { margin:0 0 13px; }
    strong { font-weight:600; }
    ul,ol { margin:0 0 16px 20px; padding:0; } li { margin:5px 0; padding-left:4px; }
    li::marker { color:#3b2fbf; }
    a { color:#3b2fbf; text-decoration:none; }
    .title { border-bottom:2px solid #3b2fbf; padding-bottom:16px; margin-bottom:30px; }
    .title .kicker { font-size:11px; text-transform:uppercase; letter-spacing:0.14em; color:#8d8c85; margin-bottom:8px; font-family:Inter,sans-serif; }
    .foot { margin-top:52px; padding-top:14px; border-top:1px solid #e6e5df; color:#8d8c85; font-size:11.5px; display:flex; justify-content:space-between; }
  </style></head><body>
    ${title ? `<div class="title"><div class="kicker">Document</div><h1>${escapeHtml(title)}</h1></div>` : ''}
    ${html}
    <div class="foot"><span>${escapeHtml(title || '')}</span><span>Generated with Bermi AI</span></div>
  </body></html>`
}

export async function renderDocPdf({ title, markdown }) {
  return htmlToPdf(renderDocHtml({ title, markdown }))
}

export async function renderDocument(format, payload) {
  if (format === 'docx') return { buffer: await renderDocx(payload), mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' }
  if (format === 'pptx') return { buffer: await renderPptx(payload), mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' }
  if (format === 'pdf') return { buffer: Buffer.from(await renderDocPdf(payload)), mime: 'application/pdf', ext: 'pdf' }
  throw new Error(`Unsupported format: ${format}`)
}
