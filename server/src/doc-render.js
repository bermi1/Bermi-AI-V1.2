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

export async function renderDocx({ title, markdown }) {
  const blocks = parseBlocks(markdown)
  const children = []
  if (title) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 40, color: BRAND })],
        spacing: { after: 240 },
      }),
    )
  }
  const headingMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
  }
  for (const b of blocks) {
    if (b.type === 'space') continue
    if (b.type === 'heading') {
      children.push(
        new Paragraph({
          heading: headingMap[b.level] || HeadingLevel.HEADING_3,
          children: inlineRuns(b.text).map((r) => new TextRun({ text: r.text, bold: r.bold })),
          spacing: { before: 200, after: 100 },
        }),
      )
    } else if (b.type === 'bullet' || b.type === 'number') {
      children.push(
        new Paragraph({
          bullet: b.type === 'bullet' ? { level: 0 } : undefined,
          numbering: undefined,
          children: inlineRuns((b.type === 'number' ? '• ' : '') + b.text).map(
            (r) => new TextRun({ text: r.text, bold: r.bold }),
          ),
          spacing: { after: 60 },
        }),
      )
    } else {
      children.push(
        new Paragraph({
          children: inlineRuns(b.text).map((r) => new TextRun({ text: r.text, bold: r.bold })),
          spacing: { after: 120 },
        }),
      )
    }
  }
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
    sections: [{ children }],
  })
  return Packer.toBuffer(doc)
}

// ---------- PPTX ----------

export async function renderPptx({ title, markdown }) {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 })
  pptx.layout = 'WIDE'

  const blocks = parseBlocks(markdown)
  // Split into slides at level-1/2 headings; the first heading is the title slide.
  const slides = []
  let current = null
  for (const b of blocks) {
    if (b.type === 'heading' && b.level <= 2) {
      current = { title: b.text, bullets: [] }
      slides.push(current)
    } else if (b.type === 'heading') {
      if (!current) {
        current = { title: b.text, bullets: [] }
        slides.push(current)
      } else current.bullets.push({ text: b.text, bold: true })
    } else if (b.type === 'bullet' || b.type === 'number' || b.type === 'para') {
      if (!current) {
        current = { title: title || 'Overview', bullets: [] }
        slides.push(current)
      }
      current.bullets.push({ text: b.text.replace(/\*\*/g, ''), bold: false })
    }
  }
  if (slides.length === 0) slides.push({ title: title || 'Slide', bullets: [] })

  // Title slide
  const cover = pptx.addSlide()
  cover.background = { color: BRAND }
  cover.addText(title || slides[0].title, {
    x: 0.7,
    y: 2.6,
    w: 11.9,
    h: 2,
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial',
  })
  cover.addText('Generated with Bermi AI', {
    x: 0.7,
    y: 4.6,
    w: 11.9,
    h: 0.5,
    fontSize: 14,
    color: 'EDEBFB',
  })

  for (const s of slides) {
    const slide = pptx.addSlide()
    slide.addText(s.title, {
      x: 0.6,
      y: 0.4,
      w: 12.1,
      h: 0.9,
      fontSize: 26,
      bold: true,
      color: BRAND,
      fontFace: 'Arial',
    })
    slide.addShape(pptx.ShapeType.line, {
      x: 0.6,
      y: 1.35,
      w: 12.1,
      h: 0,
      line: { color: BRAND, width: 2 },
    })
    if (s.bullets.length) {
      slide.addText(
        s.bullets.map((b) => ({
          text: b.text,
          options: { bullet: true, bold: b.bold, fontSize: b.bold ? 20 : 18, color: '1C1C1A' },
        })),
        { x: 0.7, y: 1.7, w: 12, h: 5.2, valign: 'top', lineSpacingMultiple: 1.2 },
      )
    }
  }
  return pptx.write({ outputType: 'nodebuffer' })
}

// ---------- PDF ----------

export function renderDocHtml({ title, markdown }) {
  const blocks = parseBlocks(markdown)
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
    * { box-sizing: border-box; }
    body { font-family: 'Inter','Segoe UI',Roboto,sans-serif; color:#1c1c1a; padding:56px 64px; line-height:1.65; font-size:15px; }
    h1 { color:#3b2fbf; font-size:28px; margin:0 0 6px; }
    h2 { font-size:20px; margin:26px 0 8px; }
    h3 { font-size:16px; margin:20px 0 6px; }
    h4 { font-size:14px; margin:16px 0 4px; color:#5c5b56; }
    p { margin:0 0 12px; }
    ul,ol { margin:0 0 14px 22px; } li { margin:4px 0; }
    .title { border-bottom:2px solid #3b2fbf; padding-bottom:14px; margin-bottom:26px; }
    .foot { margin-top:48px; padding-top:14px; border-top:1px solid #e6e5df; color:#8d8c85; font-size:12px; }
  </style></head><body>
    ${title ? `<div class="title"><h1>${escapeHtml(title)}</h1></div>` : ''}
    ${html}
    <div class="foot">Generated with Bermi AI</div>
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
