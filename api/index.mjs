// Vercel serverless entry: the whole Express API runs as one function.
// vercel.json rewrites /api/* here; Express sees the original path.
import app from '../server/src/app.js'

export const config = { supportsResponseStreaming: true }

export default app
