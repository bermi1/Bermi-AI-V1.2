import { Router } from 'express'
import multer from 'multer'
import { complete } from '../openrouter.js'

export const extractRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
})

const MAX_CHARS = 24_000
const TEXT_TYPES = /^(text\/|application\/(json|xml|csv|x-yaml))/
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|bmp|tiff?)/

// pdf-parse pulls in pdfjs-dist's "legacy" (Node) build, which — at IMPORT
// time, unconditionally — does `const SCALE_MATRIX = new DOMMatrix();` for
// its canvas-rendering module. pdfjs tries to self-polyfill DOMMatrix/Path2D/
// ImageData from the optional native `@napi-rs/canvas` package, but that's a
// prebuilt binary; on a serverless platform (wrong arch/libc, or the
// dependency tracer not bundling the .node file) it silently fails to load,
// leaving those globals undefined — so just IMPORTING pdf-parse throws
// "DOMMatrix is not defined" before a single byte of the PDF is read. We only
// ever call getText() (never render to a real canvas), so correctness of the
// polyfill doesn't matter — it only needs to exist so pdfjs's module-load-time
// code and internal transform math don't crash.
let pdfPolyfilled = false
async function ensurePdfPolyfills() {
  if (pdfPolyfilled || globalThis.DOMMatrix) {
    pdfPolyfilled = true
    return
  }
  try {
    const canvas = await import('@napi-rs/canvas')
    globalThis.DOMMatrix = canvas.DOMMatrix
    globalThis.Path2D = canvas.Path2D
    globalThis.ImageData = canvas.ImageData
  } catch {
    class StubDOMMatrix {
      constructor(init) {
        if (Array.isArray(init) && init.length >= 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init
        else Object.assign(this, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      }
      multiply() { return this }
      multiplySelf() { return this }
      preMultiplySelf() { return this }
      invertSelf() { return this }
      translate() { return this }
      scale() { return this }
      transformPoint(p) { return p }
    }
    class StubPath2D {
      addPath() {}
    }
    class StubImageData {
      constructor(width, height) {
        this.width = width
        this.height = height
      }
    }
    globalThis.DOMMatrix = StubDOMMatrix
    globalThis.Path2D = StubPath2D
    globalThis.ImageData = StubImageData
  }
  pdfPolyfilled = true
}

const OCR_PROMPT =
  'You are a powerful OCR engine. Transcribe EVERYTHING in this document image, exactly, losing nothing. ' +
  'Preserve the reading order and structure. Output clean Markdown: use headings for headings, bullet/numbered ' +
  'lists for lists, and Markdown tables for any tabular data. Render every mathematical expression, equation, ' +
  'formula or symbol in LaTeX ($...$ inline, $$...$$ for display). Transcribe handwriting if present. Do NOT ' +
  'summarize, explain, translate, or add commentary — output only the transcribed content.'

/**
 * Modern OCR via a vision-language model (Qwen2.5-VL and friends) through
 * OpenRouter. Reads text, tables and math (as LaTeX) from an image far better
 * than classic OCR. Falls back to tesseract.js if the model call fails or no
 * API key is set.
 */
async function ocrImage(buffer, mimetype) {
  const mime = IMAGE_TYPES.test(mimetype) ? mimetype : 'image/png'
  const dataUri = `data:${mime};base64,${buffer.toString('base64')}`
  try {
    const text = await complete({
      model: 'bermi-vision',
      maxTokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: dataUri } },
          ],
        },
      ],
    })
    const cleaned = (text || '').replace(/<\/?think>/gi, '').trim()
    if (cleaned) return cleaned
  } catch {
    /* fall through to tesseract */
  }
  return ocrImageTesseract(buffer)
}

/** Extract slide text from a .pptx (a zip of slide XML) using jszip. */
async function extractPptx(buffer) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]))
  const decode = (s) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  const out = []
  let n = 0
  for (const p of slidePaths) {
    n++
    const xml = await zip.files[p].async('string')
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decode(m[1]))
    const clean = texts.join(' ').replace(/\s+/g, ' ').trim()
    if (clean) out.push(`## Slide ${n}\n${clean}`)
  }
  return out.join('\n\n')
}

/** Classic offline OCR fallback (lazy-loaded — it's heavy). */
async function ocrImageTesseract(buffer) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer)
    return text
  } finally {
    await worker.terminate()
  }
}

/**
 * POST /api/extract — turns an uploaded file into plain text the chat can
 * carry as context. Plain-text formats are decoded directly; PDFs go through
 * pdf-parse. The extracted text is returned to the client, which folds it
 * into the message it sends.
 */
extractRouter.post('/extract', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const { originalname, mimetype, buffer } = req.file

    let text
    const lower = originalname.toLowerCase()
    let ocr = false
    if (mimetype === 'application/pdf' || lower.endsWith('.pdf')) {
      await ensurePdfPolyfills()
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        text = (await parser.getText()).text
      } finally {
        await parser.destroy()
      }
    } else if (IMAGE_TYPES.test(mimetype) || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(lower)) {
      // Scanned document / photo → modern vision-model OCR.
      text = await ocrImage(buffer, mimetype)
      ocr = true
    } else if (
      lower.endsWith('.docx') ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const { default: mammoth } = await import('mammoth')
      text = (await mammoth.extractRawText({ buffer })).value
    } else if (
      lower.endsWith('.pptx') ||
      mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      text = await extractPptx(buffer)
    } else if (TEXT_TYPES.test(mimetype) || /\.(txt|md|markdown|csv|json|xml|ya?ml|log)$/i.test(originalname)) {
      text = buffer.toString('utf8')
    } else {
      return res.status(415).json({
        error: `Unsupported file type (${mimetype}). Upload text (.txt, .md, .csv, .json), Word (.docx), PowerPoint (.pptx), PDF, or an image (.png, .jpg) for OCR.`,
      })
    }

    const cleaned = text.replace(/\u0000/g, '').trim()
    res.json({
      name: originalname,
      chars: cleaned.length,
      truncated: cleaned.length > MAX_CHARS,
      ocr,
      text: cleaned.slice(0, MAX_CHARS),
    })
  } catch (err) {
    next(err)
  }
})
