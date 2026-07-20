import { Router } from 'express'
import multer from 'multer'

export const extractRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const MAX_CHARS = 24_000
const TEXT_TYPES = /^(text\/|application\/(json|xml|csv|x-yaml))/

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
    if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        text = (await parser.getText()).text
      } finally {
        await parser.destroy()
      }
    } else if (TEXT_TYPES.test(mimetype) || /\.(txt|md|markdown|csv|json|xml|ya?ml|log)$/i.test(originalname)) {
      text = buffer.toString('utf8')
    } else {
      return res.status(415).json({
        error: `Unsupported file type (${mimetype}). Upload text files (.txt, .md, .csv, .json) or PDFs.`,
      })
    }

    const cleaned = text.replace(/\u0000/g, '').trim()
    res.json({
      name: originalname,
      chars: cleaned.length,
      truncated: cleaned.length > MAX_CHARS,
      text: cleaned.slice(0, MAX_CHARS),
    })
  } catch (err) {
    next(err)
  }
})
