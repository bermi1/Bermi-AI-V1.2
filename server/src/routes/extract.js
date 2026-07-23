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
