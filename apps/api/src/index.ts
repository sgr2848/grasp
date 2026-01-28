import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import transcribeRoutes from './routes/transcribe.js'
import evaluateRoutes from './routes/evaluate.js'
import sessionsRoutes from './routes/sessions.js'
import userRoutes from './routes/user.js'
import ttsRoutes from './routes/tts.js'
import workspacesRoutes from './routes/workspaces.js'
import chatRoutes from './routes/chat.js'
import loopsRoutes from './routes/loops.js'
import booksRoutes from './routes/books.js'
import knowledgeRoutes from './routes/knowledge.js'
import youtubeRoutes from './routes/youtube.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'https://graspnow.xyz',
  'https://www.graspnow.xyz'
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))
app.use(express.json())

// Request logging
app.use((req, res, next) => {
  const startedAt = Date.now()
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    console.log(`[${req.method}] ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`)
  })
  next()
})

// Routes
app.use('/api/transcribe', transcribeRoutes)
app.use('/api/evaluate', evaluateRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api/user', userRoutes)
app.use('/api/tts', ttsRoutes)
app.use('/api/workspaces', workspacesRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/loops', loopsRoutes)
app.use('/api/books', booksRoutes)
app.use('/api/knowledge', knowledgeRoutes)
app.use('/api/youtube', youtubeRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
