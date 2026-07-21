import { Router } from 'express'
import multer from 'multer'

export const extractRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
})

const MAX_CHARS = 24_000
const TEXT_TYPES = /^(text\/|application\/(json|xml|csv|x-yaml))/
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|bmp|tiff?)/

/** OCR an image buffer to text via tesseract.js (lazy-loaded — it's heavy). */
async function ocrImage(buffer) {
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
      // Scanned document / photo → OCR.
      text = await ocrImage(buffer)
      ocr = true
    } else if (
      lower.endsWith('.docx') ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const { default: mammoth } = await import('mammoth')
      text = (await mammoth.extractRawText({ buffer })).value
    } else if (TEXT_TYPES.test(mimetype) || /\.(txt|md|markdown|csv|json|xml|ya?ml|log)$/i.test(originalname)) {
      text = buffer.toString('utf8')
    } else {
      return res.status(415).json({
        error: `Unsupported file type (${mimetype}). Upload text (.txt, .md, .csv, .json), Word (.docx), PDF, or an image (.png, .jpg) for OCR.`,
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
